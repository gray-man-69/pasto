"use client";

import { useRef, useState } from "react";
import type { Goals, Nutrients } from "@/lib/types";

// A multi-series daily trend. Calories (~2000) and macros (grams) live on very
// different scales, so each metric is indexed to % of its daily goal — one shared
// axis, 100% = goal. Lines carry the app's entity colors; hover shows the real
// absolute numbers for the day.

type Key = "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g";
const METRICS: { key: Key; label: string; cls: string; dot: string; unit: string }[] = [
  { key: "kcal", label: "Calories", cls: "text-primary", dot: "bg-primary", unit: "" },
  { key: "protein_g", label: "Protein", cls: "text-sky-400", dot: "bg-sky-400", unit: "g" },
  { key: "carbs_g", label: "Carbs", cls: "text-rose-400", dot: "bg-rose-400", unit: "g" },
  { key: "fat_g", label: "Fat", cls: "text-orange-400", dot: "bg-orange-400", unit: "g" },
  { key: "fiber_g", label: "Fiber", cls: "text-emerald-400", dot: "bg-emerald-400", unit: "g" },
];

const W = 340;
const H = 150;
const PADL = 26;
const PADR = 8;
const PADT = 10;
const PADB = 8;
const innerW = W - PADL - PADR;
const innerH = H - PADT - PADB;

export default function MetricsTrend({
  days,
  dayTotals,
  goals,
}: {
  days: string[];
  dayTotals: Map<string, Nutrients>;
  goals: Goals;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = days.length;
  const logged = days.map((d) => (dayTotals.get(d)?.kcal ?? 0) > 0);
  const anyLogged = logged.some(Boolean);

  const x = (i: number) => PADL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const pct = (key: Key, d: string) => {
    const g = goals[key] || 0;
    return g > 0 ? ((dayTotals.get(d)?.[key] ?? 0) / g) * 100 : 0;
  };

  let maxPct = 100;
  days.forEach((d, i) => {
    if (logged[i]) for (const m of METRICS) maxPct = Math.max(maxPct, pct(m.key, d));
  });
  const yMax = Math.min(250, Math.max(125, Math.ceil(maxPct / 25) * 25));
  const y = (p: number) => PADT + innerH - (Math.min(p, yMax) / yMax) * innerH;

  function pathFor(key: Key): string {
    let s = "";
    let pen = false;
    days.forEach((d, i) => {
      if (!logged[i]) {
        pen = false;
        return;
      }
      s += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(pct(key, d)).toFixed(1)} `;
      pen = true;
    });
    return s.trim();
  }

  function locate(e: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const dx = Math.abs(x(i) - px);
      if (dx < bd) {
        bd = dx;
        best = i;
      }
    }
    setHover(best);
  }

  const goalY = y(100);
  const showPoints = n <= 31;
  const hv = hover != null && logged[hover] ? hover : null;

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/40">
        Trend · % of daily goal
      </div>

      {!anyLogged ? (
        <div className="py-8 text-center text-sm text-base-content/40">
          Nothing logged in this range.
        </div>
      ) : (
        <div
          className="relative"
          onPointerMove={locate}
          onPointerDown={locate}
          onPointerLeave={() => setHover(null)}
        >
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ touchAction: "pan-y" }}>
            <line
              x1={PADL}
              x2={W - PADR}
              y1={goalY}
              y2={goalY}
              className="stroke-base-content/25"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text x={2} y={goalY + 3} className="fill-base-content/40" fontSize={8}>
              100%
            </text>
            <text x={2} y={PADT + 6} className="fill-base-content/30" fontSize={8}>
              {yMax}%
            </text>

            {hv != null && (
              <line
                x1={x(hv)}
                x2={x(hv)}
                y1={PADT}
                y2={PADT + innerH}
                className="stroke-base-content/20"
                strokeWidth={1}
              />
            )}

            {METRICS.map((m) => (
              <path
                key={m.key}
                d={pathFor(m.key)}
                className={m.cls}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {showPoints &&
              METRICS.map((m) =>
                days.map((d, i) =>
                  logged[i] ? (
                    <circle
                      key={m.key + i}
                      cx={x(i)}
                      cy={y(pct(m.key, d))}
                      r={hv === i ? 2.8 : 1.7}
                      className={m.cls}
                      fill="currentColor"
                    />
                  ) : null,
                ),
              )}
          </svg>

          {hv != null && (
            <Tooltip day={days[hv]} totals={dayTotals.get(days[hv])!} leftPct={(x(hv) / W) * 100} />
          )}
        </div>
      )}

      {/* Legend — identity is never color-alone */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {METRICS.map((m) => (
          <span key={m.key} className="flex items-center gap-1.5 text-[11px] text-base-content/60">
            <span className={`h-2 w-2 rounded-full ${m.dot}`} />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tooltip({ day, totals, leftPct }: { day: string; totals: Nutrients; leftPct: number }) {
  const label = new Date(day + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const left = Math.min(Math.max(leftPct, 2), 58);
  return (
    <div
      className="pointer-events-none absolute top-0 z-20 rounded-xl border border-base-300 bg-base-100/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur"
      style={{ left: `${left}%` }}
    >
      <div className="mb-1 font-medium">{label}</div>
      {METRICS.map((m) => (
        <div key={m.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-base-content/60">
            <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
            {m.label}
          </span>
          <span className="tabular-nums text-base-content/90">
            {Math.round(totals[m.key])}
            {m.unit}
          </span>
        </div>
      ))}
    </div>
  );
}
