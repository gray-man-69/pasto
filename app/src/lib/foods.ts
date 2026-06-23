// Loads the bundled food database once and provides fuzzy search.
// foods.json is a static asset built by ../../pipeline/build_foods.py — the app
// never calls a nutrition API for these generic foods.
import Fuse from "fuse.js";
import type { Food, FoodsFile } from "./types";

type FoodCache = { foods: Food[]; fuse: Fuse<Food>; meta: Omit<FoodsFile, "foods"> };

let cache: FoodCache | null = null;
let inflight: Promise<FoodCache> | null = null;

async function load(): Promise<FoodCache> {
  const res = await fetch("/foods.json");
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
