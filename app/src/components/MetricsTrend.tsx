"use client";

import { useRef, useState } from "react";
import type { Goals, Nutrients } from "@/lib/types";

// Two linked blocks:
//  • "Daily average" — a scoreboard: one bar per metric vs its goal.
//  • "Trend" — small multiples: one sparkline per metric (own scale, real units).
// They share a hover: pointing at a day on the trend updates the scoreboard's
// numbers + bars to that day. Averages are over logged days only.
// Besides the nutrition metrics, callers can pass `extras` (e.g. Apple Health
// steps/burn) — same rows, same sparklines, their own per-day presence mask.

type Key = "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g";
const METRICS: { key: Key; label: string; cls: string; dot: string; unit: string }[] = [
  { key: "kcal", label: "Calories", cls: "text-primary", dot: "bg-primary", unit: "" },
  { key: "protein_g", label: "Protein", cls: "text-sky-400", dot: "bg-sky-400", unit: "g" },
  { key: "carbs_g", label: "Carbs", cls: "text-rose-400", dot: "bg-rose-400", unit: "g" },
  { key: "fat_g", label: "Fat", cls: "text-orange-400", dot: "bg-orange-400", unit: "g" },
  { key: "fiber_g", label: "Fiber", cls: "text-emerald-400", dot: "bg-emerald-400", unit: "g" },
];

export interface ExtraMetric {
  key: string;
  label: string;
  cls: string; // text-* color class (sparkline)
  dot: string; // bg-* color class (scoreboard dot/bar)
  unit: string;
  goal?: number; // omit → no goal line, no bar, plain average
  values: Map<string, number>; // by date; a missing date = no data that day
}

// A unified row model so nutrition and extras render identically.
type Row = {
  id: string;
  label: string;
  cls: string;
  dot: string;
  unit: string;
  goal: number;
  get: (d: string) => number;
  mask: boolean[]; // which days count for this row
};

const W = 320;
const HH = 36;
const PADX = 2;
const PADY = 5;
const IW = W - PADX * 2;
const IH = HH - PADY * 2;

const val = (m: Nutrients | undefined, key: Key) => m?.[key] ?? 0;

export default function MetricsTrend({
  days,
  dayTotals,
  goals,
  caption,
  extras = [],
}: {
  days: string[];
  dayTotals: Map<string, Nutrients>;
  goals: Goals;
  caption?: string;
  extras?: ExtraMetric[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = days.length;
  const logged = days.map((d) => (dayTotals.get(d)?.kcal ?? 0) > 0);
  const anyLogged = logged.some(Boolean);

  const rows: Row[] = [
    ...METRICS.map((m) => ({
      id: m.key,
      label: m.label,
      cls: m.cls,
      dot: m.dot,
      unit: m.unit,
      goal: goals[m.key] || 0,
      get: (d: string) => val(dayTotals.get(d), m.key),
      mask: logged,
    })),
    ...extras
      .map((e) => ({
        id: e.key,
        label: e.label,
        cls: e.cls,
        dot: e.dot,
        unit: e.unit,
        goal: e.goal ?? 0,
        get: (d: string) => e.values.get(d) ?? 0,
        mask: days.map((d) => e.values.has(d)),
      }))
      .filter((r) => r.mask.some(Boolean)), // hide extras with no data in range
  ];

  function locate(e: React.PointerEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(f * (n - 1)));
  }

  const hoverDate =
    hover != null
      ? new Date(days[hover] + "T00:00:00").toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      : null;

  if (!anyLogged) {
    return (
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
          Daily average
        </div>
        <div className="py-8 text-center text-sm text-base-content/40">
          Nothing logged in this range yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Scoreboard — averages (or the hovered day) vs goal */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Daily average
          </span>
          <span className="text-[11px] tabular-nums text-base-content/50">
            {hoverDate ?? caption ?? ""}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <AvgRow key={r.id} r={r} days={days} hover={hover} />
          ))}
        </div>
      </div>

      {/* Trend — small multiples, in the same order/colors as the scoreboard */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/40">
          Trend
        </div>
        <div
          ref={wrapRef}
          onPointerMove={locate}
          onPointerDown={locate}
          onPointerLeave={() => setHover(null)}
          className="flex flex-col gap-2"
        >
          {rows.map((r) => (
            <Spark key={r.id} r={r} days={days} hover={hover} n={n} />
          ))}
        </div>
      </div>
    </div>
  );
}

function avgOf(r: Row, days: string[]) {
  const vals = days.filter((_, i) => r.mask[i]).map(r.get);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function AvgRow({ r, days, hover }: { r: Row; days: string[]; hover: number | null }) {
  const onDay = hover != null && r.mask[hover];
  const shown = onDay ? r.get(days[hover!]) : avgOf(r, days);
  const pct = r.goal > 0 ? Math.min(100, (shown / r.goal) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${r.dot}`} />
          <span className="font-medium">{r.label}</span>
        </span>
        <span className="tabular-nums">
          {!onDay && <span className="text-base-content/35">avg </span>}
          <span className="font-semibold">
            {Math.round(shown).toLocaleString()}
            {r.unit}
          </span>
          {r.goal > 0 && (
            <span className="text-base-content/40"> / {Math.round(r.goal).toLocaleString()}</span>
          )}
        </span>
      </div>
      {r.goal > 0 && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-300/60">
          <div className={`h-full rounded-full ${r.dot}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Spark({ r, days, hover, n }: { r: Row; days: string[]; hover: number | null; n: number }) {
  const maskedVals = days.filter((_, i) => r.mask[i]).map(r.get);
  // Zoom the y-axis into the data's own range (not 0-based) so the trend is
  // visible — magnitude-vs-goal is the scoreboard's job, not the sparkline's.
  const dataMin = maskedVals.length ? Math.min(...maskedVals) : 0;
  const dataMax = maskedVals.length ? Math.max(...maskedVals) : 1;
  const span = dataMax - dataMin || Math.max(dataMax * 0.1, 1);
  const lo = Math.max(0, dataMin - span * 0.2);
  const hi = dataMax + span * 0.2;

  const x = (i: number) => PADX + (n <= 1 ? IW / 2 : (i / (n - 1)) * IW);
  const y = (value: number) =>
    PADY + IH - ((Math.max(lo, Math.min(hi, value)) - lo) / (hi - lo)) * IH;

  let d = "";
  let pen = false;
  days.forEach((day, i) => {
    if (!r.mask[i]) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(r.get(day)).toFixed(1)} `;
    pen = true;
  });

  // Only draw the goal line when it falls within the zoomed range.
  const goalY = r.goal > 0 && r.goal >= lo && r.goal <= hi ? y(r.goal) : null;
  const onDay = hover != null && r.mask[hover];

  return (
    <svg viewBox={`0 0 ${W} ${HH}`} width="100%" className={r.cls}>
      {goalY != null && (
        <line
          x1={PADX}
          x2={W - PADX}
          y1={goalY}
          y2={goalY}
          className="stroke-base-content/20"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {hover != null && (
        <line
          x1={x(hover)}
          x2={x(hover)}
          y1={PADY}
          y2={PADY + IH}
          className="stroke-base-content/20"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {onDay && <circle cx={x(hover!)} cy={y(r.get(days[hover!]))} r={3.5} fill="currentColor" />}
    </svg>
  );
}
