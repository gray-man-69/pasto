"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import CustomExerciseForm from "@/components/CustomExerciseForm";
import { MuscleThumb } from "@/components/MuscleMap";
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
        <MuscleThumb primary={ex.primaryMuscles} secondary={ex.secondaryMuscles ?? []} />
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
