"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import CustomExerciseForm from "@/components/CustomExerciseForm";
import MuscleMap, { MuscleThumb } from "@/components/MuscleMap";
import { allCustomExercises } from "@/lib/db";
import { MUSCLE_GROUPS, groupOf, loadExercises } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";

// Browse/search the exercise library, grouped by muscle. When `onSelect` is
// given it's a picker (rows toggle, added ones marked); otherwise a read-only
// browse. Reused by the routine builder and the standalone library page.
export default function ExercisePicker({
  onSelect,
  addedIds = [],
}: {
  onSelect?: (ex: Exercise) => void;
  addedIds?: string[];
}) {
  const custom = useLiveQuery(() => allCustomExercises(), []);
  const [all, setAll] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);

  useEffect(() => {
    loadExercises().then((l) => setAll([...(custom ?? []), ...l]));
  }, [custom]);

  const added = new Set(addedIds);
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      all
        .filter(
          (e) =>
            (!group || groupOf(e) === group) &&
            (!q ||
              e.name.toLowerCase().includes(q) ||
              e.primaryMuscles.some((m) => m.toLowerCase().includes(q)) ||
              (e.equipment ?? "").toLowerCase().includes(q)),
        )
        .slice(0, 120),
    [all, group, q],
  );

  function row(ex: Exercise) {
    const isAdded = added.has(ex.id);
    return (
      <>
        <span
          role="button"
          aria-label={`See muscles worked by ${ex.name}`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setDetail(ex);
          }}
          className="shrink-0 rounded-lg ring-primary/40 hover:ring-2"
        >
          <MuscleThumb primary={ex.primaryMuscles} secondary={ex.secondaryMuscles ?? []} />
        </span>
        <span className="min-w-0 flex-1">
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
        {onSelect && (
          <span className={`text-lg leading-none ${isAdded ? "text-primary" : "text-base-content/30"}`}>
            {isAdded ? "✓" : "＋"}
          </span>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises…"
        className="input input-bordered w-full"
      />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Chip label="All" active={!group} onClick={() => setGroup(null)} />
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g} label={g} active={group === g} onClick={() => setGroup(group === g ? null : g)} />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {results.map((ex) => (
          <li key={ex.id}>
            {onSelect ? (
              <button
                onClick={() => onSelect(ex)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors ${
                  added.has(ex.id)
                    ? "border-primary bg-primary/5"
                    : "border-base-300/60 bg-base-100 hover:border-primary/40"
                }`}
              >
                {row(ex)}
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-base-300/60 bg-base-100 px-3 py-2">
                {row(ex)}
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        onClick={() => setCreating(true)}
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-base-300 py-3 text-sm text-base-content/60 transition-colors hover:border-primary/50 hover:text-base-content"
      >
        <span className="text-base leading-none">＋</span>
        {query.trim() ? `Create “${query.trim()}”` : "Create custom exercise"}
      </button>

      {creating && (
        <CustomExerciseForm
          initialName={query.trim()}
          onClose={() => setCreating(false)}
          onCreated={(ex) => {
            setCreating(false);
            setQuery("");
            onSelect?.(ex);
          }}
        />
      )}

      {detail && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-base-300 bg-base-100 p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{detail.name}</h2>
                <p className="text-xs capitalize text-base-content/50">
                  {detail.primaryMuscles.join(", ")}
                  {detail.equipment ? ` · ${detail.equipment}` : ""}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setDetail(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="my-3 rounded-2xl bg-base-200/40 py-3">
              <MuscleMap primary={detail.primaryMuscles} secondary={detail.secondaryMuscles ?? []} height="15rem" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#bef264" }} />
                <span className="capitalize">{detail.primaryMuscles.join(", ")}</span>
              </span>
              {detail.secondaryMuscles?.length ? (
                <span className="flex items-center gap-1.5 text-base-content/50">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#4d7c0f" }} />
                  <span className="capitalize">{detail.secondaryMuscles.join(", ")}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/60 hover:bg-base-300"
      }`}
    >
      {label}
    </button>
  );
}
