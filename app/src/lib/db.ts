// Local-first storage: the food log and macro goals live in IndexedDB on the
// device (via Dexie). No server, no login.
import Dexie, { type Table } from "dexie";
import type { Goals, LogEntry, Meal, MealComponent, Nutrients } from "./types";
import { scale, sum } from "./macros";

const DEFAULT_GOALS: Goals = {
  id: 1,
  kcal: 2000,
  protein_g: 150,
  carbs_g: 200,
  fat_g: 60,
  fiber_g: 30,
};

class PastoDB extends Dexie {
  entries!: Table<LogEntry, number>;
  goals!: Table<Goals, number>;
  meals!: Table<Meal, number>;

  constructor() {
    super("pasto");
    // indexed fields only; other props are stored but not indexed
    this.version(1).stores({
      entries: "++id, date, foodId",
      goals: "id",
    });
    this.version(2).stores({
      entries: "++id, date, foodId, mealId",
      goals: "id",
      meals: "++id, name",
    });
  }
}

export const db = new PastoDB();

/** Local YYYY-MM-DD for a given date (defaults to now). */
export function localDate(d: Date = new Date()): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function entriesForDate(date: string) {
  return db.entries.where("date").equals(date).toArray();
}

export async function addEntry(entry: {
  date: string;
  foodId: string;
  foodName: string;
  grams: number;
  per100g: Nutrients;
}) {
  return db.entries.add(entry);
}

export async function deleteEntry(id: number) {
  return db.entries.delete(id);
}

// Read-only on purpose: this runs inside useLiveQuery's tracking transaction,
// where a write would throw. Defaults are only persisted on an explicit save.
export async function getGoals(): Promise<Goals> {
  const existing = await db.goals.get(1);
  // Merge over defaults so goals saved before a new field existed still work.
  return { ...DEFAULT_GOALS, ...existing };
}

export async function saveGoals(goals: Omit<Goals, "id">) {
  return db.goals.put({ ...goals, id: 1 });
}

// ---- Meals ----------------------------------------------------------------

/** Total nutrients of one serving = sum of all its components, scaled by grams. */
export function computePerServing(components: MealComponent[]): Nutrients {
  return sum(components.map((c) => scale(c.per100g, c.grams)));
}

export function allMeals() {
  return db.meals.orderBy("name").toArray();
}

export function getMeal(id: number) {
  return db.meals.get(id);
}

export async function saveMeal(meal: Omit<Meal, "perServing">) {
  const perServing = computePerServing(meal.components);
  return db.meals.put({ ...meal, perServing });
}

export async function deleteMeal(id: number) {
  return db.meals.delete(id);
}

/** Log a meal for a day, storing an editable snapshot of its ingredients.
 * Feeds daily totals AND the weekly count. `components` defaults to the meal's
 * own ingredients but can be a per-instance edit (e.g. 200g chicken not 300g). */
export async function logMeal(
  meal: Meal,
  date: string = localDate(),
  components: MealComponent[] = meal.components,
) {
  return db.entries.add({
    date,
    foodId: `meal-${meal.id}`,
    foodName: meal.name,
    grams: 100, // per100g holds the per-serving macros, so 100g === 1 serving
    per100g: computePerServing(components),
    mealId: meal.id,
    components,
  });
}

/** Re-edit one logged meal instance (its ingredients) without touching the master meal. */
export async function updateEntryComponents(id: number, components: MealComponent[]) {
  return db.entries.update(id, { components, per100g: computePerServing(components) });
}

/** Change the grams of a logged plain-food entry. */
export async function updateEntryGrams(id: number, grams: number) {
  return db.entries.update(id, { grams });
}

// ---- Weeks (Monday–Sunday, local) -----------------------------------------

/** Monday (YYYY-MM-DD) of the week containing `date`. */
export function weekStart(date: string = localDate()): string {
  const d = new Date(date + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return localDate(d);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDate(d);
}

/** Total kcal logged for each day in [start, end] (inclusive). */
export async function dailyKcalBetween(
  start: string,
  end: string,
): Promise<Map<string, number>> {
  const rows = await db.entries.where("date").between(start, end, true, true).toArray();
  const map = new Map<string, number>();
  for (const r of rows) {
    const kcal = scale(r.per100g, r.grams).kcal;
    map.set(r.date, (map.get(r.date) ?? 0) + kcal);
  }
  return map;
}

/** How many times each meal has been logged in the week containing `date`. */
export async function weeklyMealCounts(
  date: string = localDate(),
): Promise<Map<number, number>> {
  const start = weekStart(date);
  const end = addDays(start, 6);
  const rows = await db.entries
    .where("date")
    .between(start, end, true, true)
    .toArray();
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (r.mealId != null) counts.set(r.mealId, (counts.get(r.mealId) ?? 0) + 1);
  }
  return counts;
}
