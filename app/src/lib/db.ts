// Local-first storage: the food log and macro goals live in IndexedDB on the
// device (via Dexie). No server, no login.
import Dexie, { type Table } from "dexie";
import type {
  Exercise,
  Food,
  Goals,
  LogEntry,
  Meal,
  MealComponent,
  MealSlot,
  Mesocycle,
  Nutrients,
  Routine,
  Unit,
  Tombstone,
  Water,
  WorkoutSession,
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
  routines!: Table<Routine, number>;
  sessions!: Table<WorkoutSession, number>;
  customExercises!: Table<Exercise, string>;
  mesocycle!: Table<Mesocycle, number>; // v7 singleton (kept only for migration)
  mesocycles!: Table<Mesocycle, number>; // v8: a history of training blocks

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
    // v6 adds strength training: routines (split days), logged sessions, and
    // user-created exercises. Bundled exercises come from a static asset instead.
    this.version(6).stores({
      entries: "++id, date, foodId, mealId, syncId",
      goals: "id",
      meals: "++id, name, syncId",
      customFoods: "id, name, basedOn",
      tombstones: "syncId",
      water: "date, syncId",
      routines: "++id, order, syncId",
      sessions: "++id, date, routineId, syncId",
      customExercises: "id, name, syncId",
    });
    // v7 adds the training block (mesocycle) — a single active block that
    // auto-ramps weekly volume and deloads. Stored as a singleton (id 1).
    this.version(7).stores({
      entries: "++id, date, foodId, mealId, syncId",
      goals: "id",
      meals: "++id, name, syncId",
      customFoods: "id, name, basedOn",
      tombstones: "syncId",
      water: "date, syncId",
      routines: "++id, order, syncId",
      sessions: "++id, date, routineId, syncId",
      customExercises: "id, name, syncId",
      mesocycle: "id",
    });
    // v8 turns the single block into a history of blocks (so past blocks are kept
    // and their progress stays viewable). The old singleton migrates into it.
    this.version(8)
      .stores({
        entries: "++id, date, foodId, mealId, syncId",
        goals: "id",
        meals: "++id, name, syncId",
        customFoods: "id, name, basedOn",
        tombstones: "syncId",
        water: "date, syncId",
        routines: "++id, order, syncId",
        sessions: "++id, date, routineId, syncId",
        customExercises: "id, name, syncId",
        mesocycle: "id",
        mesocycles: "++id, startDate, syncId",
      })
      .upgrade(async (tx) => {
        const old = await tx.table("mesocycle").get(1);
        if (old) {
          const { id: _drop, ...rest } = old as Mesocycle;
          await tx.table("mesocycles").add({
            ...rest,
            syncId: rest.syncId ?? crypto.randomUUID(),
          } as Mesocycle);
          await tx.table("mesocycle").clear();
        }
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
  unit?: Unit;
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

// ---- Training: routines, sessions, custom exercises ------------------------

export function allRoutines() {
  return db.routines.orderBy("order").toArray();
}
export function getRoutine(id: number) {
  return db.routines.get(id);
}
export async function saveRoutine(routine: Routine) {
  const existing = routine.id != null ? await db.routines.get(routine.id) : undefined;
  const syncId = existing?.syncId ?? routine.syncId ?? newSyncId();
  const id = await db.routines.put({ ...routine, syncId, updatedAt: now() });
  touched();
  return id;
}
export async function deleteRoutine(id: number) {
  const r = await db.routines.get(id);
  await db.routines.delete(id);
  if (r?.syncId) await tombstone(r.syncId);
  touched();
}

export function allCustomExercises() {
  return db.customExercises.toArray();
}
export function newCustomExerciseId(): string {
  return `custom-ex-${crypto.randomUUID()}`;
}
export async function saveCustomExercise(ex: Exercise) {
  await db.customExercises.put({ ...ex, custom: true, updatedAt: now() });
  touched();
  return ex.id;
}

export function allSessions() {
  return db.sessions.orderBy("date").reverse().toArray();
}
/** Finished, non-trashed workouts, newest first (by end time). */
export async function completedSessions(): Promise<WorkoutSession[]> {
  const all = await db.sessions.toArray();
  return all
    .filter((s) => s.endedAt && !s.deletedAt)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
}
/** Soft-deleted workouts, most-recently-deleted first (the Trash). */
export async function trashedSessions(): Promise<WorkoutSession[]> {
  const all = await db.sessions.toArray();
  return all.filter((s) => s.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}
export function getSession(id: number) {
  return db.sessions.get(id);
}
/** The in-progress workout, if any (not finished, not trashed). */
export async function activeSession(): Promise<WorkoutSession | undefined> {
  return db.sessions.filter((s) => !s.endedAt && !s.deletedAt).last();
}
export async function saveSession(session: WorkoutSession) {
  const existing = session.id != null ? await db.sessions.get(session.id) : undefined;
  const syncId = existing?.syncId ?? session.syncId ?? newSyncId();
  const id = await db.sessions.put({ ...session, syncId, updatedAt: now() });
  touched();
  return id;
}
/** Soft delete: move a workout to the Trash (recoverable). It stays in the DB —
 * and syncs — carrying a deletedAt, so an accidental delete is never lost. */
export async function deleteSession(id: number) {
  const s = await db.sessions.get(id);
  if (!s) return;
  await db.sessions.update(id, { deletedAt: now(), updatedAt: now() });
  touched();
}
/** Bring a trashed workout back. */
export async function restoreSession(id: number) {
  const s = await db.sessions.get(id);
  if (!s) return;
  await db.sessions.update(id, { deletedAt: undefined, updatedAt: now() });
  touched();
}
/** Permanently remove a workout (tombstoned so the deletion propagates). */
export async function purgeSession(id: number) {
  const s = await db.sessions.get(id);
  await db.sessions.delete(id);
  if (s?.syncId) await tombstone(s.syncId);
  touched();
}

// ---- Mesocycle (a history of training blocks) ------------------------------

/** All blocks, newest first (by start date). */
export function allMesocycles() {
  return db.mesocycles.orderBy("startDate").reverse().toArray();
}
/** The block driving training right now: the one whose window contains today,
 * else the next upcoming scheduled block. Ended/finished blocks don't count. */
export async function activeMesocycle(): Promise<Mesocycle | undefined> {
  const list = (await db.mesocycles.toArray()).filter((m) => !m.endedAt);
  const today = localDate();
  const end = (m: Mesocycle) => addDays(m.startDate, m.weeks * 7);
  const containing = list
    .filter((m) => m.startDate <= today && today < end(m))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  if (containing.length) return containing[0];
  const upcoming = list.filter((m) => m.startDate > today).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return upcoming[0];
}
export async function saveMesocycle(meso: Mesocycle): Promise<number> {
  const existing = meso.id != null ? await db.mesocycles.get(meso.id) : undefined;
  const syncId = existing?.syncId ?? meso.syncId ?? newSyncId();
  const id = await db.mesocycles.put({ ...meso, syncId, updatedAt: now() });
  touched();
  return id;
}
/** End a block early (kept in history, no longer active). */
export async function endMesocycle(id: number) {
  const m = await db.mesocycles.get(id);
  if (!m) return;
  await db.mesocycles.update(id, { endedAt: now(), updatedAt: now() });
  touched();
}
/** Remove a block entirely (tombstoned so the deletion syncs). Workouts are untouched. */
export async function deleteMesocycle(id: number) {
  const m = await db.mesocycles.get(id);
  await db.mesocycles.delete(id);
  if (m?.syncId) await tombstone(m.syncId);
  touched();
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
  water?: Water[];
  routines?: Routine[];
  sessions?: WorkoutSession[];
  customExercises?: Exercise[];
  mesocycles?: Mesocycle[];
}

export async function exportData(): Promise<Backup> {
  const [entries, goals, meals, customFoods, water, routines, sessions, customExercises, mesocycles] =
    await Promise.all([
      db.entries.toArray(),
      db.goals.toArray(),
      db.meals.toArray(),
      db.customFoods.toArray(),
      db.water.toArray(),
      db.routines.toArray(),
      db.sessions.toArray(),
      db.customExercises.toArray(),
      db.mesocycles.toArray(),
    ]);
  return {
    app: "pasto",
    version: 6,
    exportedAt: new Date().toISOString(),
    entries,
    goals,
    meals,
    customFoods,
    water,
    routines,
    sessions,
    customExercises,
    mesocycles,
  };
}

export async function importData(
  data: Partial<Backup>,
): Promise<{ entries: number; meals: number; customFoods: number }> {
  if (data.app && data.app !== "pasto") throw new Error("Not a Pasto backup file.");
  await db.transaction(
    "rw",
    [db.entries, db.goals, db.meals, db.customFoods, db.water, db.routines, db.sessions, db.customExercises, db.mesocycles, db.tombstones],
    async () => {
      if (data.goals?.length) await db.goals.bulkPut(data.goals);
      if (data.meals?.length) await db.meals.bulkPut(data.meals);
      if (data.customFoods?.length) await db.customFoods.bulkPut(data.customFoods);
      if (data.entries?.length) await db.entries.bulkPut(data.entries);
      if (data.water?.length) await db.water.bulkPut(data.water);
      if (data.routines?.length) await db.routines.bulkPut(data.routines);
      if (data.sessions?.length) await db.sessions.bulkPut(data.sessions);
      if (data.customExercises?.length) await db.customExercises.bulkPut(data.customExercises);
      if (data.mesocycles?.length) await db.mesocycles.bulkPut(data.mesocycles);
      // Restoring from a backup should resurrect data — so drop any tombstone
      // for a record the backup brings back (otherwise sync would re-delete it).
      const restored = [
        ...(data.entries ?? []).map((e) => e.syncId),
        ...(data.meals ?? []).map((m) => m.syncId),
        ...(data.customFoods ?? []).map((f) => f.id),
        ...(data.water ?? []).map((w) => w.syncId),
        ...(data.routines ?? []).map((r) => r.syncId),
        ...(data.sessions ?? []).map((s) => s.syncId),
        ...(data.customExercises ?? []).map((x) => x.id),
        ...(data.mesocycles ?? []).map((m) => m.syncId),
      ].filter((k): k is string => !!k);
      if (restored.length) await db.tombstones.bulkDelete(restored);
    },
  );
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

/** Change the amount (and optionally unit) of a logged plain-food entry. */
export async function updateEntryGrams(id: number, grams: number, unit?: Unit) {
  const patch: Partial<LogEntry> = { grams, updatedAt: now() };
  if (unit) patch.unit = unit;
  const r = await db.entries.update(id, patch);
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


// ---- Sync state (read/apply for the cloud sync engine) ---------------------

export interface SyncState {
  goals: Goals | null;
  entries: LogEntry[];
  meals: Meal[];
  customFoods: Food[];
  water: Water[];
  routines: Routine[];
  sessions: WorkoutSession[];
  customExercises: Exercise[];
  mesocycles: Mesocycle[];
  tombstones: Tombstone[];
}

export async function getSyncState(): Promise<SyncState> {
  const [goals, entries, meals, customFoods, water, routines, sessions, customExercises, mesocycles, tombstones] =
    await Promise.all([
      db.goals.get(1),
      db.entries.toArray(),
      db.meals.toArray(),
      db.customFoods.toArray(),
      db.water.toArray(),
      db.routines.toArray(),
      db.sessions.toArray(),
      db.customExercises.toArray(),
      db.mesocycles.toArray(),
      db.tombstones.toArray(),
    ]);
  return { goals: goals ?? null, entries, meals, customFoods, water, routines, sessions, customExercises, mesocycles, tombstones };
}

/** Write a merged state into the local DB. Loss-averse: upserts every alive
 * record, and only deletes records that carry a tombstone. Uses raw table ops so
 * it never re-triggers the local-change handler (no sync loop). Entries/meals are
 * matched by syncId, keeping each device's own numeric id. */
export async function applySyncState(s: SyncState): Promise<void> {
  const dead = new Set(s.tombstones.map((t) => t.syncId));
  await db.transaction(
    "rw",
    [db.entries, db.goals, db.meals, db.customFoods, db.water, db.routines, db.sessions, db.customExercises, db.mesocycles, db.tombstones],
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

      // Routines & sessions: numeric id is device-local, matched by syncId.
      const localRoutines = await db.routines.toArray();
      const rBySync = new Map(localRoutines.filter((r) => r.syncId).map((r) => [r.syncId!, r]));
      for (const r of s.routines) {
        if (!r.syncId || dead.has(r.syncId)) continue;
        const { id: _drop, ...rest } = r;
        const local = rBySync.get(r.syncId);
        if (local) await db.routines.update(local.id!, rest);
        else await db.routines.add(rest as Routine);
      }
      for (const r of localRoutines) if (r.syncId && dead.has(r.syncId)) await db.routines.delete(r.id!);

      const localSessions = await db.sessions.toArray();
      const sBySync = new Map(localSessions.filter((x) => x.syncId).map((x) => [x.syncId!, x]));
      for (const x of s.sessions) {
        if (!x.syncId || dead.has(x.syncId)) continue;
        const { id: _drop, ...rest } = x;
        const local = sBySync.get(x.syncId);
        if (local) await db.sessions.update(local.id!, rest);
        else await db.sessions.add(rest as WorkoutSession);
      }
      for (const x of localSessions) if (x.syncId && dead.has(x.syncId)) await db.sessions.delete(x.id!);

      // Mesocycles (training blocks): numeric id is device-local, matched by syncId.
      const localMesos = await db.mesocycles.toArray();
      const mBySync2 = new Map(localMesos.filter((m) => m.syncId).map((m) => [m.syncId!, m]));
      for (const m of s.mesocycles) {
        if (!m.syncId || dead.has(m.syncId)) continue;
        const { id: _drop, ...rest } = m;
        const local = mBySync2.get(m.syncId);
        if (local) await db.mesocycles.update(local.id!, rest);
        else await db.mesocycles.add(rest as Mesocycle);
      }
      for (const m of localMesos) if (m.syncId && dead.has(m.syncId)) await db.mesocycles.delete(m.id!);

      // Custom exercises: keyed by their own id (like custom foods).
      for (const ex of s.customExercises) {
        if (!dead.has(ex.id)) await db.customExercises.put(ex);
      }
      const localEx = await db.customExercises.toArray();
      for (const ex of localEx) if (dead.has(ex.id)) await db.customExercises.delete(ex.id);
    },
  );
}
