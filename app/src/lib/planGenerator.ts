// Deterministic, science-based training-plan generator.
//
// Turns a few personal inputs into a full weekly split (a set of Routine drafts),
// grounded in the hypertrophy literature (Schoenfeld et al.):
//  • Volume is the driver — weekly sets/muscle scaled by experience & priority,
//    clamped between MEV (~10) and MRV (~22).
//  • Frequency — each worked muscle is hit 2–3×/week; its weekly sets are split
//    across those days.
//  • Order — priority (lagging) muscles come first in the session.
//  • Rep target from the chosen focus; effort/RIR is handled by the mesocycle.
// Pure functions only — no DB writes here; the page saves the drafts.

import { MUSCLES } from "./exercises";
import { isSpineLoading } from "./spineSafe";
import type { Exercise, RoutineExercise } from "./types";

export type Muscle = (typeof MUSCLES)[number];
export type Priority = "priority" | "normal" | "maintain" | "skip";
export type RepFocus = "strength" | "hypertrophy" | "pump" | "mixed";
export type Experience = "beginner" | "intermediate" | "advanced";
export type SplitStyle = "auto" | "full-body" | "upper-lower" | "push-pull-legs" | "arnold";

export interface PlanInput {
  daysPerWeek: number; // 2..6
  sessionMinutes: number; // time budget → per-session set cap
  repFocus: RepFocus;
  experience: Experience;
  equipment: string[]; // allowed equipment; empty = allow all
  split: SplitStyle;
  priorities: Record<string, Priority>;
  spineSafe: boolean;
}

export interface RoutineDraft {
  name: string;
  exercises: RoutineExercise[];
}
export interface GeneratedPlan {
  routines: RoutineDraft[];
  weeklySets: Record<string, number>; // muscle → planned weekly sets
}

export const MEV = 10;
export const MRV = 22;
const MV = 6; // maintenance volume

// Muscles that also get plenty of indirect work from compounds → dial the base down.
const SMALL = new Set(["biceps", "triceps", "forearms", "calves", "abdominals", "traps"]);
const BASE: Record<Experience, number> = { beginner: 10, intermediate: 13, advanced: 16 };
const PRIORITY_MULT: Record<Priority, number> = { priority: 1.4, normal: 1, maintain: 0, skip: 0 };

// Rep target by focus × mechanic (app uses a single fixed target: repMin === repMax).
const REPS: Record<RepFocus, { compound: number; isolation: number }> = {
  strength: { compound: 5, isolation: 8 },
  hypertrophy: { compound: 8, isolation: 12 },
  pump: { compound: 12, isolation: 15 },
  mixed: { compound: 6, isolation: 12 },
};

// --- Split templates: each "day type" is an ordered list of muscles. ---------
const PUSH: Muscle[] = ["chest", "shoulders", "triceps"];
const PULL: Muscle[] = ["lats", "middle back", "traps", "biceps", "forearms"];
const LEGS: Muscle[] = ["quadriceps", "hamstrings", "glutes", "calves"];
const UPPER: Muscle[] = ["chest", "shoulders", "lats", "middle back", "traps", "biceps", "triceps", "forearms"];
const LOWER: Muscle[] = ["quadriceps", "hamstrings", "glutes", "calves", "abdominals"];
const CHEST_BACK: Muscle[] = ["chest", "lats", "middle back", "traps"];
const SHLDR_ARMS: Muscle[] = ["shoulders", "biceps", "triceps", "forearms"];
const ALL: Muscle[] = MUSCLES.filter((m) => m !== "lower back") as Muscle[];

type Day = { type: string; muscles: Muscle[] };
const withAbs = (m: Muscle[]): Muscle[] => (m.includes("abdominals") ? m : [...m, "abdominals"]);

/** Ordered day sequence for a split style + day count. Cycles the template. */
function daySequence(split: SplitStyle, days: number): Day[] {
  const style = split === "auto" ? autoSplit(days) : split;
  let cycle: Day[];
  if (style === "full-body") cycle = [{ type: "Full body", muscles: ALL }];
  else if (style === "upper-lower")
    cycle = [{ type: "Upper", muscles: withAbs(UPPER) }, { type: "Lower", muscles: LOWER }];
  else if (style === "arnold")
    cycle = [
      { type: "Chest & Back", muscles: withAbs(CHEST_BACK) },
      { type: "Shoulders & Arms", muscles: SHLDR_ARMS },
      { type: "Legs", muscles: withAbs(LEGS) },
    ];
  else
    cycle = [
      { type: "Push", muscles: PUSH },
      { type: "Pull", muscles: withAbs(PULL) },
      { type: "Legs", muscles: withAbs(LEGS) },
    ];
  return Array.from({ length: days }, (_, i) => cycle[i % cycle.length]);
}

function autoSplit(days: number): Exclude<SplitStyle, "auto"> {
  if (days <= 2) return "full-body";
  if (days === 3) return "push-pull-legs";
  if (days === 4) return "upper-lower";
  if (days === 5) return "upper-lower";
  return "push-pull-legs"; // 6
}

// --- Core generation --------------------------------------------------------

export function weeklyTargets(input: PlanInput): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of MUSCLES) {
    const pr = input.priorities[m] ?? "normal";
    if (pr === "skip") {
      out[m] = 0;
      continue;
    }
    if (pr === "maintain") {
      out[m] = MV;
      continue;
    }
    let sets = BASE[input.experience] * PRIORITY_MULT[pr];
    if (SMALL.has(m)) sets *= 0.8;
    out[m] = Math.max(MEV, Math.min(MRV, Math.round(sets)));
  }
  return out;
}

const repTarget = (focus: RepFocus, compound: boolean) =>
  compound ? REPS[focus].compound : REPS[focus].isolation;

/** Build the plan. `exercises` is the loaded library (app/public/exercises.json). */
export function generatePlan(input: PlanInput, exercises: Exercise[]): GeneratedPlan {
  const weekly = weeklyTargets(input);
  const days = daySequence(input.split, input.daysPerWeek);

  // Pool filtered by spine-safe + equipment, indexed by muscle (primary match).
  const allowEquip = input.equipment.length ? new Set(input.equipment) : null;
  const pool = exercises.filter((e) => {
    if (input.spineSafe && isSpineLoading(e)) return false;
    if (allowEquip && e.equipment && !allowEquip.has(e.equipment)) return false;
    return true;
  });
  const byMuscle = (m: Muscle) =>
    pool
      .filter((e) => e.primaryMuscles?.includes(m))
      .sort((a, b) => (a.mechanic === "compound" ? -1 : 1) - (b.mechanic === "compound" ? -1 : 1));

  const budget = Math.max(8, Math.round(input.sessionMinutes / 3.5));
  const priorityRank = (m: Muscle) => (input.priorities[m] === "priority" ? 0 : input.priorities[m] === "maintain" ? 2 : 1);
  // Per-session floor: priority muscles keep more before others are trimmed.
  const floorFor = (m: Muscle) => (input.priorities[m] === "priority" ? 4 : input.priorities[m] === "maintain" ? 1 : 2);
  const used: Record<string, Set<string>> = {}; // muscle → exercise ids already used this week (variety)

  const routines: RoutineDraft[] = [];
  const typeCount: Record<string, number> = {};

  for (const day of days) {
    // How many days this week train each muscle (its frequency).
    const worked = day.muscles.filter((m) => weekly[m] > 0 && byMuscle(m).length > 0);
    const perDay: { muscle: Muscle; sets: number }[] = worked.map((m) => {
      const freq = days.filter((d) => d.muscles.includes(m)).length || 1;
      return { muscle: m, sets: Math.max(2, Math.round(weekly[m] / freq)) };
    });

    // Trim to the session's time budget, shaving lowest-priority muscles first
    // and never cutting a muscle below its floor (priority muscles floor higher).
    let total = perDay.reduce((n, x) => n + x.sets, 0);
    while (total > budget) {
      const cut = [...perDay]
        .filter((x) => x.sets > floorFor(x.muscle))
        .sort((a, b) => priorityRank(b.muscle) - priorityRank(a.muscle))[0];
      if (!cut) break;
      cut.sets -= 1;
      total -= 1;
    }

    // Priority muscles first (they get the freshest effort).
    perDay.sort((a, b) => priorityRank(a.muscle) - priorityRank(b.muscle));

    const exs: RoutineExercise[] = [];
    const dayUsed = new Set<string>(); // no exercise twice in one routine
    for (const { muscle, sets } of perDay) {
      const candidates = byMuscle(muscle).filter((e) => !dayUsed.has(e.id));
      if (!candidates.length) continue;
      const nEx = Math.min(candidates.length, sets <= 3 ? 1 : sets <= 6 ? 2 : 3);
      used[muscle] ??= new Set();
      // Prefer exercises not yet used this week, keeping compound-first order,
      // and dedupe by id so a muscle with few options never repeats a lift.
      const fresh = candidates.filter((e) => !used[muscle].has(e.id));
      const chosen = [...new Map([...fresh, ...candidates].map((e) => [e.id, e])).values()].slice(0, nEx);
      // Distribute sets as evenly as possible across the chosen lifts.
      chosen.forEach((ex, i) => {
        used[muscle].add(ex.id);
        dayUsed.add(ex.id);
        const s = Math.floor(sets / nEx) + (i < sets % nEx ? 1 : 0);
        if (s < 1) return;
        const compound = ex.mechanic === "compound";
        const rt = repTarget(input.repFocus, compound);
        exs.push({
          exerciseId: ex.id,
          name: ex.name,
          primaryMuscles: ex.primaryMuscles,
          secondaryMuscles: ex.secondaryMuscles,
          targetSets: s,
          repMin: rt,
          repMax: rt,
          weight: ex.equipment === "body only" ? 0 : ex.equipment === "barbell" ? 20 : 10,
          weightUnit: "kg",
          increment: compound && (muscle === "quadriceps" || muscle === "hamstrings" || muscle === "glutes") ? 5 : 2.5,
        });
      });
    }
    if (!exs.length) continue;

    typeCount[day.type] = (typeCount[day.type] ?? 0) + 1;
    const suffix = days.filter((d) => d.type === day.type).length > 1 ? ` ${String.fromCharCode(64 + typeCount[day.type])}` : "";
    routines.push({ name: `${day.type}${suffix}`, exercises: exs });
  }

  // Weekly sets actually programmed (for the preview summary vs MEV/MRV).
  const programmed: Record<string, number> = {};
  for (const r of routines)
    for (const e of r.exercises)
      for (const m of e.primaryMuscles) programmed[m] = (programmed[m] ?? 0) + e.targetSets;

  return { routines, weeklySets: programmed };
}

export const DEFAULT_PRIORITIES = (): Record<string, Priority> =>
  Object.fromEntries(MUSCLES.map((m) => [m, m === "lower back" ? "skip" : "normal"]));
