"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import WeekSummary from "@/components/WeekSummary";
import {
  addDays,
  allMeals,
  dailyTotalsBetween,
  getGoals,
  localDate,
  logMeal,
  weekStart,
  weeklyMealCounts,
} from "@/lib/db";
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
  const dayTotals = useLiveQuery(() => dailyTotalsBetween(start, addDays(start, 6)), [start]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = localDate();
  const loading = meals === undefined || counts === undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">This week</h1>
          <div className="text-xs text-base-content/50">{fmtRange(start)}</div>
        </div>
        <Link href="/meals" className="btn btn-ghost btn-sm">
          Manage meals
        </Link>
      </div>

      {/* Weekly nutrition summary */}
      {goals && dayTotals && (
        <WeekSummary days={days} dayTotals={dayTotals} goals={goals} today={today} />
      )}

      {/* Meal allowances */}
      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
          Meal allowances
        </h2>
        {loading ? (
          <div className="py-10 text-center text-base-content/40">Loading…</div>
        ) : meals && meals.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {meals.map((m) => (
              <MealRow key={m.id} meal={m} eaten={counts?.get(m.id!) ?? 0} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-base-content/50">
            No saved meals yet.
            <Link href="/meals" className="btn btn-primary btn-sm">
              Create your first meal
            </Link>
          </div>
        )}
      </div>
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
