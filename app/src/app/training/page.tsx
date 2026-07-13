"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { allCustomExercises } from "@/lib/db";
import { searchExercises } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";

export default function TrainingPage() {
  const customExercises = useLiveQuery(() => allCustomExercises(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);

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
            <li
              key={ex.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-base-300/60 bg-base-100 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{ex.name}</span>
                  {ex.custom && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      custom
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs capitalize text-base-content/50">
                  {ex.primaryMuscles.join(", ")}
                  {ex.equipment ? ` · ${ex.equipment}` : ""}
                </div>
              </div>
              {ex.mechanic && (
                <span className="shrink-0 rounded-full bg-base-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-base-content/50">
                  {ex.mechanic}
                </span>
              )}
            </li>
          ))}
          {results.length === 0 && query.trim() && (
            <li className="px-1 py-6 text-center text-sm text-base-content/40">
              No exercises match “{query.trim()}”.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
