"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { allRoutines } from "@/lib/db";
import { groupOfMuscle } from "@/lib/exercises";
import type { Routine } from "@/lib/types";

export default function TrainingPage() {
  const routines = useLiveQuery(() => allRoutines(), []);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Training</h1>
        <Link href="/exercises" className="btn btn-ghost btn-sm">
          Exercises
        </Link>
      </div>

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
    </div>
  );
}

function RoutineCard({ r }: { r: Routine }) {
  const groups = [...new Set(r.exercises.map((e) => groupOfMuscle(e.primaryMuscles[0])))];
  return (
    <li>
      <Link
        href={`/routine?id=${r.id}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-base-300/60 bg-base-100 px-4 py-3.5 transition-colors hover:border-primary/40"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{r.name}</span>
          <span className="mt-0.5 block truncate text-xs text-base-content/50">
            {r.exercises.length} exercise{r.exercises.length === 1 ? "" : "s"}
            {groups.length ? ` · ${groups.join(", ")}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-base-content/30">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
    </li>
  );
}
