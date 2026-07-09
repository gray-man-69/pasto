"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import ComponentsEditor from "@/components/ComponentsEditor";
import { allMeals, deleteMeal, saveMeal } from "@/lib/db";
import type { MealComponent } from "@/lib/types";

type Draft = { id?: number; name: string; weeklyLimit: number; components: MealComponent[] };

const EMPTY: Draft = { name: "", weeklyLimit: 3, components: [] };

export default function MealsPage() {
  const meals = useLiveQuery(() => allMeals(), []);
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My meals</h1>
        <Link href="/week" className="btn btn-ghost btn-sm">
          ← Week
        </Link>
      </div>

      {!draft && (
        <button className="btn btn-primary rounded-full" onClick={() => setDraft({ ...EMPTY })}>
          + New meal
        </button>
      )}

      {draft && <MealEditor draft={draft} onClose={() => setDraft(null)} />}

      {!draft && (
        <ul className="flex flex-col gap-2">
          {(meals ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-2xl bg-base-100 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{m.name}</div>
                <div className="text-xs text-base-content/50">
                  {Math.round(m.perServing.kcal)} kcal · P {m.perServing.protein_g} · {m.weeklyLimit}×/week
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    setDraft({ id: m.id, name: m.name, weeklyLimit: m.weeklyLimit, components: m.components })
                  }
                >
                  Edit
                </button>
                <button
                  className="btn btn-ghost btn-xs btn-circle text-error"
                  onClick={() => m.id != null && deleteMeal(m.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
          {meals && meals.length === 0 && (
            <li className="py-8 text-center text-base-content/40">
              No meals yet. Create the dishes you eat often.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function MealEditor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [name, setName] = useState(draft.name);
  const [weeklyLimit, setWeeklyLimit] = useState(draft.weeklyLimit);
  const [components, setComponents] = useState<MealComponent[]>(draft.components);

  async function save() {
    if (!name.trim() || components.length === 0) return;
    await saveMeal({ id: draft.id, name: name.trim(), weeklyLimit, components });
    onClose();
  }

  return (
    <div className="card border border-base-300 bg-base-100">
      <div className="card-body gap-3 p-4">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meal name (e.g. Pasta al pomodoro)"
          className="input input-bordered w-full"
        />
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-base-content/70">Times allowed per week</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={weeklyLimit}
            onChange={(e) => setWeeklyLimit(Math.max(1, Number(e.target.value) || 1))}
            className="input input-bordered input-sm w-20 text-right tabular-nums"
          />
        </label>

        <div className="text-sm font-semibold text-base-content/60">Ingredients</div>
        <ComponentsEditor components={components} onChange={setComponents} />

        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary flex-1"
            disabled={!name.trim() || components.length === 0}
            onClick={save}
          >
            Save meal
          </button>
        </div>
      </div>
    </div>
  );
}
