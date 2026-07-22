"use client";

import Link from "next/link";
import DayRings from "@/components/DayRings";
import { addDays, localDate, weekStart } from "@/lib/db";
import { MACROS } from "@/lib/macroMeta";
import type { Goals, Nutrients } from "@/lib/types";

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function WeekStrip({
  selected,
  onSelect,
  goals,
  dayTotals,
}: {
  selected: string;
  onSelect: (date: string) => void;
  goals: Goals | null;
  dayTotals: Map<string, Nutrients>;
}) {
  const ws = weekStart(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const today = localDate();
  const goalKcal = goals?.kcal || 2000;
  const monthLabel = new Date(selected + "T00:00:00").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => onSelect(addDays(selected, -7))}
          aria-label="Previous week"
        >
          ‹
        </button>
        <Link href="/history" className="text-sm font-semibold hover:underline">
          {monthLabel}
        </Link>
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => onSelect(addDays(selected, 7))}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <div className="flex justify-between">
        {days.map((d, i) => {
          const isSel = d === selected;
          const isToday = d === today;
          const t = dayTotals.get(d);
          const kcal = t?.kcal ?? 0;
          const rings = [
            {
              value: kcal,
              max: goalKcal,
              colorClass: kcal > goalKcal ? "text-red-500" : "text-primary",
            },
            ...MACROS.map((m) => ({
              value: t?.[m.key] ?? 0,
              max: goals?.[m.key] ?? 0,
              colorClass: m.color,
            })),
          ];
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors ${
                isSel ? "bg-base-100 ring-1 ring-base-300" : ""
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide text-base-content/40">
                {DOW[i]}
              </span>
              <DayRings rings={rings} size="3rem" />
              <span
                className={`text-xs tabular-nums ${
                  isSel ? "font-bold text-base-content" : "text-base-content/70"
                }`}
              >
                {d.slice(8)}
              </span>
              <span
                className={`h-1 w-1 rounded-full ${isToday ? "bg-primary" : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
