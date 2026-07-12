"use client";

import { MEAL_SLOTS } from "@/lib/mealSlots";
import type { MealSlot } from "@/lib/types";

// A four-way segmented control for choosing a meal slot. `value` may be null
// (e.g. an old, ungrouped entry) — then nothing is highlighted until picked.
export default function MealPicker({
  value,
  onChange,
}: {
  value: MealSlot | null;
  onChange: (m: MealSlot) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {MEAL_SLOTS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`flex-1 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors ${
            value === s.id
              ? "bg-primary text-primary-content"
              : "bg-base-200 text-base-content/60 hover:bg-base-300"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
