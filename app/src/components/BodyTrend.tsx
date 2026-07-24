"use client";

import { useRef, useState } from "react";
import RangeCalendar from "@/components/RangeCalendar";
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
const UNTIL_KEY = "pasto-body-until"; // absent = "now" (rolling latest weigh-in)

const fmtDay = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

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
  // The user-picked comparison range, remembered across visits. Start defaults
  // to the very first weigh-in; a missing end means "now" and follows the
  // latest weigh-in as new ones arrive.
  const [since, setSince] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(SINCE_KEY),
  );
  const [until, setUntil] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(UNTIL_KEY),
  );
  const [calOpen, setCalOpen] = useState(false);
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

  // Range endpoints resolve to weigh-ins: the last reading on/before each
  // picked date (falling back to the first reading if the date predates data).
  const first = allWeights[0];
  const latest = allWeights[allWeights.length - 1];
  const sinceDate = since && first && since >= first.date ? since : first?.date;
  const untilDate = until && latest && until <= latest.date ? until : latest?.date;
  const atOrBefore = (d: string) => [...allWeights].reverse().find((w) => w.date <= d);
  const baseline = sinceDate ? atOrBefore(sinceDate) ?? first : undefined;
  const endpoint = untilDate ? atOrBefore(untilDate) ?? latest : undefined;
  const delta =
    baseline && endpoint && baseline.date < endpoint.date
      ? {
          kg: endpoint.kg - baseline.kg,
          pct: baseline.kg > 0 ? ((endpoint.kg - baseline.kg) / baseline.kg) * 100 : 0,
        }
      : null;
  // Weekly rate of change — the number to hold against the usual guidance
  // (cut ≈ 0.5–1%/week, lean gain ≈ 0.25–0.5%/week). Needs ≥1 week of data.
  const rangeWeeks =
    baseline && endpoint ? (Date.parse(endpoint.date) - Date.parse(baseline.date)) / (7 * 864e5) : 0;
  const weeklyPct = delta && rangeWeeks >= 1 ? delta.pct / rangeWeeks : null;
  const paceFast = weeklyPct != null && (weeklyPct < -1 || weeklyPct > 0.5);
  const hoverDay = hover != null ? days[hover] : null;
  const hoverWeight = hoverDay ? weights.find((w) => w.date === hoverDay) : null;
  const shownKg = hoverWeight?.kg ?? latest?.kg;
  const heroLabel = hoverDay
    ? new Date(hoverDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "Current weight";

  // Area fill under the trend line, closed down to the chart floor.
  const firstInRange = weights[0];
  const lastInRange = weights[weights.length - 1];
  const areaPath =
    weights.length > 1
      ? `${trendPath} L${x(dayIndex.get(lastInRange.date) ?? 0, n).toFixed(1)},${WH} L${x(dayIndex.get(firstInRange.date) ?? 0, n).toFixed(1)},${WH} Z`
      : "";

  return (
    <div className="flex flex-col gap-5">
      {/* Hero — mirrors the Today tab's big-number summary */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-base-content/40">
          {heroLabel}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">
            {shownKg != null ? shownKg.toFixed(1) : "—"}
          </span>
          <span className="text-sm text-base-content/40">kg</span>
        </span>
        {trend.length > 0 && !hoverDay && (
          <span className="text-[11px] tabular-nums text-base-content/40">
            trend {trend[trend.length - 1].toFixed(1)} kg
          </span>
        )}
        {baseline && endpoint && (
          <>
            <button
              onClick={() => setCalOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium tabular-nums transition-colors ${
                delta && delta.kg > 0 ? "bg-amber-400/15 text-amber-500" : "bg-primary/10 text-primary"
              }`}
            >
              {delta ? (
                <>
                  {delta.kg > 0 ? "▲" : "▼"} {Math.abs(delta.kg).toFixed(1)} kg
                  <span className="text-[11px] opacity-70">{Math.abs(delta.pct).toFixed(1)}%</span>
                </>
              ) : (
                <span className="text-xs">pick a range</span>
              )}
              <span className={`text-[10px] opacity-60 transition-transform ${calOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            <span className="text-[11px] tabular-nums text-base-content/40">
              {fmtDay(baseline.date)} → {until ? fmtDay(endpoint.date) : "now"} · {baseline.kg.toFixed(1)} →{" "}
              {endpoint.kg.toFixed(1)} kg
            </span>
            {weeklyPct != null && (
              <span
                className={`text-[11px] font-medium tabular-nums ${
                  paceFast ? "text-amber-500" : "text-base-content/50"
                }`}
              >
                {weeklyPct > 0 ? "▲" : "▼"} {Math.abs(weeklyPct).toFixed(2)}% / week
                {paceFast && (weeklyPct < 0 ? " · faster than 1%/wk" : " · faster than 0.5%/wk")}
              </span>
            )}
            {calOpen && first && latest && (
              <RangeCalendar
                start={sinceDate!}
                end={untilDate!}
                min={first.date}
                max={latest.date}
                marked={new Set(allWeights.map((w) => w.date))}
                onChange={(s, e) => {
                  setSince(s);
                  localStorage.setItem(SINCE_KEY, s);
                  if (e >= latest.date) {
                    setUntil(null);
                    localStorage.removeItem(UNTIL_KEY);
                  } else {
                    setUntil(e);
                    localStorage.setItem(UNTIL_KEY, e);
                  }
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Charts share the scrub pointer; the hero above only displays it. */}
      <div
        ref={wrapRef}
        onPointerMove={locate}
        onPointerDown={locate}
        onPointerLeave={() => setHover(null)}
        className="flex flex-col gap-5"
      >
      <div>
        {weights.length ? (
          <svg viewBox={`0 0 ${W} ${WH}`} className="w-full rounded-xl bg-base-200/40">
            <defs>
              <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.16" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            {hover != null && (
              <line x1={x(hover, n)} x2={x(hover, n)} y1={2} y2={WH - 2} stroke="var(--color-base-300)" strokeWidth={1} />
            )}
            {areaPath && <path d={areaPath} fill="url(#weight-fill)" className="text-primary" />}
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
            {/* min/max of the scale, tucked in the corners */}
            <text x={W - 4} y={PADY + 3} textAnchor="end" className="fill-base-content/30 text-[7px] tabular-nums">
              {hi.toFixed(1)}
            </text>
            <text x={W - 4} y={WH - 2} textAnchor="end" className="fill-base-content/30 text-[7px] tabular-nums">
              {lo.toFixed(1)}
            </text>
          </svg>
        ) : (
          <div className="rounded-xl bg-base-200/40 py-8 text-center text-sm text-base-content/40">
            No weigh-ins in this range yet.
          </div>
        )}
      </div>

      {/* Intake over the same days */}
      <Spark label="Calories" cls="text-primary" days={days} hover={hover} value={(d) => dayTotals.get(d)?.kcal ?? 0} unit="" />
      <Spark label="Protein" cls="text-sky-400" days={days} hover={hover} value={(d) => dayTotals.get(d)?.protein_g ?? 0} unit=" g" />
      </div>
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
