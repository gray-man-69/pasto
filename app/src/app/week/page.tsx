"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { addDays, allMeals, getGoals, logMeal, weekStart, weeklyMealCounts } from "@/lib/db";
import type { Meal } from "@/lib/types";

function fmtRange(start: string): string {
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-GB", opts);
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-GB", opts);
  return `${s} – ${e}`;
}

export default function WeekPage() {
  const meals = useLiveQuery(() => allMeals(), []);
  const counts = useLiveQuery(() => weeklyMealCounts(), []);
  const goals = useLiveQuery(() => getGoals(), []);
  const start = weekStart();

  const loading = meals === undefined || counts === undefined || goals === undefined;

  // "Calculated targets": if you eat every allowance this week, what's the total?
  const planned = (meals ?? []).reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.perServing.kcal * m.weeklyLimit,
      protein: acc.protein + m.perServing.protein_g * m.weeklyLimit,
    }),
    { kcal: 0, protein: 0 },
  );
  const weeklyKcalGoal = (goals?.kcal ?? 0) * 7;
  const weeklyProteinGoal = (goals?.protein_g ?? 0) * 7;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">This week</h1>
          <div className="text-xs text-base-content/50">{fmtRange(start)}</div>
        </div>
        <Link href="/meals" className="btn btn-ghost btn-sm">
          Manage meals
        </Link>
      </div>

      {/* Planned vs weekly goal */}
      {goals && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-2 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
              Planned (if you eat every allowance)
            </div>
            <PlanRow label="Calories" planned={Math.round(planned.kcal)} goal={weeklyKcalGoal} unit="kcal" />
            <PlanRow label="Protein" planned={Math.round(planned.protein)} goal={weeklyProteinGoal} unit="g" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-base-content/40">Loading…</div>
      ) : meals && meals.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {meals.map((m) => (
            <MealRow key={m.id} meal={m} eaten={counts?.get(m.id!) ?? 0} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-base-content/50">
          No meals yet.
          <Link href="/meals" className="btn btn-primary btn-sm">
            Create your first meal
          </Link>
        </div>
      )}
    </div>
  );
}

function MealRow({ meal, eaten }: { meal: Meal; eaten: number }) {
  const remaining = meal.weeklyLimit - eaten;
  const done = remaining <= 0;
  const last = remaining === 1;
  const accent = done ? "border-error" : last ? "border-warning" : "border-success";
  const badge = done ? "badge-error" : last ? "badge-warning" : "badge-success";

  return (
    <li className={`card border-l-4 ${accent} bg-base-100 shadow-sm`}>
      <div className="card-body flex-row items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{meal.name}</div>
          <div className="text-xs text-base-content/50">
            {Math.round(meal.perServing.kcal)} kcal · P {meal.perServing.protein_g} per serving
          </div>
          <div className="mt-1">
            <span className={`badge badge-sm ${badge}`}>
              {done ? "Done for the week" : `${remaining} of ${meal.weeklyLimit} left`}
            </span>
          </div>
        </div>
        <button
          className={`btn btn-sm shrink-0 ${done ? "btn-outline btn-error" : "btn-primary"}`}
          onClick={() => logMeal(meal)}
        >
          Eat
        </button>
      </div>
    </li>
  );
}

function PlanRow({
  label,
  planned,
  goal,
  unit,
}: {
  label: string;
  planned: number;
  goal: number;
  unit: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((planned / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-base-content/70">
          {planned}
          <span className="text-base-content/40"> / {goal} {unit}/wk</span>
        </span>
      </div>
      <progress className="progress progress-primary w-full" value={pct} max={100} />
    </div>
  );
}
