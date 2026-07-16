"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ExercisePicker from "@/components/ExercisePicker";
import { MuscleThumb } from "@/components/MuscleMap";
import NumberField from "@/components/NumberField";
import {
  activeSession,
  completedSessions,
  deleteSession,
  getMesocycle,
  getRoutine,
  getSession,
  localDate,
  saveSession,
} from "@/lib/db";
import { defaultRoutineExercise } from "@/lib/exercises";
import { DELOAD_LOAD_FACTOR, isBlockActive, mesoWeek, rampedSets } from "@/lib/mesocycle";
import {
  lastForExercise,
  nextTarget,
  overloadOptions,
  summarizeLast,
  volumeOf,
  volumeStatsForExercise,
} from "@/lib/progression";
import type {
  Exercise,
  Mesocycle,
  PerformedSet,
  RoutineExercise,
  SessionExercise,
  SetType,
  WorkoutSession,
} from "@/lib/types";

function dayLabel(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Build a session exercise (sets pre-filled from history + double-progression
// target) from a library exercise — used both when starting from a routine and
// when adding a lift mid-workout.
function buildSessionExercise(ex: Exercise, completed: WorkoutSession[]): SessionExercise {
  const re = defaultRoutineExercise(ex);
  const last = lastForExercise(completed, ex.id);
  const t = nextTarget(re, last);
  const sets: PerformedSet[] = Array.from({ length: Math.max(1, re.targetSets) }, () => ({
    weight: t.weight,
    reps: t.reps,
    type: "normal" as SetType,
    done: false,
  }));
  return {
    exerciseId: ex.id,
    name: ex.name,
    primaryMuscles: ex.primaryMuscles,
    secondaryMuscles: ex.secondaryMuscles,
    note: t.note,
    repMin: re.repMin,
    repMax: re.repMax,
    targetSets: re.targetSets,
    increment: re.increment,
    lastSummary: summarizeLast(last),
    sets,
  };
}

// normal → warmup → dropset → normal
const NEXT_TYPE: Record<SetType, SetType> = { normal: "warmup", warmup: "dropset", dropset: "normal" };

export default function WorkoutPage() {
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [ready, setReady] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  // null = closed; {mode:"add"} appends; {mode:"replace", ei} swaps one out.
  const [picker, setPicker] = useState<{ mode: "add" | "replace"; ei?: number } | null>(null);

  // Resolve the session: resume by ?id=, resume the active one, or build a fresh
  // one from ?routine= (pre-filled from history + double-progression targets).
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const idRaw = params.get("id");
      const routineRaw = params.get("routine");
      const completed = await completedSessions();
      setHistory(completed);
      const mesoRec = await getMesocycle();
      setMeso(mesoRec ?? null);

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
        const today = localDate();
        const activeMeso = mesoRec && isBlockActive(mesoRec, today) ? mesoRec : null;
        const phase = activeMeso ? mesoWeek(activeMeso, today).phase : null;
        const exercises: SessionExercise[] = routine.exercises.map((re) => {
          const last = lastForExercise(completed, re.exerciseId);
          const t = nextTarget(re, last);
          // Mesocycle: ramp the set count each week; deload halves volume + eases load.
          const setCount = activeMeso ? rampedSets(re.targetSets, activeMeso, today) : Math.max(1, re.targetSets);
          const deloading = phase === "deload";
          const weight = deloading ? Math.round(t.weight * DELOAD_LOAD_FACTOR * 2) / 2 : t.weight;
          const note = deloading ? "Deload — lighter, keep ~3 reps in reserve" : t.note;
          const sets: PerformedSet[] = Array.from({ length: setCount }, () => ({
            weight,
            reps: t.reps,
            type: "normal" as const,
            done: false,
          }));
          // A dropset-prescribed exercise marks its final set as a dropset (not on deload weeks).
          if (re.dropset && sets.length && !deloading) sets[sets.length - 1].type = "dropset";
          return {
            exerciseId: re.exerciseId,
            name: re.name,
            primaryMuscles: re.primaryMuscles,
            secondaryMuscles: re.secondaryMuscles,
            note,
            superset: re.superset,
            repMin: re.repMin,
            repMax: re.repMax,
            targetSets: re.targetSets,
            increment: re.increment,
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
  function patchExercises(fn: (list: SessionExercise[]) => SessionExercise[], save = true) {
    if (!session) return;
    const next = { ...session, exercises: fn(session.exercises) };
    if (save) persist(next);
    else setSession(next);
  }

  function editSet(ei: number, si: number, patch: Partial<PerformedSet>, save = false) {
    patchExercises(
      (list) =>
        list.map((e, i) =>
          i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) },
        ),
      save,
    );
  }
  function cycleSetType(ei: number, si: number) {
    patchExercises((list) =>
      list.map((e, i) =>
        i !== ei
          ? e
          : {
              ...e,
              sets: e.sets.map((s, j) =>
                j === si ? { ...s, type: NEXT_TYPE[s.type ?? "normal"] } : s,
              ),
            },
      ),
    );
  }
  function addSet(ei: number) {
    patchExercises((list) =>
      list.map((e, i) => {
        if (i !== ei) return e;
        const last = e.sets.at(-1);
        const set: PerformedSet = { weight: last?.weight ?? 0, reps: last?.reps ?? 0, type: "normal", done: false };
        return { ...e, sets: [...e.sets, set] };
      }),
    );
  }
  function removeSet(ei: number, si: number) {
    patchExercises((list) =>
      list.map((e, i) => (i === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e)),
    );
  }
  // Append a dropset: ~25% lighter than the last set, tagged as a dropset.
  function addDropset(ei: number) {
    patchExercises((list) =>
      list.map((e, i) => {
        if (i !== ei) return e;
        const last = e.sets.at(-1);
        const w = last ? Math.round(last.weight * 0.75 * 2) / 2 : 0;
        const set: PerformedSet = { weight: w, reps: last?.reps ?? 0, type: "dropset", done: false };
        return { ...e, sets: [...e.sets, set] };
      }),
    );
  }

  function moveExercise(ei: number, dir: -1 | 1) {
    patchExercises((list) => {
      const j = ei + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[ei], next[j]] = [next[j], next[ei]];
      return next;
    });
  }
  function removeExercise(ei: number) {
    const ex = session?.exercises[ei];
    if (ex && !confirm(`Remove ${ex.name} from this workout?`)) return;
    setMenuFor(null);
    patchExercises((list) => list.filter((_, i) => i !== ei));
  }
  function addExercise(ex: Exercise) {
    patchExercises((list) => {
      if (picker?.mode === "replace" && picker.ei != null) {
        const built = buildSessionExercise(ex, history);
        return list.map((e, i) => (i === picker.ei ? { ...built, superset: e.superset } : e));
      }
      return [...list, buildSessionExercise(ex, history)];
    });
    setPicker(null);
    setMenuFor(null);
  }
  function setUserNote(ei: number, userNote: string) {
    patchExercises(
      (list) => list.map((e, i) => (i === ei ? { ...e, userNote: userNote || undefined } : e)),
      true,
    );
  }
  function toggleSuperset(ei: number) {
    setMenuFor(null);
    patchExercises((list) => {
      const ex = list[ei];
      const prevSame = ei > 0 && !!ex.superset && list[ei - 1].superset === ex.superset;
      const nextSame = !!ex.superset && list[ei + 1]?.superset === ex.superset;
      if (ex.superset && (prevSame || nextSame)) {
        const g = ex.superset;
        return list.map((e) => (e.superset === g ? { ...e, superset: undefined } : e));
      }
      if (ei + 1 >= list.length) return list;
      const g = crypto.randomUUID();
      return list.map((e, i) => (i === ei || i === ei + 1 ? { ...e, superset: g } : e));
    });
  }

  // A backdated workout should be timestamped on its own day (noon local) so it
  // sorts into history / progression chronologically — not as if it happened now.
  function endedAtForDate(date: string): number {
    return date === localDate() ? Date.now() : new Date(date + "T12:00:00").getTime();
  }
  function changeDate(date: string) {
    if (!session || !date) return;
    setEditingDate(false);
    const next = { ...session, date };
    // Keep a finished workout's timestamp in step with its (edited) day.
    if (session.endedAt) next.endedAt = endedAtForDate(date);
    persist(next);
  }
  async function finish() {
    if (!session) return;
    await saveSession({ ...session, endedAt: endedAtForDate(session.date) });
    router.push("/training");
  }
  async function discard() {
    if (!confirm("Move this workout to Trash? You can restore it from the Training tab.")) return;
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
  const mesoInfo = meso && isBlockActive(meso, session.date) ? mesoWeek(meso, session.date) : null;
  const isFinished = session.endedAt != null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 pb-28">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold">{session.routineName ?? "Workout"}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-base-content/50">
            <button
              onClick={() => setEditingDate((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${
                session.date === localDate()
                  ? "bg-base-200/60 hover:bg-base-300/60"
                  : "bg-amber-400/15 text-amber-500 hover:bg-amber-400/25"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
                <path d="M3 9h18M8 3v3M16 3v3" strokeLinecap="round" />
              </svg>
              {dayLabel(session.date)}
              {session.date === localDate() ? " · Today" : ""}
            </button>
            <span>
              {doneCount}/{totalSets} sets
            </span>
            {mesoInfo && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                  mesoInfo.phase === "deload"
                    ? "bg-amber-400/15 text-amber-500"
                    : "bg-secondary/15 text-secondary"
                }`}
              >
                {mesoInfo.label}
              </span>
            )}
          </div>
          {editingDate && (
            <input
              type="date"
              value={session.date}
              max={localDate()}
              onChange={(e) => changeDate(e.target.value)}
              className="input input-bordered input-xs mt-2 w-44"
            />
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/training")}>
          Close
        </button>
      </div>

      {session.exercises.map((ex, ei) => {
        const grp = ex.superset;
        const prevSame = ei > 0 && !!grp && session.exercises[ei - 1].superset === grp;
        const nextSame = !!grp && session.exercises[ei + 1]?.superset === grp;
        const inSuperset = !!grp && (prevSame || nextSame);
        const stats = volumeStatsForExercise(history, ex.exerciseId);
        const liveVol = Math.round(volumeOf(ex.sets));
        const prescription: RoutineExercise = {
          exerciseId: ex.exerciseId,
          name: ex.name,
          primaryMuscles: ex.primaryMuscles ?? [],
          secondaryMuscles: ex.secondaryMuscles,
          targetSets: ex.targetSets ?? ex.sets.length,
          repMin: ex.repMin ?? 8,
          repMax: ex.repMax ?? 12,
          weight: ex.sets.at(-1)?.weight ?? 0,
          weightUnit: "kg",
          increment: ex.increment ?? 2.5,
        };
        const options = overloadOptions(prescription, lastForExercise(history, ex.exerciseId));

        return (
          <div
            key={ex.exerciseId + ei}
            className={`rounded-2xl border bg-base-100 p-3 ${
              inSuperset ? "border-secondary/50 border-l-[3px] border-l-secondary" : "border-base-300/60"
            }`}
          >
            {inSuperset && !prevSame && (
              <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                ⛓ Superset
              </div>
            )}
            <div className="flex items-start gap-3">
              <MuscleThumb primary={ex.primaryMuscles ?? []} secondary={ex.secondaryMuscles ?? []} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{ex.name}</div>
                {ex.note && <div className="mt-0.5 text-xs font-medium text-primary">{ex.note}</div>}
                {ex.userNote && (
                  <div className="mt-0.5 text-xs italic text-base-content/70">“{ex.userNote}”</div>
                )}
                {ex.lastSummary && (
                  <div className="text-[11px] text-base-content/40">Last: {ex.lastSummary}</div>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums">
                  <span className={liveVol >= stats.last && stats.last > 0 ? "text-primary" : "text-base-content/50"}>
                    Vol {liveVol.toLocaleString()}
                    {liveVol >= stats.last && stats.last > 0 ? " ▲" : ""}
                  </span>
                  {stats.last > 0 && (
                    <span className="text-base-content/35">last {Math.round(stats.last).toLocaleString()}</span>
                  )}
                  {stats.best > 0 && (
                    <span className="text-base-content/35">best {Math.round(stats.best).toLocaleString()} kg</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-0.5 text-base-content/40">
                <div className="flex items-center gap-0.5">
                  <button className="grid h-7 w-6 place-items-center rounded-full hover:bg-base-300/60 disabled:opacity-25" onClick={() => moveExercise(ei, -1)} disabled={ei === 0} aria-label="Move up">↑</button>
                  <button className="grid h-7 w-6 place-items-center rounded-full hover:bg-base-300/60 disabled:opacity-25" onClick={() => moveExercise(ei, 1)} disabled={ei === session.exercises.length - 1} aria-label="Move down">↓</button>
                </div>
                <button
                  className={`grid h-7 w-6 place-items-center rounded-full hover:bg-base-300/60 ${menuFor === ei ? "bg-base-300/60 text-base-content" : ""}`}
                  onClick={() => setMenuFor(menuFor === ei ? null : ei)}
                  aria-label="More"
                >
                  ⋯
                </button>
              </div>
            </div>

            <details className="group mt-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-base-content/50 hover:text-base-content">
                <svg viewBox="0 0 24 24" className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Ways to progress
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {options.map((o) => (
                  <li key={o.lever} className="rounded-xl bg-base-200/40 px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{o.title}</span>
                      {o.recommended && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                          Recommended
                        </span>
                      )}
                      {o.lever === "set" && (
                        <button onClick={() => addSet(ei)} className="ml-auto shrink-0 rounded-full border border-base-300 px-2.5 py-0.5 text-[11px] font-medium text-base-content/70 hover:border-primary/40 hover:text-base-content">
                          Add set
                        </button>
                      )}
                      {o.lever === "dropset" && (
                        <button onClick={() => addDropset(ei)} className="ml-auto shrink-0 rounded-full border border-secondary/40 px-2.5 py-0.5 text-[11px] font-medium text-secondary hover:bg-secondary/10">
                          Add dropset
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-base-content/50">{o.detail}</p>
                  </li>
                ))}
              </ul>
            </details>

            {menuFor === ei && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-base-300/60 pt-2 text-xs">
                <MenuBtn onClick={() => { setNoteFor(noteFor === ei ? null : ei); setMenuFor(null); }}>
                  {ex.userNote ? "Edit note" : "＋ Note"}
                </MenuBtn>
                <MenuBtn onClick={() => toggleSuperset(ei)} disabled={!inSuperset && ei + 1 >= session.exercises.length}>
                  {inSuperset ? "Split superset" : "⛓ Superset with next"}
                </MenuBtn>
                <MenuBtn onClick={() => { setPicker({ mode: "replace", ei }); setMenuFor(null); }}>
                  Replace
                </MenuBtn>
                <MenuBtn onClick={() => removeExercise(ei)} danger>
                  Remove
                </MenuBtn>
              </div>
            )}

            {noteFor === ei && (
              <input
                autoFocus
                defaultValue={ex.userNote ?? ""}
                onBlur={(e) => { setUserNote(ei, e.target.value.trim()); setNoteFor(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder="e.g. felt heavy, elbow tweak, next time +2.5kg…"
                className="input input-bordered input-sm mt-2 w-full"
              />
            )}

            <div className="mt-2 flex flex-col gap-1.5">
              {ex.sets.map((s, si) => {
                const type = s.type ?? "normal";
                return (
                  <div
                    key={si}
                    className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${
                      s.done ? "bg-primary/10" : "bg-base-200/40"
                    }`}
                  >
                    <button
                      onClick={() => cycleSetType(ei, si)}
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                        type === "warmup"
                          ? "bg-amber-400/20 text-amber-500"
                          : type === "dropset"
                            ? "bg-secondary/20 text-secondary"
                            : "text-base-content/40"
                      }`}
                      aria-label={`Set type: ${type} (tap to change)`}
                      title={`${type} — tap to change`}
                    >
                      {type === "warmup" ? "W" : type === "dropset" ? "D" : si + 1}
                    </button>
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
                );
              })}
              <button onClick={() => addSet(ei)} className="self-start text-xs text-primary hover:underline">
                ＋ Add set
              </button>
            </div>
          </div>
        );
      })}

      <button
        onClick={() => setPicker({ mode: "add" })}
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-base-300 py-3 text-sm text-base-content/60 transition-colors hover:border-primary/50 hover:text-base-content"
      >
        <span className="text-base leading-none">＋</span> Add exercise
      </button>

      <button onClick={discard} className="self-center py-1 text-xs text-base-content/40 hover:text-error">
        {isFinished ? "Delete workout" : "Discard workout"}
      </button>

      <div className="fixed inset-x-0 bottom-[4.25rem] z-40 border-t border-base-300 bg-base-100/95 p-3 backdrop-blur lg:bottom-0">
        <div className="mx-auto w-full max-w-xl">
          {isFinished ? (
            <button className="btn btn-primary w-full" onClick={() => router.push("/training")}>
              Done — changes saved
            </button>
          ) : (
            <button className="btn btn-primary w-full" onClick={finish}>
              Finish workout
            </button>
          )}
        </div>
      </div>

      {picker && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-base-100">
          <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
            <span className="font-semibold">{picker.mode === "replace" ? "Replace exercise" : "Add exercise"}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPicker(null)}>
              Cancel
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ExercisePicker
              onSelect={addExercise}
              addedIds={picker.mode === "add" ? session.exercises.map((e) => e.exerciseId) : []}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 font-medium transition-colors disabled:opacity-30 ${
        danger
          ? "border-error/30 text-error hover:bg-error/10"
          : "border-base-300 text-base-content/70 hover:border-primary/40 hover:text-base-content"
      }`}
    >
      {children}
    </button>
  );
}
