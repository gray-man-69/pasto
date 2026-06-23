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
}

export interface FoodsFile {
  source: string;
  source_url: string;
  unit: string;
  count: number;
  foods: Food[];
}

export interface LogEntry {
  id?: number;
  date: string; // local YYYY-MM-DD
  foodId: string;
  foodName: string;
  grams: number;
  per100g: Nutrients; // snapshot at time of logging
  mealId?: number; // set when this entry came from logging a saved Meal
  components?: MealComponent[]; // ingredient snapshot for meal entries (editable per-instance)
}

// A meal is a reusable, named plate built from foods, with a weekly allowance.
export interface MealComponent {
  foodId: string;
  foodName: string;
  grams: number;
  per100g: Nutrients;
}

export interface Meal {
  id?: number;
  name: string;
  weeklyLimit: number; // how many times per week you allow yourself this meal
  components: MealComponent[];
  perServing: Nutrients; // computed total of one serving (all components)
}

export interface Goals {
  id?: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}
