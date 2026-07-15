// The exercise library: 873 public-domain exercises bundled as a static asset
// (app/public/exercises.json, from yuhonas/free-exercise-db, Unlicense), plus any
// custom exercises the user creates (stored in IndexedDB). Loaded once, cached.
import { BASE_PATH } from "./basePath";
import type { Exercise, RoutineExercise } from "./types";

// Coarse browse groups (for the muscle-group picker) mapped from fine muscles.
const GROUP_OF: Record<string, string> = {
  chest: "Chest",
  lats: "Back",
  "middle back": "Back",
  "lower back": "Back",
  traps: "Back",
  shoulders: "Shoulders",
  biceps: "Arms",
  triceps: "Arms",
  forearms: "Arms",
  quadriceps: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  calves: "Legs",
  abdominals: "Core",
};
export const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"] as const;

// The fine muscle names the app understands (drive the muscle map + volume).
export const MUSCLES = [
  "chest",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abdominals",
  "traps",
  "lats",
  "middle back",
  "lower back",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
] as const;

export function groupOfMuscle(muscle: string | undefined): string {
  return GROUP_OF[(muscle ?? "").toLowerCase()] ?? "Other";
}
export function groupOf(ex: { primaryMuscles: string[] }): string {
  return groupOfMuscle(ex.primaryMuscles[0]);
}

// Sensible starting config for an exercise added to a routine (all editable).
// Compounds get a lower rep range; lower-body compounds a bigger load step.
const LOWER = new Set(["quadriceps", "hamstrings", "glutes", "lower back", "calves"]);
export function defaultRoutineExercise(ex: Exercise): RoutineExercise {
  const compound = ex.mechanic === "compound";
  const lower = LOWER.has((ex.primaryMuscles[0] ?? "").toLowerCase());
  const weight = ex.equipment === "body only" ? 0 : ex.equipment === "barbell" ? 20 : 10;
  return {
    exerciseId: ex.id,
    name: ex.name,
    primaryMuscles: ex.primaryMuscles,
    secondaryMuscles: ex.secondaryMuscles,
    targetSets: 3,
    repMin: compound ? 6 : 10,
    repMax: compound ? 10 : 15,
    weight,
    weightUnit: "kg",
    increment: lower && compound ? 5 : 2.5,
  };
}

let cache: Exercise[] | null = null;
let loading: Promise<Exercise[]> | null = null;

export async function loadExercises(): Promise<Exercise[]> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      const res = await fetch(`${BASE_PATH}/exercises.json`);
      if (!res.ok) throw new Error(`Failed to load exercises.json: ${res.status}`);
      const data = await res.json();
      cache = (data.exercises as Exercise[]) ?? [];
      return cache;
    })();
  }
  return loading;
}

export async function getExercise(id: string, custom: Exercise[] = []): Promise<Exercise | undefined> {
  const c = custom.find((e) => e.id === id);
  if (c) return c;
  return (await loadExercises()).find((e) => e.id === id);
}

/** Search bundled + custom exercises by name or muscle. Custom foods rank first. */
export async function searchExercises(
  query: string,
  custom: Exercise[] = [],
  limit = 50,
): Promise<Exercise[]> {
  const all = [...custom, ...(await loadExercises())];
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);
  const hits = all.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.primaryMuscles.some((m) => m.toLowerCase().includes(q)) ||
      (e.equipment ?? "").toLowerCase().includes(q),
  );
  // Prefix matches on the name first, then the rest.
  hits.sort((a, b) => {
    const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return ap - bp;
  });
  return hits.slice(0, limit);
}
