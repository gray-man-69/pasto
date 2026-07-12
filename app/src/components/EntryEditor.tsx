"use client";

import { useState } from "react";
import ComponentsEditor from "@/components/ComponentsEditor";
import MealPicker from "@/components/MealPicker";
import NumberField from "@/components/NumberField";
import UnitToggle from "@/components/UnitToggle";
import {
  deleteEntry,
  updateEntryComponents,
  updateEntryGrams,
  updateEntryMeal,
} from "@/lib/db";
import { isMealSlot } from "@/lib/mealSlots";
import { scale } from "@/lib/macros";
import type { LogEntry, MealComponent, MealSlot, Unit } from "@/lib/types";

// Edit a single logged entry. Meal entries edit their ingredient snapshot
// (this instance only); plain foods edit grams. Both can be deleted.
export default function EntryEditor({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const isMeal = Array.isArray(entry.components);
  const [components, setComponents] = useState<MealComponent[]>(entry.components ?? []);
  const [grams, setGrams] = useState(entry.grams);
  const [unit, setUnit] = useState<Unit>(entry.unit ?? "g");
  const [meal, setMeal] = useState<MealSlot | null>(isMealSlot(entry.meal) ? entry.meal : null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (entry.id == null) return;
    setBusy(true);
    if (isMeal) await updateEntryComponents(entry.id, components);
    else await updateEntryGrams(entry.id, grams, unit);
    if (meal && meal !== entry.meal) await updateEntryMeal(entry.id, meal);
    onClose();
  }

  async function remove() {
    if (entry.id == null) return;
    setBusy(true);
    await deleteEntry(entry.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-base-100 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{entry.foodName}</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {isMeal ? (
          <ComponentsEditor components={components} onChange={setComponents} />
        ) : (
          <label className="flex items-center gap-3 py-2">
            <span className="text-sm text-base-content/60">Amount</span>
            <NumberField
              inputMode="numeric"
              min={0}
              value={grams}
              onChange={setGrams}
              className="input input-bordered input-sm w-24 text-right tabular-nums"
              autoFocus
            />
            <UnitToggle value={unit} onChange={setUnit} />
            <span className="ml-auto text-sm tabular-nums text-base-content/50">
              {Math.round(scale(entry.per100g, grams).kcal)} kcal
            </span>
          </label>
        )}

        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-medium text-base-content/50">Meal</span>
          <MealPicker value={meal} onChange={setMeal} />
        </div>

        <div className="mt-3 flex gap-2">
          <button className="btn btn-ghost flex-1 text-error" disabled={busy} onClick={remove}>
            Delete
          </button>
          <button className="btn btn-primary flex-1" disabled={busy} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
