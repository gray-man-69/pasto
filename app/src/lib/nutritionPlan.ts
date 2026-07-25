// Evidence-based goal → calories → macro planning.
//
// Protein targets follow the hypertrophy / body-composition literature
// (Schoenfeld & Aragon 2018 ISSN review; Helms et al. for dieting): ~1.6–2.2
// g/kg is ample for muscle gain, and protein is pushed higher in a deficit to
// spare lean mass. Fat is held around 25% of calories with an essential-fat
// floor (~0.6 g/kg) for hormonal health; carbohydrate takes the remainder to
// fuel training. Fibre uses the ~14 g per 1000 kcal public-health guideline.

import type { Goals } from "./types";

export type Goal = "cut" | "maintain" | "gain";

export const GOALS: { key: Goal; label: string; kcalAdj: number; proteinPerKg: number; note: string }[] = [
  { key: "cut", label: "Lose fat", kcalAdj: -0.15, proteinPerKg: 2.4, note: "≈15% calorie deficit · high protein to keep muscle" },
  { key: "maintain", label: "Maintain", kcalAdj: 0, proteinPerKg: 2.0, note: "eat around maintenance" },
  { key: "gain", label: "Build muscle", kcalAdj: 0.1, proteinPerKg: 2.0, note: "≈10% calorie surplus for lean gains" },
];

export const goalMeta = (g: Goal) => GOALS.find((x) => x.key === g)!;

const ACT = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 } as const;
export const ACTIVITY: { label: string; value: number }[] = [
  { label: "Sedentary", value: ACT.sedentary },
  { label: "Light", value: ACT.light },
  { label: "Moderate", value: ACT.moderate },
  { label: "Active", value: ACT.active },
];

export type BodyStats = { sex: "m" | "f"; age: number; heightCm: number; weightKg: number; activity: number };

/** Mifflin-St Jeor BMR × activity = maintenance calories (TDEE). */
export function tdee(b: BodyStats): number {
  const bmr = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + (b.sex === "m" ? 5 : -161);
  return bmr * b.activity;
}

export type Macros = { protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };

/** Split a calorie target into macros for a given goal and bodyweight. */
export function macrosFor(kcal: number, weightKg: number, goal: Goal): Macros {
  const meta = goalMeta(goal);
  const protein_g = Math.round(weightKg * meta.proteinPerKg);
  const fatFloor = Math.round(weightKg * 0.6);
  const fat_g = Math.max(fatFloor, Math.round((kcal * 0.25) / 9));
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  const fiber_g = Math.round((14 * kcal) / 1000);
  return { protein_g, carbs_g, fat_g, fiber_g };
}

/** Full goal suggestion: TDEE adjusted for the goal, macros, and water. */
export function suggestGoals(b: BodyStats, goal: Goal): Omit<Goals, "id"> {
  const kcal = Math.round((tdee(b) * (1 + goalMeta(goal).kcalAdj)) / 10) * 10;
  const water_glasses = Math.max(6, Math.round((b.weightKg * 35) / 250)); // ~35 ml/kg, 250 ml glasses
  return { kcal, ...macrosFor(kcal, b.weightKg, goal), water_glasses };
}
