"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ExercisePicker from "@/components/ExercisePicker";
import { MuscleThumb } from "@/components/MuscleMap";
import NumberField from "@/components/NumberField";
import { deleteRoutine, getRoutine, saveRoutine } from "@/lib/db";
import { defaultRoutineExercise } from "@/lib/exercises";
import type { Exercise, RoutineExercise } from "@/lib/types";

export default function RoutinePage() {
  const router = useRouter();
  const [id, setId] = useState<number | null>(null);
  const [order, setOrder] = useState(0);
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load an existing routine when editing (?id=…); otherwise start blank.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("id");
    if (raw) {
      getRoutine(Number(raw)).then((r) => {
        if (r) {
          setId(r.id ?? null);
          setOrder(r.order);
          setName(r.name);
          setExercises(r.exercises);
        }
      });
    } else {
      setOrder(Date.now());
    }
  }, []);

  function toggleExercise(ex: Exercise) {
    setExercises((prev) =>
      prev.some((e) => e.exerciseId === ex.id)
        ? prev.filter((e) => e.exerciseId !== ex.id)
        : [...prev, defaultRoutineExercise(ex)],
    );
  }
  function update(i: number, patch: Partial<RoutineExercise>) {
    setExercises((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function remove(i: number) {
    setExercises((prev) => prev.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    setExercises((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function toggleSuperset(i: number) {
    setExercises((prev) => {
      const ex = prev[i];
      const prevSame = i > 0 && !!ex.superset && prev[i - 1].superset === ex.superset;
      const nextSame = !!ex.superset && prev[i + 1]?.superset === ex.superset;
      if (ex.superset && (prevSame || nextSame)) {
        const g = ex.superset;
        return prev.map((e) => (e.superset === g ? { ...e, superset: undefined } : e));
      }
      if (i + 1 >= prev.length) return prev;
      const g = crypto.randomUUID();
      return prev.map((e, idx) => (idx === i || idx === i + 1 ? { ...e, superset: g } : e));
    });
  }

  async function save() {
    if (!name.trim() || exercises.length === 0) return;
    setSaving(true);
    await saveRoutine({ id: id ?? undefined, name: name.trim(), order, exercises });
    router.push("/training");
  }
  async function del() {
    if (id == null) return;
    setSaving(true);
    await deleteRoutine(id);
    router.push("/training");
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{id == null ? "New routine" : "Edit routine"}</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/training")}>
          Cancel
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-base-content/60">Routine name</span>
        <input
          autoFocus={id == null}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push A · Legs · Upper"
          className="input input-bordered w-full"
        />
      </label>

      <div className="flex flex-col gap-2">
        {exercises.map((e, i) => {
          const grp = e.superset;
          const prevSame = i > 0 && !!grp && exercises[i - 1].superset === grp;
          const nextSame = !!grp && exercises[i + 1]?.superset === grp;
          const inSuperset = !!grp && (prevSame || nextSame);
          return (
          <div
            key={e.exerciseId}
            className={`rounded-2xl border bg-base-100 p-3 ${
              inSuperset ? "border-secondary/50 border-l-[3px] border-l-secondary" : "border-base-300/60"
            }`}
          >
            {inSuperset && !prevSame && (
              <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                ⛓ Superset
              </div>
            )}
            <div className="flex items-center gap-3">
              <MuscleThumb primary={e.primaryMuscles} secondary={e.secondaryMuscles ?? []} />
              <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
              <div className="flex shrink-0 items-center gap-0.5 text-base-content/40">
                <button className="grid h-7 w-7 place-items-center rounded-full hover:bg-base-300/60 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button className="grid h-7 w-7 place-items-center rounded-full hover:bg-base-300/60 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === exercises.length - 1} aria-label="Move down">↓</button>
                <button className="grid h-7 w-7 place-items-center rounded-full hover:bg-base-300/60 hover:text-error" onClick={() => remove(i)} aria-label="Remove">✕</button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              <Field label="Sets">
                <NumberField inputMode="numeric" min={1} value={e.targetSets} onChange={(v) => update(i, { targetSets: v })} className="input input-bordered input-xs w-14 text-right tabular-nums" />
              </Field>
              <Field label="Target reps">
                <NumberField inputMode="numeric" min={1} value={e.repMax} onChange={(v) => update(i, { repMin: v, repMax: v })} className="input input-bordered input-xs w-14 text-right tabular-nums" />
              </Field>
              <Field label="Weight (kg)">
                <NumberField inputMode="decimal" min={0} value={e.weight} onChange={(v) => update(i, { weight: v })} className="input input-bordered input-xs w-16 text-right tabular-nums" />
              </Field>
              <Field label="Step (kg)">
                <NumberField inputMode="decimal" min={0} value={e.increment} onChange={(v) => update(i, { increment: v })} className="input input-bordered input-xs w-16 text-right tabular-nums" />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <button
                onClick={() => toggleSuperset(i)}
                disabled={!inSuperset && i + 1 >= exercises.length}
                className={`rounded-full border px-3 py-1 font-medium transition-colors disabled:opacity-30 ${
                  inSuperset
                    ? "border-secondary/50 bg-secondary/10 text-secondary"
                    : "border-base-300 text-base-content/70 hover:border-secondary/40"
                }`}
              >
                {inSuperset ? "Split superset" : "⛓ Superset with next"}
              </button>
              <button
                onClick={() => update(i, { dropset: !e.dropset })}
                className={`rounded-full border px-3 py-1 font-medium transition-colors ${
                  e.dropset
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-base-300 text-base-content/70 hover:border-primary/40"
                }`}
              >
                {e.dropset ? "✓ Dropset" : "Dropset"}
              </button>
            </div>
          </div>
          );
        })}

        <button
          onClick={() => setPicking(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-base-300 py-3 text-sm text-base-content/60 transition-colors hover:border-primary/50 hover:text-base-content"
        >
          <span className="text-base leading-none">＋</span>
          {exercises.length === 0 ? "Add exercises" : "Add another exercise"}
        </button>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-[4.25rem] z-40 border-t border-base-300 bg-base-100/95 p-3 backdrop-blur lg:bottom-0">
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-0">
          {id != null && (
            <button className="btn btn-ghost text-error" disabled={saving} onClick={del}>
              Delete
            </button>
          )}
          <button
            className="btn btn-primary flex-1"
            disabled={saving || !name.trim() || exercises.length === 0}
            onClick={save}
          >
            {id == null ? "Create routine" : "Save changes"}
          </button>
        </div>
      </div>

      {picking && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-base-100">
          <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
            <span className="font-semibold">Add exercises</span>
            <button className="btn btn-primary btn-sm" onClick={() => setPicking(false)}>
              Done
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ExercisePicker onSelect={toggleExercise} addedIds={exercises.map((e) => e.exerciseId)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-base-content/50">{label}</span>
      {children}
    </label>
  );
}
