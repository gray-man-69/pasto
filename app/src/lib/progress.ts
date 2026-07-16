// Progress analytics over logged workouts: weekly volume per muscle (the
// science-based hypertrophy driver) and per-exercise strength progression / PRs.
import { e1rm, volumeOf, workingSets } from "./progression";
import type { WorkoutSession } from "./types";

/** Hard sets per muscle across the given sessions (each working set counts once
 * for every primary muscle of its exercise). Sorted most-worked first. */
export function volumeByMuscle(sessions: WorkoutSession[]): { muscle: string; sets: number }[] {
  const m = new Map<string, number>();
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const c = workingSets(ex.sets).length;
      if (!c) continue;
      for (const mus of ex.primaryMuscles ?? []) m.set(mus, (m.get(mus) ?? 0) + c);
    }
  }
  return [...m.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export type ExerciseProgress = {
  exerciseId: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  bestE1rm: number; // PR: best estimated 1RM
  bestWeight: number; // heaviest weight lifted
  bestVolume: number; // PR: best single-session volume (Σ weight × reps)
  lastVolume: number; // volume in the most recent session that trained it
  lastDate: string;
  points: number[]; // best e1RM per session, oldest → newest (for a sparkline)
  volumes: number[]; // session volume (Σ weight × reps) per session, aligned with points
  dates: string[]; // session date for each point (aligned with `points`)
};

/** Per-exercise history: PRs + an e1RM trend. Sessions may be in any order. */
export function exerciseProgress(sessions: WorkoutSession[]): ExerciseProgress[] {
  const byId = new Map<string, ExerciseProgress>();
  const chrono = [...sessions].sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));
  for (const s of chrono) {
    for (const ex of s.exercises) {
      const ws = workingSets(ex.sets);
      if (!ws.length) continue;
      const bestE = Math.max(...ws.map((st) => e1rm(st.weight, st.reps)));
      const topW = Math.max(...ws.map((st) => st.weight));
      const vol = volumeOf(ex.sets);
      let p = byId.get(ex.exerciseId);
      if (!p) {
        p = {
          exerciseId: ex.exerciseId,
          name: ex.name,
          primaryMuscles: ex.primaryMuscles ?? [],
          secondaryMuscles: ex.secondaryMuscles,
          bestE1rm: 0,
          bestWeight: 0,
          bestVolume: 0,
          lastVolume: 0,
          lastDate: s.date,
          points: [],
          volumes: [],
          dates: [],
        };
        byId.set(ex.exerciseId, p);
      }
      p.points.push(bestE);
      p.volumes.push(Math.round(vol));
      p.dates.push(s.date);
      p.bestE1rm = Math.max(p.bestE1rm, bestE);
      p.bestWeight = Math.max(p.bestWeight, topW);
      p.bestVolume = Math.max(p.bestVolume, vol);
      p.lastVolume = vol; // chrono order → ends on the most recent session
      p.lastDate = s.date;
      p.name = ex.name;
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0,
  );
}
