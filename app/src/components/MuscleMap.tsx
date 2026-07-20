"use client";

import { memo } from "react";
import { ATLAS_VIEWBOX, MUSCLE_ATLAS } from "@/lib/muscleAtlas";

// Our exercise muscle names → atlas muscle-id prefixes. The detailed atlas splits
// the back so lats / mid-back / traps / lower-back highlight in distinct places.
const HIGHLIGHT: Record<string, string[]> = {
  chest: ["chest-"],
  shoulders: ["shoulder-", "deltoid-"],
  biceps: ["biceps-"],
  triceps: ["triceps-"],
  forearms: ["forearm-"],
  abdominals: ["abs-", "obliques-"],
  traps: ["traps-upper-"],
  "middle back": ["traps-mid-", "traps-lower-"],
  lats: ["lats-"],
  "lower back": ["lower-back-"],
  quadriceps: ["quads-"],
  hamstrings: ["hamstrings-"],
  glutes: ["gluteus-maximus-"],
  calves: ["calves-"],
};

// Muscles that read best on the back view (so a thumbnail shows the right side).
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

const BODY = "#39413b"; // muted body on the dark surface
const PRIMARY = "#bef264"; // bright lime — worked muscle
const SECONDARY = "#4d7c0f"; // faint lime — assisting muscle
const STROKE = "#20241f"; // separation lines between muscles

const prefixes = (names: string[]) => names.flatMap((n) => HIGHLIGHT[n.toLowerCase()] ?? []);
function preferredView(primary: string[]): "front" | "back" {
  return POSTERIOR.has((primary[0] ?? "").toLowerCase()) ? "back" : "front";
}

function Figure({
  view,
  primary,
  secondary,
  height,
}: {
  view: "front" | "back" | "both";
  primary: string[];
  secondary: string[];
  height: string;
}) {
  const prim = prefixes(primary);
  const sec = prefixes(secondary);
  const muscles =
    view === "both"
      ? MUSCLE_ATLAS
      : MUSCLE_ATLAS.filter((m) => m.view === (view === "front" ? "FRONT" : "BACK"));
  const vb = view === "front" ? ATLAS_VIEWBOX.front : view === "back" ? ATLAS_VIEWBOX.back : ATLAS_VIEWBOX.both;
  return (
    <svg viewBox={vb} style={{ height, width: "auto", display: "block" }} aria-hidden>
      {muscles.map((m) => {
        const fill = prim.some((p) => m.id.startsWith(p))
          ? PRIMARY
          : sec.some((p) => m.id.startsWith(p))
            ? SECONDARY
            : BODY;
        return <path key={m.id} d={m.path} fill={fill} stroke={STROKE} strokeWidth={0.12} />;
      })}
    </svg>
  );
}

// Small always-visible list thumbnail: one body, the side where the muscle is.
export const MuscleThumb = memo(function MuscleThumb({
  primary,
  secondary = [],
}: {
  primary: string[];
  secondary?: string[];
}) {
  return (
    <div className="shrink-0" style={{ lineHeight: 0 }}>
      <Figure view={preferredView(primary)} primary={primary} secondary={secondary} height="2.75rem" />
    </div>
  );
});

// The full front + back diagram for a detail view.
export default function MuscleMap({
  primary,
  secondary = [],
  height = "12rem",
}: {
  primary: string[];
  secondary?: string[];
  height?: string;
}) {
  return (
    <div className="flex w-full justify-center">
      <Figure view="both" primary={primary} secondary={secondary} height={height} />
    </div>
  );
}
