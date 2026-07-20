"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { MuscleThumb } from "@/components/MuscleMap";
import {
  activeMesocycle,
  addDays,
  allMesocycles,
  completedSessions,
  dailyTotalsBetween,
  getGoals,
  localDate,
  weekStart,
} from "@/lib/db";
import { coachTips } from "@/lib/coach";
import { mesoWeek } from "@/lib/mesocycle";
import { workingSets } from "@/lib/progression";
import { exerciseProgress, volumeByMuscle } from "@/lib/progress";
import type { ExerciseProgress } from "@/lib/progress";
import type { Mesocycle } from "@/lib/types";

// Science-based hypertrophy target: ~10–20 hard sets per muscle per week.
const MEV = 10;
const TARGET_MAX = 20;
const MAX_WEEKS = 8; // columns shown in the "recent weeks" view

function shortWeek(start: string): string {
  return new Date(start + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Heatmap cell colour: dim when empty, amber below MEV, lime in/above the range.
function heat(sets: number): { bg: string; text: string } {
  if (sets <= 0) return { bg: "rgba(148,163,184,0.07)", text: "text-base-content/20" };
  if (sets < MEV) {
    const t = sets / MEV;
    return { bg: `rgba(251,191,36,${(0.14 + t * 0.3).toFixed(3)})`, text: "text-base-content/90" };
  }
  const t = Math.min(1, (sets - MEV) / (TARGET_MAX - MEV));
  return { bg: `rgba(182,242,89,${(0.2 + t * 0.4).toFixed(3)})`, text: "text-base-content" };
}

type Wk = { start: string; label: string; deload: boolean; future: boolean };

export default function ProgressPage() {
  const sessions = useLiveQuery(() => completedSessions(), []);
  const active = useLiveQuery(() => activeMesocycle(), []);
  const blocks = useLiveQuery(() => allMesocycles(), []);
  const goals = useLiveQuery(() => getGoals(), []);
  const weekTotals = useLiveQuery(() => {
    const ws = weekStart(localDate());
    return dailyTotalsBetween(ws, addDays(ws, 6));
  }, []);
  const [view, setView] = useState<number | "recent" | null>(null);

  const today = localDate();
  const all = sessions ?? [];
  const blockList = blocks ?? [];

  // Which block (or the rolling "recent weeks") to chart.
  const effectiveView = view ?? active?.id ?? blockList[0]?.id ?? "recent";
  const selectedBlock: Mesocycle | null =
    typeof effectiveView === "number" ? blockList.find((b) => b.id === effectiveView) ?? null : null;

  // Columns: the block's weeks (W1…Wn, deload marked) or the last weeks with data.
  let weeks: Wk[] = [];
  if (selectedBlock) {
    for (let i = 0; i < selectedBlock.weeks; i++) {
      const start = addDays(selectedBlock.startDate, i * 7);
      weeks.push({
        start,
        label: `W${i + 1}`,
        deload: !!selectedBlock.deload && i === selectedBlock.weeks - 1,
        future: start > weekStart(today),
      });
    }
  } else {
    const wk = new Set(all.map((s) => weekStart(s.date)));
    wk.add(weekStart(today));
    weeks = [...wk]
      .sort()
      .slice(-MAX_WEEKS)
      .map((start) => ({ start, label: shortWeek(start), deload: false, future: false }));
  }

  // Per-week per-muscle set counts.
  const perWeek = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const w of weeks) {
    const m = new Map<string, number>();
    for (const { muscle, sets } of volumeByMuscle(all.filter((s) => weekStart(s.date) === w.start))) {
      m.set(muscle, sets);
      totals.set(muscle, (totals.get(muscle) ?? 0) + sets);
    }
    perWeek.set(w.start, m);
  }
  const muscles = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);

  // The heatmap earns its place only with 2+ weeks to trend across; a single week
  // is the same numbers as the bars, so we show just the bars then.
  const showHeatmap = weeks.length >= 2 && muscles.length > 0;
  const soloWeek = weeks.length ? weeks[weeks.length - 1].start : null;
  const soloDetail =
    !showHeatmap && soloWeek ? volumeByMuscle(all.filter((s) => weekStart(s.date) === soloWeek)) : [];
  const soloLabel = soloWeek
    ? soloWeek === weekStart(today)
      ? `This week · ${shortWeek(soloWeek)}`
      : `Week of ${shortWeek(soloWeek)}`
    : "";
  const progress = exerciseProgress(all);

  // ---- Coach: prioritised, science-based actions from this week's data ----
  const wkStart = weekStart(today);
  const thisWeekSessions = all.filter((s) => weekStart(s.date) === wkStart);
  const rated = thisWeekSessions
    .flatMap((s) => s.exercises)
    .flatMap((e) => workingSets(e.sets))
    .filter((st) => st.rir != null);
  const proteins = weekTotals ? [...weekTotals.values()].map((n) => n.protein_g) : [];
  const wkInfo = active ? mesoWeek(active, today) : null;
  const accumWeeks = active ? active.weeks - (active.deload ? 1 : 0) : 0;
  const tips = coachTips({
    volume: volumeByMuscle(thisWeekSessions),
    avgRir: rated.length ? Math.round(rated.reduce((n, st) => n + (st.rir ?? 0), 0) / rated.length) : null,
    ratedSets: rated.length,
    proteinAvg: proteins.length ? proteins.reduce((a, b) => a + b, 0) / proteins.length : null,
    proteinGoal: goals?.protein_g ?? 0,
    proteinDaysTracked: proteins.length,
    deloadNext: !!active?.deload && wkInfo?.phase === "accumulation" && wkInfo.index === accumWeeks - 1,
    deloadNow: wkInfo?.phase === "deload",
    trainedThisWeek: thisWeekSessions.length > 0,
  });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Progress</h1>
        <Link href="/training" className="btn btn-ghost btn-sm">
          ← Training
        </Link>
      </div>

      {sessions === undefined ? (
        <div className="py-10 text-center text-base-content/30">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-base-300 py-12 text-center">
          <div className="text-sm text-base-content/50">No finished workouts yet.</div>
          <Link href="/training" className="text-sm font-medium text-primary hover:underline">
            Start a workout →
          </Link>
        </div>
      ) : (
        <>
          {/* Coach — what to do this week for the biggest gains */}
          {tips.length > 0 && (
            <section className="rounded-3xl border border-primary/25 bg-primary/[0.03] p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-primary/70">Coach · this week</h2>
              <p className="mb-3 mt-1 text-[11px] text-base-content/40">
                Biggest gains first — from your logged training &amp; nutrition.
              </p>
              <ul className="flex flex-col gap-2.5">
                {tips.map((t, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm leading-snug">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        t.level === "warn" ? "bg-amber-400" : t.level === "good" ? "bg-primary" : "bg-sky-400"
                      }`}
                    />
                    <span className={t.level === "warn" ? "text-base-content/90" : "text-base-content/65"}>{t.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Block selector */}
          {blockList.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {blockList.map((b) => (
                <Chip key={b.id} active={effectiveView === b.id} onClick={() => setView(b.id!)}>
                  {b.id === active?.id && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
                  {b.name ?? shortWeek(b.startDate)}
                </Chip>
              ))}
              <Chip active={effectiveView === "recent"} onClick={() => setView("recent")}>
                Recent weeks
              </Chip>
            </div>
          )}

          {showHeatmap ? (
            /* Volume heatmap: muscles × weeks */
            <section className="rounded-3xl border border-base-300 bg-base-100 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
                Volume · sets per muscle{selectedBlock ? ` · ${selectedBlock.name ?? "block"}` : ""}
              </h2>
              <p className="mb-3 mt-1 text-[11px] leading-snug text-base-content/40">
                ~10–20 hard sets/muscle/week drives growth. Read a row for a muscle&apos;s trend across
                the block, a column for that week&apos;s balance.
              </p>
              <div className="overflow-x-auto">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `5.5rem repeat(${weeks.length}, minmax(2rem, 1fr))` }}
                >
                  <div />
                  {weeks.map((w) => (
                    <div
                      key={w.start}
                      className={`py-1 text-center text-[10px] font-semibold tabular-nums ${
                        w.deload ? "text-amber-500" : w.future ? "text-base-content/25" : "text-base-content/50"
                      }`}
                      title={shortWeek(w.start)}
                    >
                      {w.deload ? "D" : w.label}
                    </div>
                  ))}
                  {muscles.map((muscle) => (
                    <div key={muscle} className="contents">
                      <span className="flex items-center truncate pr-1 text-xs capitalize text-base-content/70">
                        {muscle}
                      </span>
                      {weeks.map((w) => {
                        const sets = perWeek.get(w.start)?.get(muscle) ?? 0;
                        const c = heat(sets);
                        return (
                          <div
                            key={w.start}
                            style={{ backgroundColor: c.bg }}
                            className={`grid h-8 place-items-center rounded-md text-[11px] font-medium tabular-nums ${c.text}`}
                          >
                            {sets > 0 ? sets : ""}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[10px] text-base-content/40">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(251,191,36,0.4)" }} />
                  below 10
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(182,242,89,0.5)" }} />
                  10–20 range
                </span>
                {selectedBlock?.deload && <span className="ml-auto text-amber-500">D = deload week</span>}
              </div>
            </section>
          ) : (
            /* Single week → bars (the heatmap would just be one column) */
            <section className="rounded-3xl border border-base-300 bg-base-100 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
                Volume · sets per muscle
              </h2>
              <p className="mb-3 mt-1 text-[11px] leading-snug text-base-content/40">
                {soloLabel} · ~10–20 hard sets/muscle/week drives growth (Schoenfeld 2017; RP landmarks).
              </p>
              {soloDetail.length === 0 ? (
                <div className="py-6 text-center text-sm text-base-content/40">No sets logged.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {soloDetail.map((v) => (
                    <VolRow key={v.muscle} muscle={v.muscle} sets={v.sets} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Per-exercise PRs + trend */}
          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
              Exercises · PR &amp; volume
            </h2>
            <ul className="flex flex-col gap-1.5">
              {progress.map((p) => (
                <ProgRow key={p.exerciseId} p={p} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/60 hover:bg-base-300"
      }`}
    >
      {children}
    </button>
  );
}

function VolRow({ muscle, sets }: { muscle: string; sets: number }) {
  const pct = Math.min(100, (sets / TARGET_MAX) * 100);
  const enough = sets >= MEV;
  const hint =
    sets < MEV
      ? { text: `＋${MEV - sets} set${MEV - sets === 1 ? "" : "s"} to reach the growth range`, cls: "text-amber-500" }
      : sets > TARGET_MAX
        ? { text: "above 20 — plenty; make sure you're recovering", cls: "text-base-content/40" }
        : { text: "in the 10–20 growth range", cls: "text-primary/70" };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-sm capitalize">{muscle}</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-base-300/50">
          <div
            className={`h-full rounded-full ${enough ? "bg-primary" : "bg-amber-400"}`}
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-0 h-full w-px bg-base-content/30"
            style={{ left: `${(MEV / TARGET_MAX) * 100}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-base-content/70">
          {sets} <span className="text-base-content/35">sets</span>
        </span>
      </div>
      <div className={`pl-24 text-[10px] ${hint.cls}`}>{hint.text}</div>
    </div>
  );
}

function ProgRow({ p }: { p: ExerciseProgress }) {
  const [open, setOpen] = useState(false);
  const canChart = p.points.length >= 2;
  return (
    <li className="overflow-hidden rounded-2xl border border-base-300/60 bg-base-100">
      <button
        onClick={() => canChart && setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left ${canChart ? "" : "cursor-default"}`}
      >
        <MuscleThumb primary={p.primaryMuscles} secondary={p.secondaryMuscles ?? []} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{p.name}</div>
          <div className="mt-0.5 text-[11px] text-base-content/50">
            PR {p.bestWeight} kg · best vol {Math.round(p.bestVolume).toLocaleString()} kg
          </div>
          <div className="text-[11px] tabular-nums text-base-content/40">
            Vol last {Math.round(p.lastVolume).toLocaleString()} kg
          </div>
        </div>
        <MiniSpark points={p.volumes} />
        {canChart && (
          <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-base-content/30 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {open && canChart && <ExerciseDetail p={p} />}
    </li>
  );
}

type Metric = "volume" | "weight";

function ExerciseDetail({ p }: { p: ExerciseProgress }) {
  const [metric, setMetric] = useState<Metric>("volume");
  const series = metric === "volume" ? p.volumes : p.weights;
  const caption: Record<Metric, string> = {
    volume: "Total work per session (Σ weight × reps) — your growth signal over time.",
    weight: "Heaviest weight lifted each session — your working-weight PR over time.",
  };
  return (
    <div className="border-t border-base-300/60 px-3 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <MetricChip active={metric === "volume"} onClick={() => setMetric("volume")}>
          Volume
        </MetricChip>
        <MetricChip active={metric === "weight"} onClick={() => setMetric("weight")}>
          Top weight (PR)
        </MetricChip>
        <span className="ml-auto text-[10px] font-medium tracking-wide text-base-content/35">kg</span>
      </div>
      <ExerciseChart points={series} dates={p.dates} />
      <p className="mt-1.5 text-[10px] leading-snug text-base-content/40">{caption[metric]}</p>
    </div>
  );
}

function MetricChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
        active ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/60 hover:bg-base-300"
      }`}
    >
      {children}
    </button>
  );
}

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function ExerciseChart({ points, dates }: { points: number[]; dates: string[] }) {
  const w = 320;
  const h = 128;
  const padX = 14;
  const padT = 20;
  const padB = 26;
  const mn = Math.min(...points);
  const mx = Math.max(...points);
  const span = mx - mn || Math.max(mx * 0.1, 1);
  const lo = mn - span * 0.18;
  const hi = mx + span * 0.18;
  const x = (i: number) => padX + (i / (points.length - 1)) * (w - 2 * padX);
  const y = (v: number) => padT + (h - padT - padB) - ((v - lo) / (hi - lo)) * (h - padT - padB);
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const showAll = points.length <= 6;
  const labelIdx = showAll
    ? points.map((_, i) => i)
    : [0, Math.round((points.length - 1) / 2), points.length - 1];
  const anchor = (i: number) => (i === 0 ? "start" : i === points.length - 1 ? "end" : "middle");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-primary" role="img" aria-label="Estimated 1RM over time">
      {/* baseline */}
      <line x1={padX} y1={h - padB} x2={w - padX} y2={h - padB} stroke="currentColor" strokeOpacity="0.12" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={i === points.length - 1 ? 3.2 : 2.4} fill="currentColor" />
          {(showAll || i === 0 || i === points.length - 1) && (
            <text x={x(i)} y={y(v) - 7} textAnchor={anchor(i)} fontSize="10" fill="currentColor" className="tabular-nums">
              {Math.round(v)}
            </text>
          )}
        </g>
      ))}
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={h - 8} textAnchor={anchor(i)} fontSize="9.5" fill="currentColor" fillOpacity="0.5">
          {fmtDate(dates[i])}
        </text>
      ))}
    </svg>
  );
}

function MiniSpark({ points }: { points: number[] }) {
  const w = 62;
  const h = 26;
  const pad = 3;
  if (!points.length) return null;
  const mn = Math.min(...points);
  const mx = Math.max(...points);
  const span = mx - mn || Math.max(mx * 0.1, 1);
  const lo = mn - span * 0.2;
  const hi = mx + span * 0.2;
  const x = (i: number) => pad + (points.length <= 1 ? (w - 2 * pad) / 2 : (i / (points.length - 1)) * (w - 2 * pad));
  const y = (v: number) => pad + (h - 2 * pad) - ((v - lo) / (hi - lo)) * (h - 2 * pad);
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0 text-primary">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {points.length === 1 && <circle cx={x(0)} cy={y(points[0])} r={2} fill="currentColor" />}
      {points.length > 1 && (
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r={2} fill="currentColor" />
      )}
    </svg>
  );
}
