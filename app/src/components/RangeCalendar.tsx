"use client";

import { useState } from "react";
import { localDate } from "@/lib/db";

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// A compact month calendar for picking a from→to range (History-calendar
// styling). First tap sets the start, second tap the end; tapping before the
// start restarts the selection. Days with a weigh-in carry a dot.
export default function RangeCalendar({
  start,
  end,
  min,
  max,
  marked,
  onChange,
}: {
  start: string;
  end: string;
  min: string;
  max: string;
  marked: Set<string>;
  onChange: (start: string, end: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => end.slice(0, 7) + "-01");
  const [picking, setPicking] = useState<"start" | "end">("start");
  const first = new Date(anchor + "T00:00:00");
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (first.getDay() + 6) % 7; // Monday = 0

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function tap(d: string) {
    if (picking === "start" || d < start) {
      onChange(d, d > end ? d : end);
      setPicking("end");
    } else {
      onChange(start, d);
      setPicking("start");
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-base-300/70 bg-base-100 p-3">
      <div className="flex items-center justify-between">
        <button
          className="btn btn-ghost btn-xs btn-circle"
          onClick={() => setAnchor(localDate(new Date(year, month - 1, 1)))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-sm font-semibold">
          {first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </span>
        <button
          className="btn btn-ghost btn-xs btn-circle"
          onClick={() => setAnchor(localDate(new Date(year, month + 1, 1)))}
          aria-label="Next month"
        >
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
          const disabled = d < min || d > max;
          const isEdge = d === start || d === end;
          const inRange = d > start && d < end;
          return (
            <button
              key={d}
              disabled={disabled}
              onClick={() => tap(d)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[12px] tabular-nums transition-colors ${
                disabled
                  ? "text-base-content/20"
                  : isEdge
                    ? "bg-primary font-semibold text-primary-content"
                    : inRange
                      ? "bg-primary/15 text-base-content"
                      : "text-base-content/70 hover:bg-base-200"
              }`}
            >
              {day}
              {marked.has(d) && !isEdge && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary/70" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-base-content/40">
        <span>{picking === "end" ? "Pick the end date" : "Pick the start date"}</span>
        <button className="btn btn-ghost btn-xs" onClick={() => onChange(min, max)}>
          Reset
        </button>
      </div>
    </div>
  );
}
