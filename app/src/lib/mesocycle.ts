// Mesocycle math: turn a training block + a date into "which week am I in, and
// how many sets should each exercise be?" Grounded in the RP volume-landmark
// model — start near MEV, add a set/muscle each accumulation week toward MRV,
// then deload the final week (halved volume, lighter load) to shed fatigue.
import { weekStart } from "./db";
import type { Mesocycle } from "./types";

// addSetsPerWeek is sets added per MUSCLE per week (distributed across that
// muscle's exercises), not per exercise — matching the RP MEV→MRV ramp.
export const MESO_DEFAULTS = { weeks: 5, addSetsPerWeek: 1, deload: true };
// Deload week: keep the movement but drop the load ~10% and stay well shy of failure.
export const DELOAD_LOAD_FACTOR = 0.9;

export type MesoPhase = "upcoming" | "accumulation" | "deload" | "done";
export interface MesoWeek {
  index: number; // 0-based week number
  total: number;
  phase: MesoPhase;
  label: string;
}

function weeksBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / (7 * 86400000));
}

/** Which week of the block the given date falls in. */
export function mesoWeek(meso: Mesocycle, date: string): MesoWeek {
  const idx = weeksBetween(meso.startDate, weekStart(date));
  const total = meso.weeks;
  if (idx < 0) return { index: idx, total, phase: "upcoming", label: "Starts next week" };
  if (idx >= total) return { index: idx, total, phase: "done", label: "Block complete" };
  const isDeloadWk = meso.deload && idx === total - 1;
  return {
    index: idx,
    total,
    phase: isDeloadWk ? "deload" : "accumulation",
    label: isDeloadWk ? `Deload · week ${idx + 1} of ${total}` : `Week ${idx + 1} of ${total}`,
  };
}

/** Per-exercise set counts for this week. The block's weekly volume ramp is
 * added at the MUSCLE level (~+1 set/muscle/week) and spread across that muscle's
 * exercises — so a lift grows gently, ~1 set every couple weeks, not every week.
 * The deload week halves each exercise's base sets. */
export function rampedSetCounts(
  exs: { primaryMuscles: string[]; targetSets: number }[],
  meso: Mesocycle,
  date: string,
): number[] {
  const base = exs.map((e) => Math.max(1, e.targetSets));
  const w = mesoWeek(meso, date);
  if (w.phase === "deload") return exs.map((e) => Math.max(1, Math.round(e.targetSets / 2)));
  if (w.phase !== "accumulation" || w.index <= 0) return base;

  const added = new Array(exs.length).fill(0);
  const byMuscle = new Map<string, number[]>();
  exs.forEach((e, i) => {
    const m = (e.primaryMuscles[0] ?? "?").toLowerCase();
    const arr = byMuscle.get(m) ?? [];
    arr.push(i);
    byMuscle.set(m, arr);
  });
  const perMuscle = meso.addSetsPerWeek * w.index; // extra sets this muscle carries vs week 1
  for (const idxs of byMuscle.values()) {
    for (let k = 0; k < perMuscle; k++) {
      const j = idxs[k % idxs.length];
      if (added[j] < 2) added[j] += 1; // never balloon a single lift (+2 cap)
    }
  }
  return base.map((b, i) => b + added[i]);
}

/** Advisory reps-in-reserve target: easier early (~3), near failure late (~0),
 * very easy on the deload (~4). The block's second axis alongside volume. */
export function rirTarget(meso: Mesocycle, date: string): number {
  const w = mesoWeek(meso, date);
  if (w.phase === "deload") return 4;
  if (w.phase !== "accumulation") return 3;
  const accum = meso.weeks - (meso.deload ? 1 : 0);
  const frac = accum <= 1 ? 1 : w.index / (accum - 1);
  return Math.max(0, Math.round(3 - 3 * frac));
}

export function isDeloadWeek(meso: Mesocycle, date: string): boolean {
  return mesoWeek(meso, date).phase === "deload";
}

/** An active block is one that exists, isn't ended, and hasn't run its course. */
export function isBlockActive(meso: Mesocycle | null | undefined, date: string): meso is Mesocycle {
  if (!meso || meso.endedAt) return false;
  return mesoWeek(meso, date).phase !== "done";
}
