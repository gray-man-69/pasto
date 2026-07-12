"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import Ring from "@/components/Ring";
import WeekStrip from "@/components/WeekStrip";
import EntryEditor from "@/components/EntryEditor";
import MealIcon from "@/components/MealIcon";
import {
  addDays,
  addGlasses,
  dailyKcalBetween,
  deleteEntry,
  entriesForDate,
  getGoals,
  localDate,
  waterForDate,
  weekStart,
} from "@/lib/db";
import { fmtNum, scale, sum } from "@/lib/macros";
import { MEAL_SLOTS, isMealSlot } from "@/lib/mealSlots";
import type { LogEntry, MealSlot } from "@/lib/types";

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
  const water = useLiveQuery(() => waterForDate(selected), [selected]);
  const glasses = water?.glasses ?? 0;
  const waterGoal = goals?.water_glasses ?? 8;

  const scaled = (entries ?? []).map(scaleSnapshot);
  const totals = sum(scaled);

  // Group the day's entries by meal. Entries with no meal (logged before this
  // feature, or via the planner) fall into "other".
  const grouped = new Map<MealSlot | "other", LogEntry[]>();
  for (const e of entries ?? []) {
    const key = isMealSlot(e.meal) ? e.meal : "other";
    const arr = grouped.get(key);
    if (arr) arr.push(e);
    else grouped.set(key, [e]);
  }
  const other = grouped.get("other") ?? [];
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

          {/* Water — one-tap logging */}
          <div className="mt-1 flex w-full max-w-sm flex-col gap-2.5 rounded-2xl border border-base-300/70 bg-base-200/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">💧 Water</span>
              <span className="text-sm tabular-nums text-base-content/60">
                {glasses} / {waterGoal} glasses
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: Math.max(waterGoal, glasses) }).map((_, i) => (
                <button
                  key={i}
                  aria-label={`Set ${i + 1} glasses`}
                  onClick={() => addGlasses(selected, i + 1 - glasses)}
                  className={`h-6 w-6 rounded-full transition-colors ${
                    i < glasses ? "bg-sky-400" : "bg-base-300 hover:bg-base-content/20"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => addGlasses(selected, 1)}
                className="btn btn-primary btn-sm flex-1"
              >
                ＋ Glass
              </button>
              <button
                onClick={() => addGlasses(selected, -1)}
                disabled={glasses <= 0}
                className="btn btn-ghost btn-sm"
                aria-label="Remove a glass"
              >
                −
              </button>
            </div>
          </div>
        </section>

        {/* Log — grouped into meals */}
        <section className="flex flex-col gap-4">
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
          ) : (
            <>
              {MEAL_SLOTS.map((s) => (
                <MealSection
                  key={s.id}
                  slot={s.id}
                  label={s.label}
                  entries={grouped.get(s.id) ?? []}
                  date={selected}
                  onEdit={setEditing}
                />
              ))}
              {other.length > 0 && (
                <MealSection
                  slot={null}
                  label="Other"
                  entries={other}
                  date={selected}
                  onEdit={setEditing}
                />
              )}
            </>
          )}
        </section>
      </div>

      {editing && <EntryEditor entry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MealSection({
  slot,
  label,
  entries,
  date,
  onEdit,
}: {
  slot: MealSlot | null;
  label: string;
  entries: LogEntry[];
  date: string;
  onEdit: (e: LogEntry) => void;
}) {
  // Collapsible: open when there's food, collapsed when empty (compact row).
  const [open, setOpen] = useState(entries.length > 0);
  const kcal = entries.reduce((s, e) => s + Math.round(scaleSnapshot(e).kcal), 0);
  const addHref = slot ? `/add?date=${date}&meal=${slot}` : `/add?date=${date}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-base-300/60 bg-base-100">
      <div className="flex items-center gap-1 pr-2">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MealIcon slot={slot} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-[11px] tabular-nums text-base-content/40">
              {entries.length > 0
                ? `${entries.length} item${entries.length > 1 ? "s" : ""} · ${kcal} kcal`
                : "empty"}
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`ml-auto h-4 w-4 shrink-0 text-base-content/30 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {slot && (
          <Link
            href={addHref}
            aria-label={`Add to ${label}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-primary hover:bg-primary/10"
          >
            ＋
          </Link>
        )}
      </div>

      {open &&
        (entries.length > 0 ? (
          <ul className="flex flex-col gap-1 px-2 pb-2">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} onEdit={onEdit} />
            ))}
          </ul>
        ) : (
          <Link
            href={addHref}
            className="mx-2 mb-2 block rounded-xl border border-dashed border-base-300/70 px-4 py-2.5 text-center text-xs text-base-content/35 transition-colors hover:border-primary/40 hover:text-base-content/60"
          >
            Add {label.toLowerCase()}…
          </Link>
        ))}
    </div>
  );
}

function EntryRow({ entry, onEdit }: { entry: LogEntry; onEdit: (e: LogEntry) => void }) {
  const mm = scaleSnapshot(entry);
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-base-200/40 px-3 py-2.5">
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => onEdit(entry)}
        aria-label={`Edit ${entry.foodName}`}
      >
        <div className="truncate text-sm font-medium">{entry.foodName}</div>
        <div className="mt-0.5 text-[11px] text-base-content/40">
          {entry.mealId ? "meal" : `${entry.grams} g`} · {Math.round(mm.kcal)} kcal · P{" "}
          {mm.protein_g} / C {mm.carbs_g} / F {mm.fat_g} / Fib {mm.fiber_g}
        </div>
      </button>
      <button
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base-content/30 hover:bg-base-300/60 hover:text-error"
        onClick={() => entry.id != null && deleteEntry(entry.id)}
        aria-label={`Remove ${entry.foodName}`}
      >
        ✕
      </button>
    </li>
  );
}
