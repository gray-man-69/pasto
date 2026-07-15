"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import WeekSummary from "@/components/WeekSummary";
import { addDays, dailyTotalsBetween, getGoals, localDate, weekStart } from "@/lib/db";

function fmtRange(start: string): string {
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-GB", opts);
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-GB", opts);
  return `${s} – ${e}`;
}

function relLabel(start: string, thisWeek: string): string {
  const diff = Math.round(
    (new Date(start + "T00:00:00").getTime() - new Date(thisWeek + "T00:00:00").getTime()) /
      (7 * 86_400_000),
  );
  if (diff === 0) return "This week";
  if (diff === -1) return "Last week";
  if (diff === 1) return "Next week";
  return diff < 0 ? `${-diff} weeks ago` : `In ${diff} weeks`;
}

export default function WeekPage() {
  const [start, setStart] = useState(() => weekStart());
  const goals = useLiveQuery(() => getGoals(), []);
  const dayTotals = useLiveQuery(() => dailyTotalsBetween(start, addDays(start, 6)), [start]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const today = localDate();
  const thisWeek = weekStart(today);
  const isCurrent = start === thisWeek;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setStart(addDays(start, -7))}
          className="btn btn-ghost btn-sm btn-circle text-lg"
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold">{relLabel(start, thisWeek)}</h1>
          <div className="text-xs text-base-content/50">{fmtRange(start)}</div>
        </div>
        <button
          onClick={() => setStart(addDays(start, 7))}
          className="btn btn-ghost btn-sm btn-circle text-lg"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {!isCurrent && (
        <button
          onClick={() => setStart(thisWeek)}
          className="self-center text-xs text-primary hover:underline"
        >
          Back to this week
        </button>
      )}

      {goals && dayTotals ? (
        <WeekSummary days={days} dayTotals={dayTotals} goals={goals} today={today} />
      ) : (
        <div className="py-10 text-center text-base-content/40">Loading…</div>
      )}
    </div>
  );
}
