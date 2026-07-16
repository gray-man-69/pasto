// Shared domain types. Nutrients are always expressed per 100 g in the food
// database; a logged entry stores a snapshot so totals stay correct even if the
// database is later updated or the food is removed.

export interface Nutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  sugars_g: number;
  fat_g: number;
  saturated_g: number;
  fiber_g: number;
}

export interface Food {
  id: string;
  name: string;
  name_en: string | null;
  category: string;
  per100g: Nutrients;
  // Set on user-created foods stored in IndexedDB (a tweaked CREA value, e.g.
  // "your store's chicken", or something not in the database at all).
  custom?: boolean;
  basedOn?: string; // CREA food id this was derived from, if any
  barcode?: string; // EAN/UPC, for packaged products (bundled or scanned via Open Food Facts)
  // Present on custom foods once synced (id already is a uuid, so it doubles as syncId).
  updatedAt?: number;
}

export interface FoodsFile {
  source: string;
  source_url: string;
  unit: string;
  count: number;
  foods: Food[];
}

// Fields carried by every record that syncs to the cloud. syncId is a globally
// unique id (the local numeric id is device-specific); updatedAt drives
// last-write-wins merges across devices.
export interface Synced {
  syncId?: string;
  updatedAt?: number;
}

// Which part of the day a logged food belongs to. Optional: entries logged
// before this feature (or via the planner) simply have none and show under "Other".
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

// Amount unit for a logged food. Nutrients are per-100-unit either way, so the
// math is identical — this only changes the label (grams for solids, millilitres
// for liquids, whose labels are already "per 100 ml").
export type Unit = "g" | "ml";

export interface LogEntry extends Synced {
  id?: number;
  date: string; // local YYYY-MM-DD
  foodId: string;
  foodName: string;
  grams: number; // amount in `unit` (defaults to grams)
  unit?: Unit; // "g" (default) or "ml" for liquids
  per100g: Nutrients; // snapshot at time of logging
  meal?: MealSlot; // breakfast / lunch / dinner / snack grouping
  mealId?: number; // set when this entry came from logging a saved Meal
  components?: MealComponent[]; // ingredient snapshot for meal entries (editable per-instance)
}

// A deleted record, kept so the deletion propagates to other devices.
export interface Tombstone {
  syncId: string;
  deletedAt: number;
}

// A meal is a reusable, named plate built from foods, with a weekly allowance.
export interface MealComponent {
  foodId: string;
  foodName: string;
  grams: number;
  per100g: Nutrients;
}

export interface Meal extends Synced {
  id?: number;
  name: string;
  weeklyLimit?: number; // deprecated: the per-week "meal allowance" feature was removed
  components: MealComponent[];
  perServing: Nutrients; // computed total of one serving (all components)
}

export interface Goals extends Synced {
  id?: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_glasses: number; // daily water goal, in glasses (~250 ml each)
}

// One water record per day: how many glasses logged. Keyed by date; syncs like
// the rest so it's visible/consistent across devices.
export interface Water extends Synced {
  date: string; // YYYY-MM-DD (primary key)
  glasses: number;
}

// ---- Training --------------------------------------------------------------

export type WeightUnit = "kg" | "lb";
// "warmup" sets don't count toward working volume; "dropset" does (it's a
// working set taken past failure by dropping weight).
export type SetType = "normal" | "warmup" | "dropset";

// An exercise-library record. Bundled ones come from the public-domain
// free-exercise-db (app/public/exercises.json); custom ones live in IndexedDB
// and sync. Muscle groups drive weekly-volume tracking.
export interface Exercise {
  id: string;
  name: string;
  category?: string; // strength, stretching, cardio…
  equipment?: string; // barbell, dumbbell, machine…
  level?: string; // beginner / intermediate / expert
  mechanic?: string; // compound / isolation
  force?: string; // push / pull / static
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  custom?: boolean; // user-created
  updatedAt?: number;
}

// A prescribed exercise inside a routine (a "split day"). Carries the current
// working weight + rep range + increment that the double-progression engine uses.
export interface RoutineExercise {
  exerciseId: string;
  name: string; // snapshot for display
  primaryMuscles: string[]; // snapshot → thumbnails + volume without a lookup
  secondaryMuscles?: string[];
  targetSets: number;
  repMin: number;
  repMax: number;
  weight: number; // current working weight, in `weightUnit`
  weightUnit: WeightUnit;
  increment: number; // load added on a successful double-progression step
  superset?: string; // group id: adjacent exercises sharing it are a superset
  dropset?: boolean; // prescribe the final set as a dropset (marked in the session)
}

// A routine = one day of the split (e.g. "Push A"). User data → syncs.
export interface Routine extends Synced {
  id?: number;
  name: string;
  order: number;
  exercises: RoutineExercise[];
}

// A single performed set inside a logged workout.
export interface PerformedSet {
  weight: number;
  reps: number;
  type?: SetType; // defaults to "normal"; "warmup" sets don't count toward volume
  rpe?: number; // optional reps-in-reserve/effort
  done?: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  name: string; // snapshot
  primaryMuscles?: string[]; // snapshot → thumbnails + volume
  secondaryMuscles?: string[];
  note?: string; // this session's double-progression target hint (auto)
  userNote?: string; // free-text note the user adds during the workout
  superset?: string; // group id: adjacent exercises sharing it are a superset
  lastSummary?: string; // previous session reference, e.g. "20 kg × 8, 8, 7"
  sets: PerformedSet[];
}

// A logged workout. Stores a snapshot of what was performed (like meal entries),
// so history stays correct even if the routine later changes. User data → syncs.
export interface WorkoutSession extends Synced {
  id?: number;
  date: string; // YYYY-MM-DD
  routineId?: number;
  routineName?: string;
  startedAt?: number;
  endedAt?: number; // set when finished; absent = in progress
  deletedAt?: number; // soft-deleted → in Trash, recoverable (absent = live)
  exercises: SessionExercise[];
}
