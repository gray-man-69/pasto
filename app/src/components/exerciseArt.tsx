"use client";

// Minimalist, on-brand line illustrations for exercise execution — drawn in the
// app's own icon style (thin rounded strokes, lime accent on the working
// implement) instead of stock photos. Original artwork, so there's no licensing
// question and it matches the dark/lime theme. Two frames per lift alternate to
// suggest the movement. Registry is keyed by exercise id; absent = no art.

const svgProps = {
  viewBox: "0 0 260 170",
  fill: "none" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "w-full",
};

/** Bench, floor and the lifter's body — identical across frames. */
function BenchBody() {
  return (
    <g className="stroke-base-content/45" strokeWidth={2.4}>
      {/* floor */}
      <line x1="24" y1="152" x2="236" y2="152" className="stroke-base-content/20" />
      {/* bench pad + legs */}
      <rect x="52" y="112" width="126" height="12" rx="6" />
      <path d="M70 124 L64 152 M160 124 L166 152" />
      {/* head, torso, bent leg with foot planted */}
      <circle cx="168" cy="103" r="9" />
      <path d="M159 106 L88 109" />
      <path d="M88 109 L58 128 L66 152" />
    </g>
  );
}

/** Barbell held at a given bar height with the drawn arm bent to reach it. */
function Press({ arm, bar }: { arm: string; bar: number }) {
  return (
    <g strokeLinecap="round">
      <path d={arm} className="stroke-base-content/45" strokeWidth={2.4} fill="none" />
      {/* bar */}
      <line x1="112" y1={bar} x2="196" y2={bar} className="stroke-primary" strokeWidth={4} />
      {/* plates at each end */}
      <line x1="116" y1={bar - 11} x2="116" y2={bar + 11} className="stroke-primary" strokeWidth={5} />
      <line x1="192" y1={bar - 11} x2="192" y2={bar + 11} className="stroke-primary" strokeWidth={5} />
    </g>
  );
}

function BenchPress({ frame }: { frame: number }) {
  // frame 0: bar at chest (arms bent, elbows flared) · frame 1: locked out (arms up)
  const bottom = { arm: "M159 106 L172 90 L152 82", bar: 80 };
  const top = { arm: "M159 106 L156 82 L154 60", bar: 58 };
  const f = frame === 0 ? bottom : top;
  return (
    <svg {...svgProps}>
      <BenchBody />
      <Press arm={f.arm} bar={f.bar} />
    </svg>
  );
}

// Registry: id → { frames, render }.
const ART: Record<string, { frames: number; render: (frame: number) => React.ReactNode }> = {
  "barbell-bench-press": { frames: 2, render: (frame) => <BenchPress frame={frame} /> },
};

export function artFrames(id: string): number {
  return ART[id]?.frames ?? 0;
}
export function ExerciseArt({ id, frame }: { id: string; frame: number }) {
  return <>{ART[id]?.render(frame)}</>;
}
