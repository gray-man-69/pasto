"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import Ring from "@/components/Ring";
import { dailyKcalBetween, getGoals, localDate } from "@/lib/db";

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthAnchor(date: string): string {
  return date.slice(0, 7) + "-01";
}

export default function HistoryPage() {
  const [anchor, setAnchor] = useState(() => monthAnchor(localDate()));
  const first = new Date(anchor + "T00:00:00");
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (first.getDay() + 6) % 7; // Monday = 0
  const today = localDate();

  const monthStart = localDate(new Date(year, month, 1));
  const monthEnd = localDate(new Date(year, month, daysInMonth));
  const dayKcal = useLiveQuery(() => dailyKcalBetween(monthStart, monthEnd), [monthStart, monthEnd]);
  const goals = useLiveQuery(() => getGoals(), []);
  const goalKcal = goals?.kcal ?? 2000;

  function shiftMonth(delta: number) {
    setAnchor(localDate(new Date(year, month + delta, 1)));
  }

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <h1 className="text-base font-semibold">
          {first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </h1>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-base-content/40">
        {DOW.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const d = localDate(new Date(year, month, day));
          const kcal = dayKcal?.get(d) ?? 0;
          const pctOfGoal = goalKcal > 0 ? (kcal / goalKcal) * 100 : 0;
          const color =
            kcal === 0
              ? "text-base-300"
              : pctOfGoal > 110
                ? "text-error"
                : pctOfGoal >= 85
                  ? "text-success"
                  : "text-primary";
          const isToday = d === today;
          return (
            <Link
              key={d}
              href={`/?date=${d}`}
              className={`flex aspect-square items-center justify-center rounded-xl ${
                isToday ? "bg-base-200" : ""
              }`}
            >
              <Ring value={kcal} max={goalKcal} size="2.3rem" thickness="3px" colorClass={color}>
                <span className="text-[11px] text-base-content/70">{day}</span>
              </Ring>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 pt-2 text-xs text-base-content/50">
        <Legend className="text-primary" label="under" />
        <Legend className="text-success" label="on target" />
        <Legend className="text-error" label="over" />
      </div>

      <Link href="/" className="btn btn-ghost btn-sm self-center">
        ← Back to today
      </Link>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${className}`} style={{ backgroundColor: "currentColor" }} />
      {label}
    </span>
  );
}
