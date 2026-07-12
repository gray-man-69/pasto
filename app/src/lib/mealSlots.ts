// Presentation + helpers for the breakfast/lunch/dinner/snack grouping on the
// day log. The MealSlot *type* lives in types.ts; this is the runtime side.
import type { MealSlot } from "./types";

export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snacks" },
];

export function isMealSlot(v: unknown): v is MealSlot {
  return v === "breakfast" || v === "lunch" || v === "dinner" || v === "snack";
}

/** A sensible default meal based on the time of day (always changeable). */
export function defaultMealSlot(d = new Date()): MealSlot {
  const h = d.getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack"; // afternoon
  if (h < 22) return "dinner";
  return "snack";
}
