// The progressive-overload engine. Double progression: work within a rep range
// at a fixed load; when every working set hits the TOP of the range, add weight
// next session and reset to the bottom — otherwise repeat the weight and chase
// more reps. (Adding sets — volume progression — is done by the user in the
// routine; weekly volume is surfaced separately.)
import type { PerformedSet, RoutineExercise, WorkoutSession } from "./types";

/** Sets that count as performed work: any non-warmup set marked done (✓) with
 * reps entered. Volume/PRs/weekly targets only move once you confirm a set —
 * typing reps alone (before ticking) is not yet "performed". */
export function workingSets(sets: PerformedSet[]): PerformedSet[] {
  return sets.filter((s) => s.type !== "warmup" && s.reps > 0 && s.done);
}

export type Target = { weight: number; reps: number; addWeight: boolean; note: string };

export function nextTarget(re: RoutineExercise, lastSets?: PerformedSet[]): Target {
  const working = workingSets(lastSets ?? []);
  if (working.length === 0) {
    return { weight: re.weight, reps: re.repMin, addWeight: false, note: `Target ${re.repMin}–${re.repMax} reps` };
  }
  const lastWeight = Math.max(...working.map((s) => s.weight));
  const topWeightSets = working.filter((s) => s.weight >= lastWeight - 0.001);
  const allHitTop =
    topWeightSets.length >= re.targetSets && topWeightSets.every((s) => s.reps >= re.repMax);
  if (allHitTop) {
    const weight = Math.round((lastWeight + re.increment) * 100) / 100;
    return {
      weight,
      reps: re.repMin,
      addWeight: true,
      note: `You hit ${re.repMax} on every set — ready to add weight (try ${weight} kg)`,
    };
  }
  return {
    weight: lastWeight,
    reps: re.repMax,
    addWeight: false,
    note: `Beat last time — aim for ${re.repMax} reps`,
  };
}

// ---- Overload options ------------------------------------------------------
// Progressive overload can be reached several evidence-based ways, not one:
//  • load  — more weight (mechanical tension)
//  • reps  — more reps in the range (grows muscle equally to load; Plotkin 2022)
//  • set   — one more working set (weekly hard sets/muscle is the #1 driver)
//  • dropset — a drop on the last set (≈ extra sets for growth in ~⅓ the time)
// We still use double progression to pick the *recommended* micro-step, then
// present the others as valid alternatives.

export type OverloadLever = "weight" | "reps" | "set" | "dropset";
export interface OverloadOption {
  lever: OverloadLever;
  title: string;
  detail: string;
  recommended?: boolean;
}

export function overloadOptions(re: RoutineExercise, lastSets?: PerformedSet[]): OverloadOption[] {
  const working = workingSets(lastSets ?? []);
  const hasHistory = working.length > 0;
  const lastWeight = hasHistory ? Math.max(...working.map((s) => s.weight)) : re.weight;
  const topSets = working.filter((s) => s.weight >= lastWeight - 0.001);
  const allHitTop =
    hasHistory && topSets.length >= re.targetSets && topSets.every((s) => s.reps >= re.repMax);
  const nextW = Math.round((lastWeight + re.increment) * 100) / 100;

  const options: OverloadOption[] = [
    {
      lever: "weight",
      title: `Add weight → ${nextW} kg`,
      detail: "More load = more tension. Best once you hit the top of the rep range on every set.",
      recommended: allHitTop,
    },
    {
      lever: "reps",
      title: `Add reps → aim ${re.repMax}`,
      detail: "Beating reps builds muscle just like adding weight — fill out the rep range first.",
      recommended: hasHistory && !allHitTop,
    },
    {
      lever: "set",
      title: "Add a set",
      detail: "Weekly hard sets per muscle is the top hypertrophy driver — ramp toward 10–20/week.",
    },
    {
      lever: "dropset",
      title: "Add a dropset",
      detail: "Drop ~25% and rep to failure — ≈ extra sets for growth in a fraction of the time.",
    },
  ];
  // Recommended first, otherwise keep the load → reps → set → dropset order.
  return options.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
}

/** Most recent completed session's sets for an exercise (sessions newest-first). */
export function lastForExercise(
  sessions: WorkoutSession[],
  exerciseId: string,
): PerformedSet[] | undefined {
  for (const s of sessions) {
    const ex = s.exercises.find(
      (e) => e.exerciseId === exerciseId && workingSets(e.sets).length > 0,
    );
    if (ex) return ex.sets;
  }
  return undefined;
}

/** Most recent free-text note the user left for this exercise (sessions newest-first),
 * so it carries forward into the next session's prefill instead of resetting blank. */
export function lastUserNote(
  sessions: WorkoutSession[],
  exerciseId: string,
): string | undefined {
  for (const s of sessions) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId && e.userNote);
    if (ex) return ex.userNote;
  }
  return undefined;
}

export function summarizeLast(sets?: PerformedSet[]): string | undefined {
  const w = workingSets(sets ?? []);
  if (!w.length) return undefined;
  const weight = Math.max(...w.map((s) => s.weight));
  const rated = w.filter((s) => s.rir != null);
  const rir = rated.length
    ? ` · ~${Math.round(rated.reduce((n, s) => n + (s.rir ?? 0), 0) / rated.length)} RIR`
    : "";
  return `${weight} kg × ${w.map((s) => s.reps).join(", ")}${rir}`;
}

// Estimated 1RM (Epley). A trend indicator, not a true max (±10%+).
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30));
}

/** Total volume (Σ weight × reps) over an exercise's working sets. */
export function volumeOf(sets: PerformedSet[]): number {
  return workingSets(sets).reduce((v, s) => v + s.weight * s.reps, 0);
}

/** Per-exercise session volume target = every prescribed set at your target reps,
 * at LAST session's weight (sets × lastWeight × repMax). Anchoring to last
 * session's weight (pass `lastSets`) keeps the target FIXED as you log, so adding
 * weight raises your volume toward it (progress) instead of moving the goalpost.
 * Match it → you're due a weight increase. Deload / bodyweight → no target. */
export function sessionTarget(
  re: RoutineExercise,
  lastSets: PerformedSet[] | undefined,
  prescribedSets: number,
  deloading: boolean,
): number {
  if (deloading) return 0;
  const ws = workingSets(lastSets ?? []);
  const w = ws.length ? Math.max(...ws.map((s) => s.weight)) : re.weight;
  if (w <= 0) return 0;
  return Math.round(Math.max(1, prescribedSets) * w * re.repMax);
}

export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce((v, e) => v + volumeOf(e.sets), 0);
}

/** Previous and best working-set volume for one exercise across history.
 * `last` = the most recent session that trained it; `best` = its PR volume. */
export function volumeStatsForExercise(
  sessions: WorkoutSession[],
  exerciseId: string,
): { last: number; best: number } {
  // completedSessions() gives newest-first; use endedAt to be order-independent.
  const withEx = sessions
    .map((s) => ({
      at: s.endedAt ?? 0,
      vol: s.exercises
        .filter((e) => e.exerciseId === exerciseId)
        .reduce((v, e) => v + volumeOf(e.sets), 0),
    }))
    .filter((x) => x.vol > 0);
  if (!withEx.length) return { last: 0, best: 0 };
  const last = withEx.reduce((a, b) => (b.at > a.at ? b : a)).vol;
  const best = Math.max(...withEx.map((x) => x.vol));
  return { last, best };
}
