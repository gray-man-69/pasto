// Loads the bundled food database once and provides fuzzy search.
// foods.json is a static asset built by ../../pipeline/build_foods.py — the app
// never calls a nutrition API for these generic foods.
import Fuse from "fuse.js";
import { BASE_PATH } from "./basePath";
import type { Food, FoodsFile } from "./types";

type FoodCache = { foods: Food[]; fuse: Fuse<Food>; meta: Omit<FoodsFile, "foods"> };

let cache: FoodCache | null = null;
let inflight: Promise<FoodCache> | null = null;

async function load(): Promise<FoodCache> {
  const res = await fetch(`${BASE_PATH}/foods.json`);
  if (!res.ok) throw new Error(`Failed to load foods.json: ${res.status}`);
  const data = (await res.json()) as FoodsFile;
  const fuse = new Fuse(data.foods, {
    keys: [
      { name: "name", weight: 0.7 },
      { name: "name_en", weight: 0.2 },
      { name: "category", weight: 0.1 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  });
  const { foods, ...meta } = data;
  cache = { foods, fuse, meta };
  return cache;
}

export async function ensureFoods(): Promise<FoodCache> {
  if (cache) return cache;
  if (!inflight) inflight = load();
  return inflight;
}

export async function searchFoods(query: string, limit = 30): Promise<Food[]> {
  const { foods, fuse } = await ensureFoods();
  const q = query.trim();
  if (!q) return foods.slice(0, limit);
  return fuse.search(q, { limit }).map((r) => r.item);
}

export async function getFood(id: string): Promise<Food | undefined> {
  const { foods } = await ensureFoods();
  return foods.find((f) => f.id === id);
}

/** Filter a caller-supplied list of custom foods by the same query. Kept pure
 * (no DB import) so the custom list can be provided by a Dexie live query. */
export function filterCustomFoods(custom: Food[], query: string): Food[] {
  const q = query.trim().toLowerCase();
  if (!q) return custom;
  return custom.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      (f.name_en ?? "").toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q),
  );
}

/** Merge custom-food matches (first) with CREA search results, de-duped, capped. */
export async function searchAllFoods(
  query: string,
  custom: Food[],
  limit = 30,
): Promise<Food[]> {
  const crea = await searchFoods(query, limit);
  const mine = filterCustomFoods(custom, query);
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const f of [...mine, ...crea]) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}
