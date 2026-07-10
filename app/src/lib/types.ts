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

export interface LogEntry extends Synced {
  id?: number;
  date: string; // local YYYY-MM-DD
  foodId: string;
  foodName: string;
  grams: number;
  per100g: Nutrients; // snapshot at time of logging
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
  weeklyLimit: number; // how many times per week you allow yourself this meal
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
