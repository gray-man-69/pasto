"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { activeSession, allRoutines, completedSessions } from "@/lib/db";
import { groupOfMuscle } from "@/lib/exercises";
import { sessionVolume } from "@/lib/progression";
import type { Routine, WorkoutSession } from "@/lib/types";

function dayLabel(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function TrainingPage() {
  const routines = useLiveQuery(() => allRoutines(), []);
  const active = useLiveQuery(() => activeSession(), []);
  const recent = useLiveQuery(() => completedSessions(), []);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Training</h1>
        <Link href="/exercises" className="btn btn-ghost btn-sm">
          Exercises
        </Link>
      </div>

      {active && (
        <Link
          href={`/workout?id=${active.id}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3"
        >
          <span>
            <span className="block text-sm font-semibold text-primary">Workout in progress</span>
            <span className="block text-xs text-base-content/60">{active.routineName} — tap to resume</span>
          </span>
          <span className="text-primary">▶</span>
        </Link>
      )}

      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
          Your routines
        </h2>
        <Link href="/routine" className="btn btn-primary btn-sm rounded-full px-4 shadow-lg shadow-primary/20">
          ＋ New
        </Link>
      </div>

      {routines === undefined ? (
        <div className="py-10 text-center text-base-content/30">Loading…</div>
      ) : routines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-base-300 py-12 text-center">
          <div className="text-sm text-base-content/50">No routines yet.</div>
          <Link href="/routine" className="text-sm font-medium text-primary hover:underline">
            Create your first split day →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {routines.map((r) => (
            <RoutineCard key={r.id} r={r} />
          ))}
        </ul>
      )}

      {recent && recent.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Recent workouts
          </h2>
          <ul className="flex flex-col gap-1.5">
            {recent.slice(0, 5).map((s) => (
              <RecentRow key={s.id} s={s} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RoutineCard({ r }: { r: Routine }) {
  const groups = [...new Set(r.exercises.map((e) => groupOfMuscle(e.primaryMuscles[0])))];
  return (
    <li className="flex items-center gap-1 rounded-2xl border border-base-300/60 bg-base-100 pr-2 transition-colors hover:border-primary/40">
      <Link href={`/workout?routine=${r.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3.5 pl-4">
        <span className="min-w-0">
          <span className="block truncate font-medium">{r.name}</span>
          <span className="mt-0.5 block truncate text-xs text-base-content/50">
            {r.exercises.length} exercise{r.exercises.length === 1 ? "" : "s"}
            {groups.length ? ` · ${groups.join(", ")}` : ""}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          Start
        </span>
      </Link>
      <Link
        href={`/routine?id=${r.id}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base-content/40 hover:bg-base-300/60 hover:text-base-content"
        aria-label={`Edit ${r.name}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 20h9" strokeLinecap="round" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </li>
  );
}

function RecentRow({ s }: { s: WorkoutSession }) {
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
  const vol = Math.round(sessionVolume(s));
  return (
    <li className="flex items-center justify-between gap-2 rounded-2xl border border-base-300/60 bg-base-100 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{s.routineName ?? "Workout"}</span>
        <span className="block text-xs text-base-content/50">{dayLabel(s.date)}</span>
      </span>
      <span className="shrink-0 text-right text-xs tabular-nums text-base-content/50">
        {sets} sets
        <span className="block text-base-content/35">{vol.toLocaleString()} kg vol</span>
      </span>
    </li>
  );
}
