"use client";

import type { Goals, Nutrients } from "@/lib/types";

// Weekly nutrition summary: the daily average of each macro vs its goal, plus a
// per-day calorie bar chart. Averages are taken over *logged* days only, so an
// un-tracked or not-yet-happened day never drags the numbers toward zero — the
// "over N logged days" caption keeps that honest.

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type MetricKey = "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g";
type Metric = { key: MetricKey; label: string; unit: string; color: string };

const METRICS: Metric[] = [
  { key: "kcal", label: "Calories", unit: "kcal", color: "bg-primary" },
  { key: "protein_g", label: "Protein", unit: "g", color: "bg-sky-400" },
  { key: "carbs_g", label: "Carbs", unit: "g", color: "bg-rose-400" },
  { key: "fat_g", label: "Fat", unit: "g", color: "bg-orange-400" },
  { key: "fiber_g", label: "Fiber", unit: "g", color: "bg-emerald-400" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function WeekSummary({
  days,
  dayTotals,
  goals,
  today,
}: {
  days: string[];
  dayTotals: Map<string, Nutrients>;
  goals: Goals;
  today: string;
}) {
  const logged = days.filter((d) => (dayTotals.get(d)?.kcal ?? 0) > 0);
  const n = logged.length;

  if (n === 0) {
    return (
      <section className="rounded-3xl border border-base-300 bg-base-100 p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
          Daily average
        </div>
        <div className="py-8 text-center text-sm text-base-content/40">
          Nothing logged this week yet.
        </div>
      </section>
    );
  }

  const avg = (key: MetricKey) =>
    logged.reduce((s, d) => s + (dayTotals.get(d)?.[key] ?? 0), 0) / n;

  const goalKcal = goals.kcal || 1;
  const dayKcals = days.map((d) => dayTotals.get(d)?.kcal ?? 0);
  const chartMax = Math.max(goalKcal * 1.15, ...dayKcals.map((k) => k * 1.05), 1);
  const goalPct = (goalKcal / chartMax) * 100;

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-base-300 bg-base-100 p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
          Daily average
        </div>
        <div className="text-xs text-base-content/40">
          over {n} logged {n === 1 ? "day" : "days"}
        </div>
      </div>

      {/* Average vs goal, per macro */}
      <div className="flex flex-col gap-3.5">
        {METRICS.map((m) => {
          const a = avg(m.key);
          const goal = goals[m.key] || 0;
          const pct = goal > 0 ? Math.min(100, (a / goal) * 100) : 0;
          return (
            <div key={m.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${m.color}`} />
                  <span className="font-medium">{m.label}</span>
                </span>
                <span className="tabular-nums">
                  <span className="font-semibold">{fmt(a)}</span>
                  <span className="text-base-content/40">
                    {" "}
                    / {fmt(goal)} {m.unit}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-300/60">
                <div
                  className={`h-full rounded-full ${m.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Calories per day — single series, read against the dashed goal line. */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Calories / day
          </span>
          <span className="text-[11px] text-base-content/40">goal {fmt(goalKcal)}</span>
        </div>
        <div className="relative h-24">
          <div
            className="absolute inset-x-0 z-10 border-t border-dashed border-base-content/25"
            style={{ bottom: `${goalPct}%` }}
          />
          <div className="flex h-full items-end gap-1.5">
            {days.map((d) => {
              const kcal = dayTotals.get(d)?.kcal ?? 0;
              const isLogged = kcal > 0;
              const h = isLogged ? Math.max(4, (kcal / chartMax) * 100) : 0;
              const dd = new Date(d + "T00:00:00");
              const label = dd.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              return (
                <div key={d} className="flex flex-1 items-end justify-center self-stretch">
                  {isLogged ? (
                    <div
                      title={`${label}: ${fmt(kcal)} kcal`}
                      className={`w-full rounded-t-md transition-[height] ${
                        d === today ? "bg-primary" : "bg-primary/80"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  ) : (
                    <div
                      title={`${label}: no log`}
                      className="h-[3px] w-full rounded bg-base-300/60"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {days.map((d, i) => (
            <span
              key={d}
              className={`flex-1 text-center text-[10px] ${
                d === today ? "font-bold text-base-content" : "text-base-content/40"
              }`}
            >
              {DOW[i]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
