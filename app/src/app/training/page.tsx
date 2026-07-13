"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import MuscleMap from "@/components/MuscleMap";
import { allCustomExercises } from "@/lib/db";
import { searchExercises } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";

export default function TrainingPage() {
  const customExercises = useLiveQuery(() => allCustomExercises(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [detail, setDetail] = useState<Exercise | null>(null);

  useEffect(() => {
    let active = true;
    searchExercises(query, customExercises ?? []).then((r) => active && setResults(r));
    return () => {
      active = false;
    };
  }, [query, customExercises]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">Training</h1>

      {/* What's coming — honest placeholder while the rest is built out. */}
      <div className="rounded-2xl border border-dashed border-base-300 p-4 text-sm text-base-content/50">
        <span className="font-medium text-base-content/70">Your split lives here soon.</span>{" "}
        Building your routines (split days), logging live workouts, and progressive-overload
        suggestions land next. For now, explore the exercise library.
      </div>

      <div>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
          Exercise library
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises… (e.g. bench, squat, biceps)"
          className="input input-bordered w-full"
        />
        <ul className="mt-2 flex flex-col gap-1.5">
          {results.map((ex) => (
            <li key={ex.id}>
              <button
                onClick={() => setDetail(ex)}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-base-300/60 bg-base-100 px-4 py-3 text-left transition-colors hover:border-primary/40"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{ex.name}</span>
                    {ex.custom && (
                      <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        custom
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs capitalize text-base-content/50">
                    {ex.primaryMuscles.join(", ")}
                    {ex.equipment ? ` · ${ex.equipment}` : ""}
                  </span>
                </span>
                {ex.mechanic && (
                  <span className="shrink-0 rounded-full bg-base-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-base-content/50">
                    {ex.mechanic}
                  </span>
                )}
              </button>
            </li>
          ))}
          {results.length === 0 && query.trim() && (
            <li className="px-1 py-6 text-center text-sm text-base-content/40">
              No exercises match “{query.trim()}”.
            </li>
          )}
        </ul>
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-base-300 bg-base-100 p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{detail.name}</h2>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setDetail(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <MuscleMap primary={detail.primaryMuscles} secondary={detail.secondaryMuscles ?? []} />

            <div className="mt-4 flex flex-wrap gap-1.5">
              {detail.equipment && (
                <span className="rounded-full bg-base-200 px-2.5 py-1 text-xs capitalize text-base-content/70">
                  {detail.equipment}
                </span>
              )}
              {detail.mechanic && (
                <span className="rounded-full bg-base-200 px-2.5 py-1 text-xs capitalize text-base-content/70">
                  {detail.mechanic}
                </span>
              )}
            </div>

            <div className="mt-3 text-sm">
              <div>
                <span className="text-base-content/50">Primary:</span>{" "}
                <span className="font-medium capitalize text-sky-400">
                  {detail.primaryMuscles.join(", ")}
                </span>
              </div>
              {detail.secondaryMuscles?.length ? (
                <div className="mt-1">
                  <span className="text-base-content/50">Secondary:</span>{" "}
                  <span className="capitalize text-base-content/70">
                    {detail.secondaryMuscles.join(", ")}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
