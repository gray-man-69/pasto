"use client";

import MetricsTrend, { type ExtraMetric } from "@/components/MetricsTrend";
import type { Goals, Nutrients } from "@/lib/types";

// Nutrition summary for a date range: a small-multiples daily trend (one
// sparkline per metric, each with its average + goal). Everything is taken over
// *logged* days only, so an un-tracked or not-yet-happened day never counts.

export default function WeekSummary({
  days,
  dayTotals,
  goals,
  extras,
}: {
  days: string[];
  dayTotals: Map<string, Nutrients>;
  goals: Goals;
  today: string;
  extras?: ExtraMetric[];
}) {
  const logged = days.filter((d) => (dayTotals.get(d)?.kcal ?? 0) > 0);
  const n = logged.length;

  if (n === 0) {
    return (
      <section className="rounded-3xl border border-base-300 bg-base-100 p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
          Daily trend
        </div>
        <div className="py-8 text-center text-sm text-base-content/40">
          Nothing logged in this range yet.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-base-300 bg-base-100 p-5">
      <MetricsTrend
        days={days}
        dayTotals={dayTotals}
        goals={goals}
        extras={extras}
        caption={`over ${n} logged ${n === 1 ? "day" : "days"}`}
      />
    </section>
  );
}
