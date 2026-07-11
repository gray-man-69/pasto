"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import NumberField from "@/components/NumberField";
import { addEntry, allCustomFoods, allMeals, getGoals, localDate, logMeal } from "@/lib/db";
import { searchAllFoods } from "@/lib/foods";
import { fmtNum, scale, sum } from "@/lib/macros";
import { balanceDay, dayStatus, KCAL_TOL, type BalanceItem } from "@/lib/balance";
import type { Food, Goals, Meal, Nutrients } from "@/lib/types";

// Default upper bound (grams) per food, by CREA category, so the optimiser can't
// pile on 455 g of onion. Editable per row; a category miss falls back to 300 g.
const MAX_BY_CATEGORY: Record<string, number> = {
  "Oli e grassi": 30,
  Dolci: 60,
  "Frutta secca": 60,
  "Cereali e derivati": 200,
  Ortaggi: 250,
  Frutta: 300,
  Legumi: 300,
  "Latte e derivati": 300,
  Carni: 350,
  Pesci: 350,
  Uova: 300,
};
const defaultMax = (category: string) => MAX_BY_CATEGORY[category] ?? 300;
const MEAL_MAX_SERVINGS = 3;

type FoodRow = { key: string; kind: "food"; food: Food; amount: number; locked: boolean; max: number };
type MealRow = { key: string; kind: "meal"; meal: Meal; amount: number; locked: boolean; max: number };
type Row = FoodRow | MealRow;

const perGram = (n: Nutrients): Nutrients => ({
  kcal: n.kcal / 100,
  protein_g: n.protein_g / 100,
  carbs_g: n.carbs_g / 100,
  sugars_g: n.sugars_g / 100,
  fat_g: n.fat_g / 100,
  saturated_g: n.saturated_g / 100,
  fiber_g: n.fiber_g / 100,
});

/** Nutrients contributed by a row at its current amount. */
function rowNutrients(r: Row): Nutrients {
  return r.kind === "food" ? scale(r.food.per100g, r.amount) : scale(r.meal.perServing, r.amount * 100);
}

const METRICS = [
  { key: "kcal", label: "Calories", unit: "kcal", color: "bg-primary" },
  { key: "protein_g", label: "Protein", unit: "g", color: "bg-rose-400" },
  { key: "carbs_g", label: "Carbs", unit: "g", color: "bg-amber-400" },
  { key: "fat_g", label: "Fat", unit: "g", color: "bg-sky-400" },
  { key: "fiber_g", label: "Fiber", unit: "g", color: "bg-emerald-400" },
] as const;

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function dayLabel(date: string): string {
  if (date === localDate()) return "today";
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function PlanPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => localDate());
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d) setDate(d);
  }, []);

  const goals = useLiveQuery(() => getGoals(), []);
  const customFoods = useLiveQuery(() => allCustomFoods(), []);
  const meals = useLiveQuery(() => allMeals(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [balanced, setBalanced] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let active = true;
    searchAllFoods(query, customFoods ?? [], 8).then((r) => active && setResults(r));
    return () => {
      active = false;
    };
  }, [query, customFoods]);

  const totals = useMemo(() => sum(rows.map(rowNutrients)), [rows]);
  // Sum of each row's displayed (whole-number) kcal, so the total matches the rows.
  const shownKcal = useMemo(
    () => rows.reduce((s, r) => s + Math.round(rowNutrients(r).kcal), 0),
    [rows],
  );
  const status = goals ? dayStatus(totals, goals) : null;

  function addFood(f: Food) {
    if (!rows.some((r) => r.key === f.id)) {
      setRows([
        ...rows,
        { key: f.id, kind: "food", food: f, amount: 100, locked: false, max: defaultMax(f.category) },
      ]);
      setBalanced(false);
    }
    setQuery("");
    setResults([]);
  }
  function addMeal(m: Meal) {
    const key = `meal-${m.id}`;
    if (rows.some((r) => r.key === key)) return;
    setRows([...rows, { key, kind: "meal", meal: m, amount: 1, locked: false, max: MEAL_MAX_SERVINGS }]);
    setBalanced(false);
  }
  const patch = (i: number, p: Partial<Row>) =>
    setRows(rows.map((r, idx) => (idx === i ? ({ ...r, ...p } as Row) : r)));
  const remove = (i: number) => {
    setRows(rows.filter((_, idx) => idx !== i));
    setBalanced(false);
  };

  function balance() {
    if (!goals || rows.length === 0) return;
    const items: BalanceItem[] = rows.map((r) => {
      const per = r.kind === "food" ? perGram(r.food.per100g) : r.meal.perServing;
      const step = r.kind === "food" ? 1 : 0.25;
      return r.locked
        ? { per, min: r.amount, max: r.amount, step }
        : { per, min: 0, max: r.max, step };
    });
    const amounts = balanceDay(items, goals);
    setRows(rows.map((r, i) => ({ ...r, amount: amounts[i] }) as Row));
    setBalanced(true);
  }

  async function logAll() {
    const toLog = rows.filter((r) => r.amount > 0);
    if (toLog.length === 0) return;
    setSaving(true);
    for (const r of toLog) {
      if (r.kind === "food") {
        await addEntry({ date, foodId: r.food.id, foodName: r.food.name, grams: r.amount, per100g: r.food.per100g });
      } else {
        const scaled = r.meal.components.map((c) => ({ ...c, grams: c.grams * r.amount }));
        await logMeal(r.meal, date, scaled);
      }
    }
    router.push(`/?date=${date}`);
  }

  const availableMeals = (meals ?? []).filter((m) => !rows.some((r) => r.key === `meal-${m.id}`));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Plan {dayLabel(date)}</h1>
          <p className="mt-0.5 text-xs text-base-content/50">
            Add what you&apos;ll eat, then Pasto works out the grams to hit your goals — within ±
            {KCAL_TOL} kcal, protein &amp; fiber at least target. Lock an amount to fix it; cap a food
            so it can&apos;t run away.
          </p>
        </div>
        <Link href={`/?date=${date}`} className="btn btn-ghost btn-sm shrink-0">
          Done
        </Link>
      </div>

      {/* Your meals */}
      {availableMeals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Your meals
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableMeals.map((m) => (
              <button
                key={m.id}
                onClick={() => addMeal(m)}
                className="flex shrink-0 flex-col items-start rounded-2xl border border-base-300 bg-base-100 px-3 py-2 text-left transition-colors hover:border-primary/50"
              >
                <span className="text-sm font-medium">＋ {m.name}</span>
                <span className="text-xs text-base-content/50">{Math.round(m.perServing.kcal)} kcal / serving</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add food */}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a food…"
          className="input input-bordered w-full"
        />
        {results.length > 0 && (
          <ul className="absolute z-30 mt-1 flex w-full flex-col gap-0.5 rounded-2xl border border-base-300 bg-base-100 p-1 shadow-2xl">
            {results.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => addFood(f)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-base-200"
                >
                  <span className="min-w-0 truncate">
                    {f.name}
                    {f.custom && <span className="ml-1 text-[10px] text-primary">· custom</span>}
                  </span>
                  <span className="shrink-0 pl-2 text-xs text-base-content/50">
                    {Math.round(f.per100g.kcal)} kcal/100g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chosen items */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 py-10 text-center text-sm text-base-content/40">
          No items yet. Add the foods &amp; meals you plan to eat.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => {
            const m = rowNutrients(r);
            const isMeal = r.kind === "meal";
            const unit = isMeal ? "srv" : "g";
            return (
              <li
                key={r.key}
                className="flex flex-col gap-2 rounded-2xl border border-base-300/60 bg-base-100 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {isMeal ? r.meal.name : r.food.name}
                      </span>
                      {isMeal && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          meal
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-base-content/40">
                      {Math.round(m.kcal)} kcal · P {m.protein_g} / C {m.carbs_g} / F {m.fat_g} / Fib{" "}
                      {m.fiber_g}
                    </div>
                  </div>
                  <NumberField
                    min={0}
                    value={r.amount}
                    onChange={(n) => patch(i, { amount: n })}
                    className="input input-bordered input-sm w-20 text-right tabular-nums"
                  />
                  <span className="w-6 text-xs text-base-content/40">{unit}</span>
                  <button
                    onClick={() => patch(i, { locked: !r.locked })}
                    title={r.locked ? "Locked — kept fixed when balancing" : "Lock this amount"}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      r.locked ? "bg-primary/15 text-primary" : "text-base-content/40 hover:bg-base-300/60"
                    }`}
                  >
                    {r.locked ? <LockIcon /> : <UnlockIcon />}
                  </button>
                  <button
                    onClick={() => remove(i)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base-content/30 hover:bg-base-300/60 hover:text-error"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
                {!r.locked && (
                  <label className="flex items-center gap-2 pl-1 text-xs text-base-content/40">
                    max
                    <NumberField
                      min={0}
                      value={r.max}
                      onChange={(n) => patch(i, { max: n })}
                      className="input input-bordered input-xs w-16 text-right tabular-nums"
                    />
                    {unit}
                    <span className="text-base-content/25">· upper limit when balancing</span>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <button onClick={balance} disabled={!goals} className="btn btn-primary rounded-full">
          ⚖ Balance to my goals
        </button>
      )}

      {/* Totals vs goals */}
      {rows.length > 0 && goals && (
        <section className="flex flex-col gap-4 rounded-3xl border border-base-300 bg-base-100 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
            {balanced ? "Balanced total" : "Current total"}
          </div>
          <div className="flex flex-col gap-3">
            {METRICS.map((mm) => {
              const isKcal = mm.key === "kcal";
              const val = isKcal ? shownKcal : totals[mm.key];
              const goal = goals[mm.key] || 0;
              const pct = goal > 0 ? Math.min(100, (val / goal) * 100) : 0;
              return (
                <div key={mm.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${mm.color}`} />
                      <span className="font-medium">{mm.label}</span>
                    </span>
                    <span className="tabular-nums">
                      <span className="font-semibold">{isKcal ? fmt(val) : fmtNum(val)}</span>
                      <span className="text-base-content/40">
                        {" "}
                        / {fmt(goal)} {mm.unit}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-300/60">
                    <div className={`h-full rounded-full ${mm.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {balanced && status && <StatusBanner status={status} totals={totals} goals={goals} />}
        </section>
      )}

      {balanced && rows.some((r) => r.amount > 0) && (
        <button onClick={logAll} disabled={saving} className="btn btn-primary">
          {saving ? "Logging…" : `Log all to ${dayLabel(date)}`}
        </button>
      )}
    </div>
  );
}

function StatusBanner({
  status,
  totals,
  goals,
}: {
  status: ReturnType<typeof dayStatus>;
  totals: Nutrients;
  goals: Goals;
}) {
  const hard: string[] = [];
  if (status.kcal === "over")
    hard.push(`${Math.round(totals.kcal - goals.kcal - KCAL_TOL)} kcal above the band`);
  if (status.kcal === "under")
    hard.push(`${Math.round(goals.kcal - KCAL_TOL - totals.kcal)} kcal below the band`);
  if (status.protein === "short")
    hard.push(`protein ${Math.round(status.proteinGap)} g short — add a protein source`);
  if (status.fiber === "short")
    hard.push(`fiber ${Math.round(status.fiberGap)} g short — add veg, legumes or whole grains`);

  const soft: string[] = [];
  const carbsD = totals.carbs_g - goals.carbs_g;
  const fatD = totals.fat_g - goals.fat_g;
  if (Math.abs(carbsD) > 15) soft.push(`carbs ${Math.round(Math.abs(carbsD))} g ${carbsD > 0 ? "over" : "under"}`);
  if (Math.abs(fatD) > 8) soft.push(`fat ${Math.round(Math.abs(fatD))} g ${fatD > 0 ? "over" : "under"}`);

  if (hard.length > 0) {
    return (
      <div className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
        <div className="font-medium">Closest fit with these items:</div>
        <ul className="mt-0.5 list-disc pl-4">
          {[...hard, ...soft].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
      <div>✓ Calories within ±{KCAL_TOL}, protein &amp; fiber on target.</div>
      {soft.length > 0 && (
        <div className="mt-0.5 text-primary/70">
          {soft.join(" · ")} — add or swap an item to balance these.
        </div>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7-2" />
    </svg>
  );
}
