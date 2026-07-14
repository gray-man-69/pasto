// The progressive-overload engine. Double progression: work within a rep range
// at a fixed load; when every working set hits the TOP of the range, add weight
// next session and reset to the bottom — otherwise repeat the weight and chase
// more reps. (Adding sets — volume progression — is done by the user in the
// routine; weekly volume is surfaced separately.)
import type { PerformedSet, RoutineExercise, WorkoutSession } from "./types";

/** Sets that count toward progression: completed, non-warmup, with reps. */
export function workingSets(sets: PerformedSet[]): PerformedSet[] {
  return sets.filter((s) => s.done && s.type !== "warmup" && s.reps > 0);
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
      note: `▲ ${weight} kg — you hit ${re.repMax} on every set`,
    };
  }
  return {
    weight: lastWeight,
    reps: re.repMax,
    addWeight: false,
    note: `Same weight — beat your reps (aim ${re.repMax})`,
  };
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

export function summarizeLast(sets?: PerformedSet[]): string | undefined {
  const w = workingSets(sets ?? []);
  if (!w.length) return undefined;
  const weight = Math.max(...w.map((s) => s.weight));
  return `${weight} kg × ${w.map((s) => s.reps).join(", ")}`;
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

export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce((v, e) => v + volumeOf(e.sets), 0);
}
