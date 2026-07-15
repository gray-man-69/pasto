"use client";

import { useRef, useState } from "react";
import type { Goals, Nutrients } from "@/lib/types";

// Two linked blocks:
//  • "Daily average" — a scoreboard: one bar per metric vs its goal.
//  • "Trend" — small multiples: one sparkline per metric (own scale, real units).
// They share a hover: pointing at a day on the trend updates the scoreboard's
// numbers + bars to that day. Averages are over logged days only.

type Key = "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g";
const METRICS: { key: Key; label: string; cls: string; dot: string; unit: string }[] = [
  { key: "kcal", label: "Calories", cls: "text-primary", dot: "bg-primary", unit: "" },
  { key: "protein_g", label: "Protein", cls: "text-sky-400", dot: "bg-sky-400", unit: "g" },
  { key: "carbs_g", label: "Carbs", cls: "text-rose-400", dot: "bg-rose-400", unit: "g" },
  { key: "fat_g", label: "Fat", cls: "text-orange-400", dot: "bg-orange-400", unit: "g" },
  { key: "fiber_g", label: "Fiber", cls: "text-emerald-400", dot: "bg-emerald-400", unit: "g" },
];

const W = 320;
const HH = 28;
const PADX = 2;
const PADY = 4;
const IW = W - PADX * 2;
const IH = HH - PADY * 2;

const val = (m: Nutrients | undefined, key: Key) => m?.[key] ?? 0;

export default function MetricsTrend({
  days,
  dayTotals,
  goals,
  caption,
}: {
  days: string[];
  dayTotals: Map<string, Nutrients>;
  goals: Goals;
  caption?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = days.length;
  const logged = days.map((d) => (dayTotals.get(d)?.kcal ?? 0) > 0);
  const anyLogged = logged.some(Boolean);

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
          {METRICS.map((m) => (
            <AvgRow
              key={m.key}
              m={m}
              days={days}
              dayTotals={dayTotals}
              goal={goals[m.key] || 0}
              logged={logged}
              hover={hover}
            />
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
          {METRICS.map((m) => (
            <Spark
              key={m.key}
              m={m}
              days={days}
              dayTotals={dayTotals}
              goal={goals[m.key] || 0}
              logged={logged}
              hover={hover}
              n={n}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function avgOf(days: string[], logged: boolean[], dayTotals: Map<string, Nutrients>, key: Key) {
  const vals = days.filter((_, i) => logged[i]).map((d) => val(dayTotals.get(d), key));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function AvgRow({
  m,
  days,
  dayTotals,
  goal,
  logged,
  hover,
}: {
  m: (typeof METRICS)[number];
  days: string[];
  dayTotals: Map<string, Nutrients>;
  goal: number;
  logged: boolean[];
  hover: number | null;
}) {
  const onDay = hover != null && logged[hover];
  const shown = onDay ? val(dayTotals.get(days[hover!]), m.key) : avgOf(days, logged, dayTotals, m.key);
  const pct = goal > 0 ? Math.min(100, (shown / goal) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${m.dot}`} />
          <span className="font-medium">{m.label}</span>
        </span>
        <span className="tabular-nums">
          {!onDay && <span className="text-base-content/35">avg </span>}
          <span className="font-semibold">
            {Math.round(shown)}
            {m.unit}
          </span>
          <span className="text-base-content/40"> / {Math.round(goal)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-300/60">
        <div className={`h-full rounded-full ${m.dot}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Spark({
  m,
  days,
  dayTotals,
  goal,
  logged,
  hover,
  n,
}: {
  m: (typeof METRICS)[number];
  days: string[];
  dayTotals: Map<string, Nutrients>;
  goal: number;
  logged: boolean[];
  hover: number | null;
  n: number;
}) {
  const v = (d: string) => val(dayTotals.get(d), m.key);
  const loggedVals = days.filter((_, i) => logged[i]).map(v);
  const dataMax = loggedVals.length ? Math.max(...loggedVals) : 0;
  const yMax = Math.max(goal, dataMax) * 1.12 || 1;

  const x = (i: number) => PADX + (n <= 1 ? IW / 2 : (i / (n - 1)) * IW);
  const y = (value: number) => PADY + IH - (Math.min(value, yMax) / yMax) * IH;

  let d = "";
  let pen = false;
  days.forEach((day, i) => {
    if (!logged[i]) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v(day)).toFixed(1)} `;
    pen = true;
  });

  const goalY = goal > 0 ? y(goal) : null;
  const onDay = hover != null && logged[hover];

  return (
    <svg viewBox={`0 0 ${W} ${HH}`} width="100%" className={m.cls}>
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
      {onDay && (
        <circle cx={x(hover!)} cy={y(v(days[hover!]))} r={3.5} fill="currentColor" />
      )}
    </svg>
  );
}
