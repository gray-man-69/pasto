"use client";

import Model, { type IExerciseData, type Muscle } from "react-body-highlighter";

// Maps our exercise muscle names → the body-highlighter's muscle keys.
const MAP: Record<string, Muscle[]> = {
  chest: ["chest"],
  shoulders: ["front-deltoids", "back-deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  abdominals: ["abs"],
  traps: ["trapezius"],
  lats: ["upper-back"],
  "middle back": ["upper-back"],
  "lower back": ["lower-back"],
  quadriceps: ["quadriceps"],
  hamstrings: ["hamstring"],
  glutes: ["gluteal"],
  calves: ["calves"],
};

function toMuscles(names: string[]): Muscle[] {
  const out = new Set<Muscle>();
  for (const n of names) for (const m of MAP[n.toLowerCase()] ?? []) out.add(m);
  return [...out];
}

// A Technogym-style body diagram: front + back silhouettes with the worked
// muscles lit in lime (primary bright, secondary faint). On-brand, MIT-licensed.
export default function MuscleMap({
  primary,
  secondary = [],
}: {
  primary: string[];
  secondary?: string[];
}) {
  const data: IExerciseData[] = [
    { name: "secondary", muscles: toMuscles(secondary), frequency: 1 },
    { name: "primary", muscles: toMuscles(primary), frequency: 2 },
  ];
  // highlightedColors[freq-1]: faint lime for secondary, bright lime for primary.
  const colors = ["#4d7c0f", "#bef264"];
  const bodyColor = "#39413b"; // muted, sits on the dark surface

  return (
    <div className="flex items-start justify-center gap-4">
      <Model data={data} type="anterior" bodyColor={bodyColor} highlightedColors={colors} style={{ width: "44%", maxWidth: 150 }} />
      <Model data={data} type="posterior" bodyColor={bodyColor} highlightedColors={colors} style={{ width: "44%", maxWidth: 150 }} />
    </div>
  );
}
