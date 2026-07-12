// Local-first storage: the food log and macro goals live in IndexedDB on the
// device (via Dexie). No server, no login.
import Dexie, { type Table } from "dexie";
import type {
  Food,
  Goals,
  LogEntry,
  Meal,
  MealComponent,
  MealSlot,
  Nutrients,
  Tombstone,
  Water,
} from "./types";
import { scale, sum } from "./macros";

const DEFAULT_GOALS: Goals = {
  id: 1,
  kcal: 2000,
  protein_g: 150,
  carbs_g: 200,
  fat_g: 60,
  fiber_g: 30,
  water_glasses: 8,
};

class PastoDB extends Dexie {
  entries!: Table<LogEntry, number>;
  goals!: Table<Goals, number>;
  meals!: Table<Meal, number>;
  customFoods!: Table<Food, string>;
  tombstones!: Table<Tombstone, string>;
  water!: Table<Water, string>;

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
    this.version(3).stores({
      entries: "++id, date, foodId, mealId",
      goals: "id",
      meals: "++id, name",
      customFoods: "id, name, basedOn",
    });
    // v4 adds cross-device sync: a globally-unique syncId on each record (the
    // numeric id stays device-local) and a tombstones table so deletions travel.
    this.version(4)
      .stores({
        entries: "++id, date, foodId, mealId, syncId",
        goals: "id",
        meals: "++id, name, syncId",
        customFoods: "id, name, basedOn",
        tombstones: "syncId",
      })
      .upgrade(async (tx) => {
        const stamp = Date.now();
        for (const name of ["entries", "meals"]) {
          await tx
            .table(name)
            .toCollection()
            .modify((r: LogEntry | Meal) => {
              if (!r.syncId) r.syncId = crypto.randomUUID();
              if (!r.updatedAt) r.updatedAt = stamp;
            });
        }
        await tx.table("customFoods").toCollection().modify((r: Food) => {
          if (!r.updatedAt) r.updatedAt = stamp;
        });
        await tx.table("goals").toCollection().modify((r: Goals) => {
          r.syncId = "goals";
          if (!r.updatedAt) r.updatedAt = stamp;
        });
      });
    // v5 adds water tracking (one record per day, keyed by date).
    this.version(5).stores({
      entries: "++id, date, foodId, mealId, syncId",
      goals: "id",
      meals: "++id, name, syncId",
      customFoods: "id, name, basedOn",
      tombstones: "syncId",
      water: "date, syncId",
    });
  }
}

export const db = new PastoDB();

// ---- Sync plumbing ---------------------------------------------------------
// Writes stamp a syncId/updatedAt and notify the (optional) sync engine. When
// no one is signed in, this is a no-op and the app behaves exactly as before.

const now = () => Date.now();
export function newSyncId(): string {
  return crypto.randomUUID();
}

let localChangeHandler: (() => void) | null = null;
/** The sync engine registers here to be pinged after any local write. */
export function onLocalChange(fn: (() => void) | null) {
  localChangeHandler = fn;
}
function touched() {
  localChangeHandler?.();
}
async function tombstone(syncId: string) {
  await db.tombstones.put({ syncId, deletedAt: now() });
}

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
  meal?: MealSlot;
}) {
  const id = await db.entries.add({ ...entry, syncId: newSyncId(), updatedAt: now() });
  touched();
  return id;
}

/** Move a logged entry into a meal group (breakfast/lunch/dinner/snack). */
export async function updateEntryMeal(id: number, meal: MealSlot) {
  const r = await db.entries.update(id, { meal, updatedAt: now() });
  touched();
  return r;
}

export async function deleteEntry(id: number) {
  const e = await db.entries.get(id);
  await db.entries.delete(id);
  if (e?.syncId) await tombstone(e.syncId);
  touched();
}

// Read-only on purpose: this runs inside useLiveQuery's tracking transaction,
// where a write would throw. Defaults are only persisted on an explicit save.
export async function getGoals(): Promise<Goals> {
  const existing = await db.goals.get(1);
  // Merge over defaults so goals saved before a new field existed still work.
  return { ...DEFAULT_GOALS, ...existing };
}

export async function saveGoals(goals: Omit<Goals, "id">) {
  const r = await db.goals.put({ ...goals, id: 1, syncId: "goals", updatedAt: now() });
  touched();
  return r;
}

// ---- Water -----------------------------------------------------------------

export function waterForDate(date: string) {
  return db.water.get(date);
}

/** Add (or remove) glasses of water for a day; never goes below zero. */
export async function addGlasses(date: string, delta: number): Promise<number> {
  const cur = await db.water.get(date);
  const glasses = Math.max(0, (cur?.glasses ?? 0) + delta);
  await db.water.put({ date, glasses, syncId: cur?.syncId ?? `water-${date}`, updatedAt: now() });
  touched();
  return glasses;
}

// ---- Backup & restore ------------------------------------------------------
// Local-first data lives only in this browser's IndexedDB. Export writes a JSON
// snapshot the user can save anywhere; import merges one back in (idempotent —
// re-importing the same file overwrites by id rather than duplicating).

export interface Backup {
  app: "pasto";
  version: number;
  exportedAt: string;
  entries: LogEntry[];
  goals: Goals[];
  meals: Meal[];
  customFoods: Food[];
}

export async function exportData(): Promise<Backup> {
  const [entries, goals, meals, customFoods] = await Promise.all([
    db.entries.toArray(),
    db.goals.toArray(),
    db.meals.toArray(),
    db.customFoods.toArray(),
  ]);
  return {
    app: "pasto",
    version: 3,
    exportedAt: new Date().toISOString(),
    entries,
    goals,
    meals,
    customFoods,
  };
}

export async function importData(
  data: Partial<Backup>,
): Promise<{ entries: number; meals: number; customFoods: number }> {
  if (data.app && data.app !== "pasto") throw new Error("Not a Pasto backup file.");
  await db.transaction("rw", db.entries, db.goals, db.meals, db.customFoods, async () => {
    if (data.goals?.length) await db.goals.bulkPut(data.goals);
    if (data.meals?.length) await db.meals.bulkPut(data.meals);
    if (data.customFoods?.length) await db.customFoods.bulkPut(data.customFoods);
    if (data.entries?.length) await db.entries.bulkPut(data.entries);
  });
  return {
    entries: data.entries?.length ?? 0,
    meals: data.meals?.length ?? 0,
    customFoods: data.customFoods?.length ?? 0,
  };
}

// ---- Custom foods ----------------------------------------------------------
// User-owned foods living in IndexedDB: a tweaked copy of a CREA value (e.g.
// your store's chicken) or something new entirely. They rank above CREA foods
// in search and are always editable.

export function allCustomFoods() {
  return db.customFoods.orderBy("name").toArray();
}

export function newCustomFoodId(): string {
  return `custom-${crypto.randomUUID()}`;
}

export async function saveCustomFood(food: Food) {
  const r = await db.customFoods.put({ ...food, custom: true, updatedAt: now() });
  touched();
  return r;
}

export async function deleteCustomFood(id: string) {
  await db.customFoods.delete(id);
  await tombstone(id); // a custom food's id is itself the global syncId
  touched();
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
  const existing = meal.id != null ? await db.meals.get(meal.id) : undefined;
  const syncId = existing?.syncId ?? meal.syncId ?? newSyncId();
  const r = await db.meals.put({ ...meal, perServing, syncId, updatedAt: now() });
  touched();
  return r;
}

export async function deleteMeal(id: number) {
  const m = await db.meals.get(id);
  await db.meals.delete(id);
  if (m?.syncId) await tombstone(m.syncId);
  touched();
}

/** Log a meal for a day, storing an editable snapshot of its ingredients.
 * Feeds daily totals AND the weekly count. `components` defaults to the meal's
 * own ingredients but can be a per-instance edit (e.g. 200g chicken not 300g). */
export async function logMeal(
  meal: Meal,
  date: string = localDate(),
  components: MealComponent[] = meal.components,
  slot?: MealSlot,
) {
  const id = await db.entries.add({
    date,
    foodId: `meal-${meal.id}`,
    foodName: meal.name,
    grams: 100, // per100g holds the per-serving macros, so 100g === 1 serving
    per100g: computePerServing(components),
    meal: slot,
    mealId: meal.id,
    components,
    syncId: newSyncId(),
    updatedAt: now(),
  });
  touched();
  return id;
}

/** Re-edit one logged meal instance (its ingredients) without touching the master meal. */
export async function updateEntryComponents(id: number, components: MealComponent[]) {
  const r = await db.entries.update(id, {
    components,
    per100g: computePerServing(components),
    updatedAt: now(),
  });
  touched();
  return r;
}

/** Change the grams of a logged plain-food entry. */
export async function updateEntryGrams(id: number, grams: number) {
  const r = await db.entries.update(id, { grams, updatedAt: now() });
  touched();
  return r;
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

/** Per-day summed nutrient totals for [start, end] (inclusive). Only days with
 * at least one logged entry appear in the map — callers treat a missing day as
 * "not tracked", so it never drags an average toward zero. */
export async function dailyTotalsBetween(
  start: string,
  end: string,
): Promise<Map<string, Nutrients>> {
  const rows = await db.entries.where("date").between(start, end, true, true).toArray();
  const map = new Map<string, Nutrients>();
  for (const r of rows) {
    const scaled = scale(r.per100g, r.grams);
    const cur = map.get(r.date);
    map.set(r.date, cur ? sum([cur, scaled]) : scaled);
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

// ---- Sync state (read/apply for the cloud sync engine) ---------------------

export interface SyncState {
  goals: Goals | null;
  entries: LogEntry[];
  meals: Meal[];
  customFoods: Food[];
  water: Water[];
  tombstones: Tombstone[];
}

export async function getSyncState(): Promise<SyncState> {
  const [goals, entries, meals, customFoods, water, tombstones] = await Promise.all([
    db.goals.get(1),
    db.entries.toArray(),
    db.meals.toArray(),
    db.customFoods.toArray(),
    db.water.toArray(),
    db.tombstones.toArray(),
  ]);
  return { goals: goals ?? null, entries, meals, customFoods, water, tombstones };
}

/** Write a merged state into the local DB. Loss-averse: upserts every alive
 * record, and only deletes records that carry a tombstone. Uses raw table ops so
 * it never re-triggers the local-change handler (no sync loop). Entries/meals are
 * matched by syncId, keeping each device's own numeric id. */
export async function applySyncState(s: SyncState): Promise<void> {
  const dead = new Set(s.tombstones.map((t) => t.syncId));
  await db.transaction(
    "rw",
    [db.entries, db.goals, db.meals, db.customFoods, db.water, db.tombstones],
    async () => {
      if (s.tombstones.length) await db.tombstones.bulkPut(s.tombstones);
      if (s.goals) await db.goals.put({ ...s.goals, id: 1 });

      for (const w of s.water) {
        if (!w.syncId || dead.has(w.syncId)) continue;
        await db.water.put(w);
      }

      const localEntries = await db.entries.toArray();
      const eBySync = new Map(localEntries.filter((e) => e.syncId).map((e) => [e.syncId!, e]));
      for (const e of s.entries) {
        if (!e.syncId || dead.has(e.syncId)) continue;
        const { id: _drop, ...rest } = e;
        const local = eBySync.get(e.syncId);
        if (local) await db.entries.update(local.id!, rest);
        else await db.entries.add(rest as LogEntry);
      }
      for (const e of localEntries) if (e.syncId && dead.has(e.syncId)) await db.entries.delete(e.id!);

      const localMeals = await db.meals.toArray();
      const mBySync = new Map(localMeals.filter((m) => m.syncId).map((m) => [m.syncId!, m]));
      for (const m of s.meals) {
        if (!m.syncId || dead.has(m.syncId)) continue;
        const { id: _drop, ...rest } = m;
        const local = mBySync.get(m.syncId);
        if (local) await db.meals.update(local.id!, rest);
        else await db.meals.add(rest as Meal);
      }
      for (const m of localMeals) if (m.syncId && dead.has(m.syncId)) await db.meals.delete(m.id!);

      for (const f of s.customFoods) {
        if (!dead.has(f.id)) await db.customFoods.put(f);
      }
      const localFoods = await db.customFoods.toArray();
      for (const f of localFoods) if (dead.has(f.id)) await db.customFoods.delete(f.id);
    },
  );
}
