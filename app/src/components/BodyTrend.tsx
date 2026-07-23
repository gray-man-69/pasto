"use client";

import { useRef, useState } from "react";
import type { BodyWeight, Nutrients } from "@/lib/types";

// Weight trend + intake, side by side in time:
//  • Weight — raw weigh-ins as dots, a smoothed trend line through them
//    (exponential moving average, so one salty dinner doesn't read as a gain).
//  • Calories & Protein — sparklines over the same days, to eyeball how intake
//    is driving the trend.
// Hovering any chart shows that day's numbers; charts share the pointer.

const W = 320;
const WH = 96; // weight chart height
const SH = 36; // sparkline height
const PADX = 4;
const PADY = 7;

/** Smoothed trend over the weigh-ins: an EMA whose weight scales with the days
 * elapsed since the previous reading (daily α=0.25), so sparse weigh-ins don't
 * make the trend lag far behind reality. */
export function weightTrend(points: { date: string; kg: number }[]): number[] {
  const out: number[] = [];
  let t: number | null = null;
  let prev: string | null = null;
  for (const p of points) {
    if (t == null) t = p.kg;
    else {
      const gap = Math.max(1, Math.round((Date.parse(p.date) - Date.parse(prev!)) / 864e5));
      t += (1 - Math.pow(0.75, gap)) * (p.kg - t);
    }
    prev = p.date;
    out.push(Math.round(t * 100) / 100);
  }
  return out;
}

const SINCE_KEY = "pasto-body-since";

const x = (i: number, n: number) => PADX + (n <= 1 ? (W - PADX * 2) / 2 : (i / (n - 1)) * (W - PADX * 2));

export default function BodyTrend({
  days,
  weights,
  allWeights,
  dayTotals,
}: {
  days: string[]; // every day in range, oldest first
  weights: BodyWeight[]; // weigh-ins inside the range, oldest first
  allWeights: BodyWeight[]; // every weigh-in ever, oldest first
  dayTotals: Map<string, Nutrients>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // The user-picked comparison date ("since when am I measuring?"), remembered
  // across visits. Defaults to the very first weigh-in.
  const [since, setSince] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(SINCE_KEY),
  );
  const n = days.length;

  function locate(e: React.PointerEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(f * (n - 1)));
  }

  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const trend = weightTrend(weights);
  const kgs = weights.map((w) => w.kg);
  const lo = Math.min(...kgs, ...trend);
  const hi = Math.max(...kgs, ...trend);
  const span = Math.max(hi - lo, 1); // ≥1 kg of scale so a flat line stays centred
  const y = (kg: number) => PADY + (1 - (kg - lo) / span) * (WH - PADY * 2);

  const trendPath = weights
    .map((w, i) => `${i ? "L" : "M"}${x(dayIndex.get(w.date) ?? 0, n).toFixed(1)},${y(trend[i]).toFixed(1)}`)
    .join(" ");

  // Baseline = the last weigh-in on/before the picked date (or the first one
  // after, if the date predates all data). Compared against the latest weigh-in.
  const first = allWeights[0];
  const latest = allWeights[allWeights.length - 1];
  const sinceDate = since && first && since >= first.date ? since : first?.date;
  const baseline = sinceDate
    ? [...allWeights].reverse().find((w) => w.date <= sinceDate) ?? first
    : undefined;
  const delta =
    baseline && latest && baseline.date < latest.date
      ? { kg: latest.kg - baseline.kg, pct: baseline.kg > 0 ? ((latest.kg - baseline.kg) / baseline.kg) * 100 : 0 }
      : null;
  const hoverDay = hover != null ? days[hover] : null;
  const hoverWeight = hoverDay ? weights.find((w) => w.date === hoverDay) : null;
  const hoverTotals = hoverDay ? dayTotals.get(hoverDay) : null;
  const headline = hoverWeight
    ? `${hoverWeight.kg.toFixed(1)} kg`
    : trend.length
      ? `${trend[trend.length - 1].toFixed(1)} kg`
      : "—";
  const headlineLabel = hoverDay
    ? new Date(hoverDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "trend";

  return (
    <div
      ref={wrapRef}
      onPointerMove={locate}
      onPointerDown={locate}
      onPointerLeave={() => setHover(null)}
      className="flex flex-col gap-4"
    >
      {/* Weight */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/40">Weight</span>
          <span className="text-sm tabular-nums">
            <span className="font-semibold">{headline}</span>
            <span className="ml-1.5 text-[11px] text-base-content/40">{headlineLabel}</span>
          </span>
        </div>
        {weights.length ? (
          <svg viewBox={`0 0 ${W} ${WH}`} className="w-full rounded-xl bg-base-200/40">
            {hover != null && (
              <line x1={x(hover, n)} x2={x(hover, n)} y1={2} y2={WH - 2} stroke="var(--color-base-300)" strokeWidth={1} />
            )}
            <path d={trendPath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
            {weights.map((w) => (
              <circle
                key={w.date}
                cx={x(dayIndex.get(w.date) ?? 0, n)}
                cy={y(w.kg)}
                r={hoverDay === w.date ? 3.5 : 2}
                className={hoverDay === w.date ? "fill-primary" : "fill-base-content/30"}
              />
            ))}
          </svg>
        ) : (
          <div className="rounded-xl bg-base-200/40 py-8 text-center text-sm text-base-content/40">
            No weigh-ins in this range yet.
          </div>
        )}
        {baseline && latest && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-base-200/40 px-3 py-2">
            <label className="flex items-center gap-1.5 text-xs text-base-content/50">
              Since
              <input
                type="date"
                value={sinceDate}
                min={first.date}
                max={latest.date}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setSince(e.target.value);
                  localStorage.setItem(SINCE_KEY, e.target.value);
                }}
                className="input input-xs input-bordered"
              />
            </label>
            {delta ? (
              <span className={`text-sm font-semibold tabular-nums ${delta.kg > 0 ? "text-amber-500" : "text-primary"}`}>
                {delta.kg > 0 ? "▲" : "▼"} {Math.abs(delta.kg).toFixed(1)} kg
                <span className="ml-1.5 text-[11px] font-medium opacity-70">{Math.abs(delta.pct).toFixed(1)}%</span>
                <span className="ml-2 text-[11px] font-normal tabular-nums text-base-content/40">
                  {baseline.kg.toFixed(1)} → {latest.kg.toFixed(1)}
                </span>
              </span>
            ) : (
              <span className="text-xs text-base-content/40">Need a later weigh-in</span>
            )}
          </div>
        )}
      </div>

      {/* Intake over the same days */}
      <Spark label="Calories" cls="text-primary" days={days} hover={hover} value={(d) => dayTotals.get(d)?.kcal ?? 0} unit="" />
      <Spark label="Protein" cls="text-sky-400" days={days} hover={hover} value={(d) => dayTotals.get(d)?.protein_g ?? 0} unit=" g" />
    </div>
  );
}

function Spark({
  label,
  cls,
  days,
  hover,
  value,
  unit,
}: {
  label: string;
  cls: string;
  days: string[];
  hover: number | null;
  value: (d: string) => number;
  unit: string;
}) {
  const n = days.length;
  const vals = days.map(value);
  const hi = Math.max(...vals, 1);
  const y = (v: number) => PADY + (1 - v / hi) * (SH - PADY * 2);
  // Break the line at unlogged days instead of drawing them as zero.
  let path = "";
  let pen = false;
  vals.forEach((v, i) => {
    if (v <= 0) {
      pen = false;
      return;
    }
    path += `${pen ? "L" : "M"}${x(i, n).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });
  const hoverVal = hover != null ? vals[hover] : null;
  const logged = vals.filter((v) => v > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className={`font-semibold uppercase tracking-wide ${cls}`}>{label}</span>
        <span className="tabular-nums text-base-content/50">
          {hoverVal != null && hoverVal > 0 ? `${Math.round(hoverVal)}${unit}` : `avg ${avg}${unit}`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${SH}`} className={`w-full rounded-lg bg-base-200/40 ${cls}`}>
        {hover != null && (
          <line x1={x(hover, n)} x2={x(hover, n)} y1={2} y2={SH - 2} stroke="var(--color-base-300)" strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
