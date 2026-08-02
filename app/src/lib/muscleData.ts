// Authoritative muscle roles per exercise, curated from kinesiology (the
// agonist / synergist / stabilizer model). This overrides the coarser,
// crowd-sourced tags in exercises.json for the exercises listed here — so the
// volume tally and the muscle figure read from one accurate source without
// touching any stored routine/session data. Exercises not listed fall back to
// their stored tags.
//
// Counting: `primary` muscles count as full sets, `synergist` muscles as half.
// Pure stabilizers are deliberately omitted (e.g. the hamstring in a
// knee-dominant leg press, the calf in a squat) so they aren't over-credited.
export type MuscleRoles = { primary: string[]; synergist: string[] };

const ROLES: Record<string, MuscleRoles> = {
  // --- Back / pull ---
  "wide-grip-machine-row": { primary: ["lats", "middle back"], synergist: ["rear delts", "biceps"] },
  "machine-row": { primary: ["middle back", "lats"], synergist: ["rear delts", "biceps"] },
  "lat-pulldown": { primary: ["lats"], synergist: ["biceps", "middle back"] },
  "close-grip-lat-pulldown": { primary: ["lats"], synergist: ["biceps", "middle back"] },
  "straight-arm-pulldown": { primary: ["lats"], synergist: [] },
  "reverse-pec-deck": { primary: ["rear delts"], synergist: ["middle back"] },
  "reverse-cable-crossover": { primary: ["rear delts"], synergist: ["middle back"] },

  // --- Shoulders ---
  "cable-lateral-raise": { primary: ["side delts"], synergist: [] },

  // --- Chest / press (pressing feeds front delts + triceps) ---
  "incline-barbell-bench-press": { primary: ["chest"], synergist: ["front delts", "triceps"] },
  "machine-chest-press": { primary: ["chest"], synergist: ["front delts", "triceps"] },
  "cable-crossover": { primary: ["chest"], synergist: [] },
  "pec-deck": { primary: ["chest"], synergist: [] },
  "close-grip-bench-press": { primary: ["triceps"], synergist: ["chest", "front delts"] },

  // --- Triceps ---
  "tricep-pushdown": { primary: ["triceps"], synergist: [] },
  "overhead-tricep-extension": { primary: ["triceps"], synergist: [] },
  "cable-overhead-extension": { primary: ["triceps"], synergist: [] },

  // --- Biceps ---
  "preacher-curl": { primary: ["biceps"], synergist: [] },
  "single-arm-preacher-curl": { primary: ["biceps"], synergist: [] },
  "incline-dumbbell-curl": { primary: ["biceps"], synergist: [] },
  "incline-hammer-curl": { primary: ["biceps"], synergist: ["forearms"] },

  // --- Legs ---
  "hip-thrust": { primary: ["glutes"], synergist: ["hamstrings"] },
  "belt-squat": { primary: ["quadriceps", "glutes"], synergist: ["hamstrings"] },
  "leg-press": { primary: ["quadriceps"], synergist: ["glutes"] }, // hams stabilise here — not credited
  "leg-extension": { primary: ["quadriceps"], synergist: [] },
  "seated-leg-curl": { primary: ["hamstrings"], synergist: [] },
  "hip-abduction": { primary: ["glutes"], synergist: [] },
  "leg-press-calf-raise": { primary: ["calves"], synergist: [] },
};

/** Accurate roles for an exercise, or the stored tags when it isn't curated yet. */
export function musclesFor(
  exerciseId: string | undefined,
  fallbackPrimary: string[] = [],
  fallbackSecondary: string[] = [],
): MuscleRoles {
  const r = exerciseId ? ROLES[exerciseId] : undefined;
  return r ?? { primary: fallbackPrimary, synergist: fallbackSecondary };
}

export function hasCuratedRoles(exerciseId: string | undefined): boolean {
  return !!exerciseId && exerciseId in ROLES;
}
