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
import { scale, sum } from "@/lib/macros";
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

  const totals = sum((entries ?? []).map(scaleSnapshot));
  const goalKcal = goals?.kcal ?? 0;
  const remaining = Math.max(0, goalKcal - Math.round(totals.kcal));

  return (
    <div className="flex flex-col gap-6">
      <WeekStrip
        selected={selected}
        onSelect={setSelected}
        goalKcal={goalKcal || 2000}
        dayKcal={dayKcal ?? new Map()}
      />

      <div className="text-center">
        <div className="text-sm font-medium text-base-content/50">
          {selected === today
            ? "Today"
            : new Date(selected + "T00:00:00").toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
        </div>
      </div>

      {/* Calorie ring */}
      <div className="flex justify-center">
        <Ring value={totals.kcal} max={goalKcal || 2000} size="11rem" thickness="9px">
          <span className="flex flex-col items-center">
            <span className="text-4xl font-bold tabular-nums">{Math.round(totals.kcal)}</span>
            <span className="text-xs text-base-content/40">/ {goalKcal} kcal</span>
            <span className="mt-1 text-xs font-medium text-base-content/60">
              {remaining} left
            </span>
          </span>
        </Ring>
      </div>

      {/* Macro rings */}
      {goals && (
        <div className="grid grid-cols-4 gap-1">
          {MACROS.map((m) => {
            const consumed = totals[m.key];
            const goal = goals[m.key];
            return (
              <div key={m.key} className="flex flex-col items-center gap-1.5">
                <Ring value={consumed} max={goal} size="4rem" thickness="5px" colorClass={m.color}>
                  <span className="text-sm font-semibold tabular-nums">{Math.round(consumed)}</span>
                </Ring>
                <span className="text-center text-xs text-base-content/50">
                  {m.label}
                  <span className="block text-base-content/30">/{goal}g</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Log */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Logged
          </h2>
          <Link href={`/add?date=${selected}`} className="btn btn-primary btn-sm rounded-full">
            + Add
          </Link>
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
                  className="flex items-center justify-between gap-2 rounded-2xl bg-base-100 px-4 py-3"
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setEditing(e)}
                    aria-label={`Edit ${e.foodName}`}
                  >
                    <div className="truncate font-medium">{e.foodName}</div>
                    <div className="text-xs text-base-content/40">
                      {e.mealId ? "meal" : `${e.grams} g`} · {Math.round(mm.kcal)} kcal · P{" "}
                      {mm.protein_g} / C {mm.carbs_g} / F {mm.fat_g}
                    </div>
                  </button>
                  <button
                    className="btn btn-ghost btn-xs btn-circle text-base-content/40"
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
          <div className="py-10 text-center text-sm text-base-content/30">
            Nothing logged.
          </div>
        )}
      </div>

      {editing && <EntryEditor entry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
