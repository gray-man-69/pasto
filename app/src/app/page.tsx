"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import Ring from "@/components/Ring";
import WeekStrip from "@/components/WeekStrip";
import EntryEditor from "@/components/EntryEditor";
import {
  addDays,
  dailyKcalBetween,
  deleteEntry,
  entriesForDate,
  getGoals,
  localDate,
  weekStart,
} from "@/lib/db";
import { fmtNum, scale, sum } from "@/lib/macros";
import type { LogEntry } from "@/lib/types";

function scaleSnapshot(e: LogEntry) {
  return scale(e.per100g, e.grams);
}

const MACROS = [
  { key: "protein_g", label: "Protein", color: "text-rose-400" },
  { key: "carbs_g", label: "Carbs", color: "text-amber-400" },
  { key: "fat_g", label: "Fat", color: "text-sky-400" },
  { key: "fiber_g", label: "Fiber", color: "text-emerald-400" },
] as const;

export default function TodayPage() {
  const [selected, setSelected] = useState(() => localDate());
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const today = localDate();

  // Allow deep-linking a date from the History calendar (/?date=YYYY-MM-DD).
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d) setSelected(d);
  }, []);

  const ws = weekStart(selected);
  const entries = useLiveQuery(() => entriesForDate(selected), [selected]);
  const goals = useLiveQuery(() => getGoals(), []);
  const dayKcal = useLiveQuery(() => dailyKcalBetween(ws, addDays(ws, 6)), [ws]);

  const scaled = (entries ?? []).map(scaleSnapshot);
  const totals = sum(scaled);
  const goalKcal = goals?.kcal ?? 0;
  // The calorie total is the sum of each food's *displayed* (whole-number) kcal,
  // so the parts always add up to the total on screen (no round(sum) vs sum(round)).
  const consumed = scaled.reduce((s, m) => s + Math.round(m.kcal), 0);
  const remaining = Math.max(0, goalKcal - consumed);
  const over = consumed > goalKcal && goalKcal > 0;

  const dateLabel =
    selected === today
      ? "Today"
      : new Date(selected + "T00:00:00").toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });

  return (
    <div className="flex flex-col gap-6">
      <WeekStrip
        selected={selected}
        onSelect={setSelected}
        goalKcal={goalKcal || 2000}
        dayKcal={dayKcal ?? new Map()}
      />

      {/* Desktop: summary panel beside the log. Mobile: stacked single column. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        {/* Summary */}
        <section className="flex flex-col items-center gap-5 lg:rounded-3xl lg:border lg:border-base-300 lg:bg-base-100 lg:px-6 lg:py-8">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-base-content/40">
            {dateLabel}
          </div>

          <Ring
            value={consumed}
            max={goalKcal || 2000}
            size="13rem"
            stroke={7}
            colorClass={over ? "text-error" : "text-primary"}
          >
            <span className="flex flex-col items-center">
              <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">
                {consumed}
              </span>
              <span className="mt-1.5 text-xs text-base-content/40">
                of {goalKcal || 2000} kcal
              </span>
            </span>
          </Ring>

          <span
            className={`rounded-full px-3 py-1 text-sm font-medium tabular-nums ${
              over ? "bg-error/15 text-error" : "bg-primary/10 text-primary"
            }`}
          >
            {over ? `${consumed - goalKcal} over` : `${remaining} left`}
          </span>

          {goals && (
            <div className="mt-1 grid w-full max-w-sm grid-cols-4 gap-2">
              {MACROS.map((m) => {
                const value = totals[m.key];
                const goal = goals[m.key];
                return (
                  <div key={m.key} className="flex flex-col items-center gap-2">
                    <Ring value={value} max={goal} size="4.5rem" stroke={9} colorClass={m.color}>
                      <span className="text-base font-semibold tabular-nums">{fmtNum(value)}</span>
                    </Ring>
                    <span className="text-center text-[11px] leading-tight text-base-content/50">
                      <span className="block font-medium text-base-content/70">{m.label}</span>
                      <span className="text-base-content/35">/ {goal} g</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Log */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
              Logged
            </h2>
            <div className="flex items-center gap-2">
              <Link href={`/plan?date=${selected}`} className="btn btn-ghost btn-sm rounded-full">
                ⚖ Plan
              </Link>
              <Link
                href={`/add?date=${selected}`}
                className="btn btn-primary btn-sm rounded-full px-4 shadow-lg shadow-primary/20"
              >
                ＋ Add
              </Link>
            </div>
          </div>

          {entries === undefined ? (
            <div className="py-10 text-center text-base-content/30">Loading…</div>
          ) : entries.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {entries.map((e) => {
                const mm = scaleSnapshot(e);
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-base-300/60 bg-base-100 px-4 py-3"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setEditing(e)}
                      aria-label={`Edit ${e.foodName}`}
                    >
                      <div className="truncate font-medium">{e.foodName}</div>
                      <div className="mt-0.5 text-xs text-base-content/40">
                        {e.mealId ? "meal" : `${e.grams} g`} · {Math.round(mm.kcal)} kcal · P{" "}
                        {mm.protein_g} / C {mm.carbs_g} / F {mm.fat_g} / Fib {mm.fiber_g}
                      </div>
                    </button>
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base-content/30 hover:bg-base-300/60 hover:text-error"
                      onClick={() => e.id != null && deleteEntry(e.id)}
                      aria-label={`Remove ${e.foodName}`}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-1 py-12 text-center lg:rounded-3xl lg:border lg:border-dashed lg:border-base-300">
              <div className="text-sm text-base-content/40">Nothing logged yet.</div>
              <Link
                href={`/add?date=${selected}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Add your first food →
              </Link>
            </div>
          )}
        </section>
      </div>

      {editing && <EntryEditor entry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
