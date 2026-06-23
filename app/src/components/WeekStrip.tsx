"use client";

import Link from "next/link";
import Ring from "@/components/Ring";
import { addDays, localDate, weekStart } from "@/lib/db";

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function WeekStrip({
  selected,
  onSelect,
  goalKcal,
  dayKcal,
}: {
  selected: string;
  onSelect: (date: string) => void;
  goalKcal: number;
  dayKcal: Map<string, number>;
}) {
  const ws = weekStart(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const today = localDate();
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
          const kcal = dayKcal.get(d) ?? 0;
          const dayNum = d.slice(8);
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 ${
                isSel ? "bg-base-200" : ""
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide text-base-content/40">
                {DOW[i]}
              </span>
              <Ring
                value={kcal}
                max={goalKcal}
                size="2.4rem"
                thickness="3px"
                colorClass={kcal > 0 ? "text-primary" : "text-base-300"}
              >
                <span className={`text-xs ${isSel ? "font-bold" : "text-base-content/70"}`}>
                  {dayNum}
                </span>
              </Ring>
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
