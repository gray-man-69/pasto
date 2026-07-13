// The exercise library: 873 public-domain exercises bundled as a static asset
// (app/public/exercises.json, from yuhonas/free-exercise-db, Unlicense), plus any
// custom exercises the user creates (stored in IndexedDB). Loaded once, cached.
import { BASE_PATH } from "./basePath";
import type { Exercise } from "./types";

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
