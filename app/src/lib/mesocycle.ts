// Mesocycle math: turn a training block + a date into "which week am I in, and
// how many sets should each exercise be?" Grounded in the RP volume-landmark
// model — start near MEV, add a set/muscle each accumulation week toward MRV,
// then deload the final week (halved volume, lighter load) to shed fatigue.
import { weekStart } from "./db";
import type { Mesocycle } from "./types";

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

/** Sets prescribed for an exercise this week = base + weekly ramp (deload halves). */
export function rampedSets(base: number, meso: Mesocycle, date: string): number {
  const w = mesoWeek(meso, date);
  if (w.phase === "upcoming" || w.phase === "done") return Math.max(1, base);
  if (w.phase === "deload") return Math.max(1, Math.round(base / 2));
  return base + meso.addSetsPerWeek * w.index;
}

export function isDeloadWeek(meso: Mesocycle, date: string): boolean {
  return mesoWeek(meso, date).phase === "deload";
}

/** An active block is one that exists, isn't ended, and hasn't run its course. */
export function isBlockActive(meso: Mesocycle | null | undefined, date: string): meso is Mesocycle {
  if (!meso || meso.endedAt) return false;
  return mesoWeek(meso, date).phase !== "done";
}
