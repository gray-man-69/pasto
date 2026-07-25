"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadExercises, MUSCLES } from "@/lib/exercises";
import { allWeights, saveRoutine } from "@/lib/db";
import {
  DEFAULT_PRIORITIES,
  generatePlan,
  MEV,
  MRV,
  type Experience,
  type GeneratedPlan,
  type PlanInput,
  type Priority,
  type RepFocus,
  type SplitStyle,
} from "@/lib/planGenerator";
import type { Exercise } from "@/lib/types";

const SPLITS: { key: SplitStyle; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "full-body", label: "Full body" },
  { key: "upper-lower", label: "Upper / Lower" },
  { key: "push-pull-legs", label: "Push / Pull / Legs" },
  { key: "arnold", label: "Arnold" },
];
const FOCUS: { key: RepFocus; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "hypertrophy", label: "Hypertrophy" },
  { key: "pump", label: "Pump" },
  { key: "mixed", label: "Mixed" },
];
const EXP: { key: Experience; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];
const EQUIP: { key: string; label: string; set: string[] }[] = [
  { key: "gym", label: "Full gym", set: [] },
  { key: "dumbbell", label: "Dumbbell only", set: ["dumbbell", "body only"] },
  { key: "machine", label: "Machines & cables", set: ["machine", "cable", "body only"] },
  { key: "home", label: "Minimal / bodyweight", set: ["body only", "dumbbell"] },
];
const PRIORITY_CYCLE: Priority[] = ["normal", "priority", "maintain", "skip"];
const PRIORITY_STYLE: Record<Priority, string> = {
  priority: "border-primary bg-primary/15 text-primary",
  normal: "border-base-300 bg-base-100 text-base-content/70",
  maintain: "border-amber-400/40 bg-amber-400/10 text-amber-500",
  skip: "border-base-300/50 bg-base-100/40 text-base-content/30 line-through",
};

export default function GeneratePage() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [phase, setPhase] = useState<"setup" | "preview">("setup");
  const [creating, setCreating] = useState(false);
  const [equipKey, setEquipKey] = useState("gym");
  const [input, setInput] = useState<PlanInput>({
    daysPerWeek: 4,
    sessionMinutes: 60,
    repFocus: "hypertrophy",
    experience: "intermediate",
    equipment: [],
    split: "auto",
    priorities: DEFAULT_PRIORITIES(),
    spineSafe: true,
  });

  useEffect(() => {
    loadExercises().then(setExercises);
  }, []);

  const plan: GeneratedPlan | null = useMemo(
    () => (exercises ? generatePlan(input, exercises) : null),
    [input, exercises],
  );

  function set<K extends keyof PlanInput>(k: K, v: PlanInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }
  function cyclePriority(m: string) {
    setInput((p) => {
      const cur = p.priorities[m] ?? "normal";
      const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(cur) + 1) % PRIORITY_CYCLE.length];
      return { ...p, priorities: { ...p.priorities, [m]: next } };
    });
  }

  async function createRoutines() {
    if (!plan) return;
    setCreating(true);
    const base = Date.now();
    // Purely additive: each is a brand-new Routine (no id) — existing routines
    // and all other data are never touched.
    for (let i = 0; i < plan.routines.length; i++) {
      await saveRoutine({ name: plan.routines[i].name, order: base + i, exercises: plan.routines[i].exercises });
    }
    router.push("/training");
  }

  if (!exercises || !plan) {
    return <div className="py-10 text-center text-base-content/40">Loading…</div>;
  }

  if (phase === "preview") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setPhase("setup")} className="btn btn-ghost btn-sm">
            ‹ Edit
          </button>
          <h1 className="text-lg font-bold">Your plan</h1>
          <span className="w-14" />
        </div>

        <VolumeSummary weekly={plan.weeklySets} priorities={input.priorities} />

        <div className="flex flex-col gap-3">
          {plan.routines.map((r, i) => (
            <div key={i} className="rounded-2xl border border-base-300/60 bg-base-100 p-4">
              <div className="mb-2 font-semibold">{r.name}</div>
              <ul className="flex flex-col gap-1.5">
                {r.exercises.map((e, j) => (
                  <li key={j} className="flex items-center justify-between text-sm">
                    <span className="min-w-0 truncate">{e.name}</span>
                    <span className="shrink-0 tabular-nums text-base-content/50">
                      {e.targetSets} × {e.repMin}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="px-1 text-xs text-base-content/40">
          These are added as new routines — your existing routines and data are untouched. Tweak any
          of them anytime in the routine editor.
        </p>

        <button onClick={createRoutines} disabled={creating} className="btn btn-primary btn-lg rounded-full">
          {creating ? "Creating…" : `Create ${plan.routines.length} routines`}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">
          ‹ Back
        </button>
        <h1 className="text-lg font-bold">Generate a plan</h1>
        <span className="w-14" />
      </div>

      <Section label="Days per week">
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6].map((d) => (
            <Chip key={d} on={input.daysPerWeek === d} onClick={() => set("daysPerWeek", d)}>
              {d}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Split">
        <div className="flex flex-wrap gap-2">
          {SPLITS.map((s) => (
            <Chip key={s.key} on={input.split === s.key} onClick={() => set("split", s.key)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Session length">
        <div className="flex gap-2">
          {[30, 45, 60, 75, 90].map((m) => (
            <Chip key={m} on={input.sessionMinutes === m} onClick={() => set("sessionMinutes", m)}>
              {m}m
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Rep focus">
        <div className="flex flex-wrap gap-2">
          {FOCUS.map((f) => (
            <Chip key={f.key} on={input.repFocus === f.key} onClick={() => set("repFocus", f.key)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Experience">
        <div className="flex gap-2">
          {EXP.map((e) => (
            <Chip key={e.key} on={input.experience === e.key} onClick={() => set("experience", e.key)}>
              {e.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Equipment">
        <div className="flex flex-wrap gap-2">
          {EQUIP.map((e) => (
            <Chip
              key={e.key}
              on={equipKey === e.key}
              onClick={() => {
                setEquipKey(e.key);
                set("equipment", e.set);
              }}
            >
              {e.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Muscle priority — tap to cycle">
        <div className="grid grid-cols-3 gap-2">
          {MUSCLES.map((m) => (
            <button
              key={m}
              onClick={() => cyclePriority(m)}
              className={`rounded-xl border px-2 py-2 text-xs font-medium capitalize transition-colors ${PRIORITY_STYLE[input.priorities[m] ?? "normal"]}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 text-[11px] text-base-content/40">
          <span className="text-primary">Priority = more sets, first</span>
          <span className="text-amber-500">Maintain = minimal</span>
          <span>Skip = none</span>
        </div>
      </Section>

      <label className="flex items-center justify-between gap-3 rounded-2xl border border-base-300 bg-base-100 px-4 py-3">
        <span className="text-sm">
          Spine-safe
          <span className="block text-xs text-base-content/40">No barbell squat / deadlift / RDL</span>
        </span>
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm"
          checked={input.spineSafe}
          onChange={(e) => set("spineSafe", e.target.checked)}
        />
      </label>

      <button onClick={() => setPhase("preview")} className="btn btn-primary btn-lg rounded-full">
        Preview plan →
      </button>
    </div>
  );
}

function VolumeSummary({ weekly, priorities }: { weekly: Record<string, number>; priorities: Record<string, Priority> }) {
  const rows = MUSCLES.filter((m) => (weekly[m] ?? 0) > 0 || priorities[m] === "priority");
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-base-300/60 bg-base-100 p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
        Weekly sets per muscle
      </div>
      {rows.map((m) => {
        const sets = weekly[m] ?? 0;
        const pct = Math.min(100, (sets / MRV) * 100);
        const belowMev = sets > 0 && sets < MEV;
        return (
          <div key={m} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 capitalize text-base-content/60">{m}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-base-300/60">
              <div className={`h-full rounded-full ${belowMev ? "bg-amber-400" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right tabular-nums text-base-content/50">{sets}</span>
          </div>
        );
      })}
      <div className="px-1 pt-1 text-[11px] text-base-content/35">
        Target 10–20 sets/muscle/week (MEV {MEV} · MRV {MRV}). Amber = below MEV.
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">{label}</span>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        on ? "border-primary bg-primary/15 text-primary" : "border-base-300 bg-base-100 text-base-content/70 hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
