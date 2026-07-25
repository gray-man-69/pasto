// Spine-safe exercise policy.
//
// The owner trains with two herniated discs (see CLAUDE.md): training features
// must never program axially spine-loading movements. Until now this rule lived
// only as a project convention — this module is its first encoding in code, so
// the plan generator (and anything else) can enforce it.
//
// Excluded = heavy axial compression and/or loaded lumbar flexion/extension.
// Deliberately KEPT (spine-friendly leg/glute work): leg press, hack squat,
// leg extension, leg curls, hip thrust, glute bridge, glute machines, lunges,
// step-ups, goblet/split squats (light, DB at sides), calf raises.

export const SPINE_LOADING_IDS = new Set<string>([
  "deadlift",
  "sumo-deadlift",
  "romanian-deadlift",
  "conventional-deadlift",
  "trap-bar-deadlift",
  "barbell-squat",
  "front-squat",
  "good-morning",
  "back-extension", // loaded lumbar extension — avoid with disc issues
  "hyperextension",
]);

/** True if an exercise axially loads / hinges the spine and should be excluded
 * for a spine-safe plan. */
export function isSpineLoading(ex: { id: string; primaryMuscles?: string[] }): boolean {
  if (SPINE_LOADING_IDS.has(ex.id)) return true;
  // Defensive: anything whose PRIMARY target is the lower back is, by our policy,
  // a loaded-spine movement we don't program.
  if (ex.primaryMuscles?.[0]?.toLowerCase() === "lower back") return true;
  return false;
}
