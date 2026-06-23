"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import ComponentsEditor from "@/components/ComponentsEditor";
import { addEntry, allMeals, localDate, logMeal } from "@/lib/db";
import { searchFoods } from "@/lib/foods";
import { scale } from "@/lib/macros";
import type { Food, Meal, MealComponent } from "@/lib/types";

function dayLabel(date: string): string {
  if (date === localDate()) return "today";
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function AddPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => localDate());

  // The day to log to is passed from Today via /add?date=YYYY-MM-DD.
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d) setDate(d);
  }, []);

  const meals = useLiveQuery(() => allMeals(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);
  const [mealDraft, setMealDraft] = useState<{ meal: Meal; components: MealComponent[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    searchFoods(query).then((r) => active && setResults(r));
    return () => {
      active = false;
    };
  }, [query]);

  const preview = useMemo(() => (food ? scale(food.per100g, grams) : null), [food, grams]);

  const back = () => router.push(`/?date=${date}`);

  async function logFood() {
    if (!food) return;
    setSaving(true);
    await addEntry({ date, foodId: food.id, foodName: food.name, grams, per100g: food.per100g });
    back();
  }

  async function logMealInstance() {
    if (!mealDraft || mealDraft.components.length === 0) return;
    setSaving(true);
    await logMeal(mealDraft.meal, date, mealDraft.components);
    back();
  }

  // --- Meal instance editor (tweak a serving before logging) ---
  if (mealDraft) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{mealDraft.meal.name}</h1>
          <button className="btn btn-ghost btn-sm" onClick={() => setMealDraft(null)}>
            ← Back
          </button>
        </div>
        <p className="text-xs text-base-content/50">
          Adjust this serving for <span className="font-medium">{dayLabel(date)}</span> — the saved
          meal won&apos;t change.
        </p>
        <ComponentsEditor
          components={mealDraft.components}
          onChange={(c) => setMealDraft({ ...mealDraft, components: c })}
        />
        <button
          className="btn btn-primary"
          disabled={saving || mealDraft.components.length === 0}
          onClick={logMealInstance}
        >
          Log to {dayLabel(date)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Add to {dayLabel(date)}</h1>
        <Link href={`/?date=${date}`} className="btn btn-ghost btn-sm">
          Done
        </Link>
      </div>

      {/* Your meals */}
      {meals && meals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Your meals
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {meals.map((m) => (
              <button
                key={m.id}
                onClick={() => setMealDraft({ meal: m, components: m.components.map((c) => ({ ...c })) })}
                className="flex shrink-0 flex-col items-start rounded-2xl border border-base-300 bg-base-100 px-3 py-2 text-left hover:border-primary/40"
              >
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-xs text-base-content/50">
                  {Math.round(m.perServing.kcal)} kcal
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Food search */}
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search foods… (e.g. peperoni)"
        className="input input-bordered w-full"
      />

      <ul className="flex flex-col gap-1.5">
        {results.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => {
                setFood(f);
                setGrams(100);
              }}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-left ${
                food?.id === f.id
                  ? "border-primary bg-base-200"
                  : "border-base-300 bg-base-100 hover:border-primary/40"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{f.name}</span>
                <span className="text-xs text-base-content/50">{f.category}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-base-content/60">
                {f.per100g.kcal}
                <span className="text-base-content/30"> kcal/100g</span>
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="py-8 text-center text-base-content/40">No matches.</li>
        )}
      </ul>

      {/* Sticky food portion editor */}
      {food && preview && (
        <div className="fixed bottom-20 left-0 right-0 z-40 mx-auto max-w-md px-4">
          <div className="card border border-base-300 bg-base-100 shadow-lg">
            <div className="card-body gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{food.name}</span>
                <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setFood(null)}>
                  ✕
                </button>
              </div>
              <label className="flex items-center gap-3">
                <span className="text-sm text-base-content/60">Amount</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={grams}
                  onChange={(e) => setGrams(Math.max(0, Number(e.target.value) || 0))}
                  className="input input-bordered input-sm w-24 text-right tabular-nums"
                />
                <span className="text-sm text-base-content/60">g</span>
              </label>
              <div className="grid grid-cols-4 gap-1 text-center text-sm">
                <Stat label="kcal" value={Math.round(preview.kcal)} />
                <Stat label="P" value={preview.protein_g} />
                <Stat label="C" value={preview.carbs_g} />
                <Stat label="F" value={preview.fat_g} />
              </div>
              <button className="btn btn-primary w-full" disabled={saving || grams <= 0} onClick={logFood}>
                {saving ? "Adding…" : `Add to ${dayLabel(date)}`}
              </button>
            </div>
          </div>
        </div>
      )}
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
