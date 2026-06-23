"use client";

import { useEffect, useState } from "react";
import { computePerServing } from "@/lib/db";
import { searchFoods } from "@/lib/foods";
import { scale } from "@/lib/macros";
import type { Food, MealComponent } from "@/lib/types";

// Controlled editor for a list of ingredients. Used to define a master meal,
// to tweak a meal before logging, and to edit a single logged instance.
export default function ComponentsEditor({
  components,
  onChange,
}: {
  components: MealComponent[];
  onChange: (next: MealComponent[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);

  useEffect(() => {
    if (!query.trim()) return setResults([]);
    let active = true;
    searchFoods(query, 8).then((r) => active && setResults(r));
    return () => {
      active = false;
    };
  }, [query]);

  const perServing = computePerServing(components);

  function addFood(f: Food) {
    onChange([...components, { foodId: f.id, foodName: f.name, grams: 100, per100g: f.per100g }]);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {components.map((c, i) => {
          const m = scale(c.per100g, c.grams);
          return (
            <li key={i} className="flex items-center gap-2 rounded-2xl bg-base-200 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{c.foodName}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={c.grams}
                onChange={(e) =>
                  onChange(
                    components.map((x, idx) =>
                      idx === i ? { ...x, grams: Math.max(0, Number(e.target.value) || 0) } : x,
                    ),
                  )
                }
                className="input input-bordered input-xs w-16 text-right tabular-nums"
              />
              <span className="text-xs text-base-content/50">g</span>
              <span className="w-14 text-right text-xs tabular-nums text-base-content/50">
                {Math.round(m.kcal)} kcal
              </span>
              <button
                className="btn btn-ghost btn-xs btn-circle text-error"
                onClick={() => onChange(components.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${c.foodName}`}
              >
                ✕
              </button>
            </li>
          );
        })}
        {components.length === 0 && (
          <li className="py-2 text-center text-sm text-base-content/40">No ingredients yet.</li>
        )}
      </ul>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add ingredient…"
        className="input input-bordered input-sm w-full"
      />
      {results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => addFood(f)}
                className="flex w-full items-center justify-between rounded-xl border border-base-300 bg-base-100 px-3 py-1.5 text-left text-sm hover:border-primary/40"
              >
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-base-content/50">{f.per100g.kcal} kcal/100g</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-4 gap-1 text-center text-sm">
        <Stat label="kcal" value={Math.round(perServing.kcal)} />
        <Stat label="P" value={perServing.protein_g} />
        <Stat label="C" value={perServing.carbs_g} />
        <Stat label="F" value={perServing.fat_g} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-base-200 py-1.5">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-base-content/50">{label}</div>
    </div>
  );
}
