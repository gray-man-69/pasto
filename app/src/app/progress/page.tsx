"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { MuscleThumb } from "@/components/MuscleMap";
import { addDays, completedSessions, weekStart } from "@/lib/db";
import { exerciseProgress, volumeByMuscle } from "@/lib/progress";
import type { ExerciseProgress } from "@/lib/progress";

// Science-based hypertrophy target: ~10–20 hard sets per muscle per week.
const MEV = 10;
const TARGET_MAX = 20;

export default function ProgressPage() {
  const sessions = useLiveQuery(() => completedSessions(), []);

  const wk = weekStart();
  const wkEnd = addDays(wk, 6);
  const weekSessions = (sessions ?? []).filter((s) => s.date >= wk && s.date <= wkEnd);
  const volume = volumeByMuscle(weekSessions);
  const progress = exerciseProgress(sessions ?? []);

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
          {/* Weekly volume per muscle */}
          <section className="rounded-3xl border border-base-300 bg-base-100 p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
                Weekly volume · sets per muscle
              </h2>
            </div>
            <p className="mb-3 text-[11px] text-base-content/40">
              ~10–20 hard sets per muscle per week is the hypertrophy range.
            </p>
            {volume.length === 0 ? (
              <div className="py-6 text-center text-sm text-base-content/40">
                No sets logged this week.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {volume.map((v) => (
                  <VolRow key={v.muscle} muscle={v.muscle} sets={v.sets} />
                ))}
              </div>
            )}
          </section>

          {/* Per-exercise PRs + trend */}
          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
              Exercises · best est. 1RM
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

function VolRow({ muscle, sets }: { muscle: string; sets: number }) {
  const pct = Math.min(100, (sets / TARGET_MAX) * 100);
  const enough = sets >= MEV;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm capitalize">{muscle}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-base-300/50">
        <div
          className={`h-full rounded-full ${enough ? "bg-primary" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
        {/* MEV marker at 10 sets */}
        <div
          className="absolute top-0 h-full w-px bg-base-content/30"
          style={{ left: `${(MEV / TARGET_MAX) * 100}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-base-content/70">
        {sets} <span className="text-base-content/35">sets</span>
      </span>
    </div>
  );
}

function ProgRow({ p }: { p: ExerciseProgress }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-base-300/60 bg-base-100 px-3 py-2">
      <MuscleThumb primary={p.primaryMuscles} secondary={p.secondaryMuscles ?? []} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{p.name}</div>
        <div className="mt-0.5 text-[11px] text-base-content/50">
          PR {Math.round(p.bestE1rm)} kg e1RM · top {p.bestWeight} kg
        </div>
        <div className="text-[11px] tabular-nums text-base-content/40">
          Vol last {Math.round(p.lastVolume).toLocaleString()} · best{" "}
          {Math.round(p.bestVolume).toLocaleString()} kg
        </div>
      </div>
      <MiniSpark points={p.points} />
    </li>
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
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length === 1 && <circle cx={x(0)} cy={y(points[0])} r={2} fill="currentColor" />}
      {points.length > 1 && (
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r={2} fill="currentColor" />
      )}
    </svg>
  );
}
