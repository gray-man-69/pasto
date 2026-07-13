"use client";

import { memo } from "react";
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

// Muscles that read best on the back view — so a thumbnail shows the side where
// the worked muscle actually is (e.g. a row shows the back, a curl shows the front).
const POSTERIOR = new Set([
  "traps",
  "lats",
  "middle back",
  "lower back",
  "glutes",
  "hamstrings",
  "calves",
  "triceps",
]);

function toMuscles(names: string[]): Muscle[] {
  const out = new Set<Muscle>();
  for (const n of names) for (const m of MAP[n.toLowerCase()] ?? []) out.add(m);
  return [...out];
}

function preferredView(primary: string[]): "anterior" | "posterior" {
  return POSTERIOR.has((primary[0] ?? "").toLowerCase()) ? "posterior" : "anterior";
}

const COLORS = ["#4d7c0f", "#bef264"]; // [secondary faint, primary bright] by frequency
const BODY = "#39413b"; // muted body on the dark surface

function data(primary: string[], secondary: string[]): IExerciseData[] {
  return [
    { name: "secondary", muscles: toMuscles(secondary), frequency: 1 },
    { name: "primary", muscles: toMuscles(primary), frequency: 2 },
  ];
}

// A small always-visible thumbnail for a list row: one body, the relevant side.
export const MuscleThumb = memo(function MuscleThumb({
  primary,
  secondary = [],
}: {
  primary: string[];
  secondary?: string[];
}) {
  return (
    <div className="shrink-0" style={{ lineHeight: 0 }} aria-hidden>
      <Model
        data={data(primary, secondary)}
        type={preferredView(primary)}
        bodyColor={BODY}
        highlightedColors={COLORS}
        svgStyle={{ height: "2.75rem", width: "auto" }}
      />
    </div>
  );
});

// The full front + back diagram (kept for a larger detail view later).
export default function MuscleMap({
  primary,
  secondary = [],
}: {
  primary: string[];
  secondary?: string[];
}) {
  return (
    <div className="flex items-start justify-center gap-4">
      <Model data={data(primary, secondary)} type="anterior" bodyColor={BODY} highlightedColors={COLORS} style={{ width: "44%", maxWidth: 150 }} />
      <Model data={data(primary, secondary)} type="posterior" bodyColor={BODY} highlightedColors={COLORS} style={{ width: "44%", maxWidth: 150 }} />
    </div>
  );
}
