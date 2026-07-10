// Pure macro math — no I/O, easy to unit test.
import type { Nutrients } from "./types";

export const NUTRIENT_KEYS: (keyof Nutrients)[] = [
  "kcal",
  "protein_g",
  "carbs_g",
  "sugars_g",
  "fat_g",
  "saturated_g",
  "fiber_g",
];

export function emptyNutrients(): Nutrients {
  return {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    sugars_g: 0,
    fat_g: 0,
    saturated_g: 0,
    fiber_g: 0,
  };
}

/** Scale a per-100g nutrient profile to an arbitrary gram amount. */
export function scale(per100g: Nutrients, grams: number): Nutrients {
  const factor = grams / 100;
  const out = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    out[key] = round(per100g[key] * factor);
  }
  return out;
}

/** Sum a list of nutrient profiles (e.g. all entries logged for a day). */
export function sum(items: Nutrients[]): Nutrients {
  const out = emptyNutrients();
  for (const item of items) {
    for (const key of NUTRIENT_KEYS) {
      out[key] += item[key];
    }
  }
  for (const key of NUTRIENT_KEYS) {
    out[key] = round(out[key]);
  }
  return out;
}

/** Remaining toward a goal — never below zero. */
export function remaining(goal: number, consumed: number): number {
  return Math.max(0, round(goal - consumed));
}

export function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Display a nutrient value: whole number if it's whole, otherwise one decimal.
 * Used so a total shown to the user equals the sum of the parts shown. */
export function fmtNum(n: number): string {
  const r = round(n);
  return Number.isInteger(r) ? `${r}` : r.toFixed(1);
}
