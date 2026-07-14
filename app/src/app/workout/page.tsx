"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MuscleThumb } from "@/components/MuscleMap";
import NumberField from "@/components/NumberField";
import {
  activeSession,
  completedSessions,
  deleteSession,
  getRoutine,
  getSession,
  localDate,
  saveSession,
} from "@/lib/db";
import { lastForExercise, nextTarget, summarizeLast } from "@/lib/progression";
import type { PerformedSet, SessionExercise, WorkoutSession } from "@/lib/types";

export default function WorkoutPage() {
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [ready, setReady] = useState(false);

  // Resolve the session: resume by ?id=, resume the active one, or build a fresh
  // one from ?routine= (pre-filled from history + double-progression targets).
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const idRaw = params.get("id");
      const routineRaw = params.get("routine");

      if (idRaw) {
        setSession((await getSession(Number(idRaw))) ?? null);
        setReady(true);
        return;
      }
      if (routineRaw) {
        const active = await activeSession();
        if (active) {
          setSession(active);
          router.replace(`/workout?id=${active.id}`);
          setReady(true);
          return;
        }
        const routine = await getRoutine(Number(routineRaw));
        if (!routine) {
          setReady(true);
          return;
        }
        const completed = await completedSessions();
        const exercises: SessionExercise[] = routine.exercises.map((re) => {
          const last = lastForExercise(completed, re.exerciseId);
          const t = nextTarget(re, last);
          const sets: PerformedSet[] = Array.from({ length: Math.max(1, re.targetSets) }, () => ({
            weight: t.weight,
            reps: t.reps,
            type: "normal",
            done: false,
          }));
          return {
            exerciseId: re.exerciseId,
            name: re.name,
            primaryMuscles: re.primaryMuscles,
            secondaryMuscles: re.secondaryMuscles,
            note: t.note,
            lastSummary: summarizeLast(last),
            sets,
          };
        });
        const built: WorkoutSession = {
          date: localDate(),
          routineId: routine.id,
          routineName: routine.name,
          startedAt: Date.now(),
          exercises,
        };
        const newId = await saveSession(built);
        built.id = newId;
        setSession(built);
        router.replace(`/workout?id=${newId}`);
        setReady(true);
        return;
      }
      setReady(true);
    })();
  }, [router]);

  async function persist(next: WorkoutSession) {
    setSession(next);
    await saveSession(next);
  }
  function editSet(ei: number, si: number, patch: Partial<PerformedSet>, save = false) {
    if (!session) return;
    const exercises = session.exercises.map((e, i) =>
      i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) },
    );
    const next = { ...session, exercises };
    if (save) persist(next);
    else setSession(next);
  }
  function addSet(ei: number) {
    if (!session) return;
    const last = session.exercises[ei].sets.at(-1);
    const set: PerformedSet = { weight: last?.weight ?? 0, reps: last?.reps ?? 0, type: "normal", done: false };
    const exercises = session.exercises.map((e, i) => (i === ei ? { ...e, sets: [...e.sets, set] } : e));
    persist({ ...session, exercises });
  }
  function removeSet(ei: number, si: number) {
    if (!session) return;
    const exercises = session.exercises.map((e, i) =>
      i === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e,
    );
    persist({ ...session, exercises });
  }
  async function finish() {
    if (!session) return;
    await saveSession({ ...session, endedAt: Date.now() });
    router.push("/training");
  }
  async function discard() {
    if (session?.id != null) await deleteSession(session.id);
    router.push("/training");
  }

  if (!ready) return <div className="py-10 text-center text-base-content/40">Loading…</div>;
  if (!session)
    return (
      <div className="mx-auto max-w-xl py-10 text-center text-sm text-base-content/50">
        No workout found.{" "}
        <button className="text-primary hover:underline" onClick={() => router.push("/training")}>
          Back to Training
        </button>
      </div>
    );

  const doneCount = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{session.routineName ?? "Workout"}</h1>
          <div className="text-xs text-base-content/50">
            {doneCount}/{totalSets} sets done
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/training")}>
          Close
        </button>
      </div>

      {session.exercises.map((ex, ei) => (
        <div key={ex.exerciseId + ei} className="rounded-2xl border border-base-300/60 bg-base-100 p-3">
          <div className="flex items-center gap-3">
            <MuscleThumb primary={ex.primaryMuscles ?? []} secondary={ex.secondaryMuscles ?? []} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{ex.name}</div>
              {ex.note && <div className="mt-0.5 text-xs font-medium text-primary">{ex.note}</div>}
              {ex.lastSummary && (
                <div className="text-[11px] text-base-content/40">Last: {ex.lastSummary}</div>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {ex.sets.map((s, si) => (
              <div
                key={si}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${
                  s.done ? "bg-primary/10" : "bg-base-200/40"
                }`}
              >
                <span className="w-5 text-center text-xs text-base-content/40">{si + 1}</span>
                <NumberField
                  inputMode="decimal"
                  min={0}
                  value={s.weight}
                  onChange={(v) => editSet(ei, si, { weight: v })}
                  className="input input-bordered input-xs w-16 text-right tabular-nums"
                />
                <span className="text-xs text-base-content/40">kg ×</span>
                <NumberField
                  inputMode="numeric"
                  min={0}
                  value={s.reps}
                  onChange={(v) => editSet(ei, si, { reps: v })}
                  className="input input-bordered input-xs w-14 text-right tabular-nums"
                />
                <button
                  onClick={() => editSet(ei, si, { done: !s.done }, true)}
                  className={`ml-auto grid h-7 w-7 place-items-center rounded-full ${
                    s.done ? "bg-primary text-primary-content" : "border border-base-300 text-base-content/40"
                  }`}
                  aria-label="Mark set done"
                >
                  ✓
                </button>
                <button
                  onClick={() => removeSet(ei, si)}
                  className="grid h-7 w-5 place-items-center rounded-full text-base-content/30 hover:text-error"
                  aria-label="Remove set"
                >
                  ✕
                </button>
              </div>
            ))}
            <button onClick={() => addSet(ei)} className="self-start text-xs text-primary hover:underline">
              ＋ Add set
            </button>
          </div>
        </div>
      ))}

      <button onClick={discard} className="self-center py-1 text-xs text-base-content/40 hover:text-error">
        Discard workout
      </button>

      <div className="fixed inset-x-0 bottom-[4.25rem] z-40 border-t border-base-300 bg-base-100/95 p-3 backdrop-blur lg:bottom-0">
        <div className="mx-auto w-full max-w-xl">
          <button className="btn btn-primary w-full" onClick={finish}>
            Finish workout
          </button>
        </div>
      </div>
    </div>
  );
}
