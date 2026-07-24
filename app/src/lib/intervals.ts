import type { Phase } from "./timer";

// --- Norwegian 4×4 (and generic HIIT) --------------------------------------
// Classic protocol: warm-up, then N bouts of hard work separated by active
// recovery, then a cool-down. Recovery sits *between* bouts; the cool-down
// replaces a trailing recovery after the last bout.
export type HiitConfig = {
  intervals: number; // number of hard bouts (4 in a 4×4)
  workSec: number; // seconds per hard bout (240 = 4:00)
  recoverSec: number; // active recovery between bouts (180 = 3:00)
  warmupSec: number;
  cooldownSec: number;
};

export const NORWEGIAN_4x4: HiitConfig = {
  intervals: 4,
  workSec: 240,
  recoverSec: 180,
  warmupSec: 600,
  cooldownSec: 300,
};

const PREP_SEC = 5; // "get ready" countdown before the first phase

export function buildHiit(c: HiitConfig): Phase[] {
  const phases: Phase[] = [];
  phases.push({ label: "Get ready", seconds: PREP_SEC, kind: "prep", note: "Get set to start", say: "Get ready" });
  if (c.warmupSec > 0)
    phases.push({ label: "Warm-up", seconds: c.warmupSec, kind: "warmup", note: "Easy pace, ~60% effort", say: "Warm up" });
  for (let i = 0; i < c.intervals; i++) {
    phases.push({
      label: `Work ${i + 1}/${c.intervals}`,
      seconds: c.workSec,
      kind: "work",
      note: "Hard — 85–95% max heart rate",
      say: `Work, ${i + 1} of ${c.intervals}. Go`,
    });
    if (i < c.intervals - 1)
      phases.push({ label: "Recovery", seconds: c.recoverSec, kind: "recover", note: "Active — keep moving, ~70%", say: "Recover" });
  }
  if (c.cooldownSec > 0)
    phases.push({ label: "Cool-down", seconds: c.cooldownSec, kind: "cooldown", note: "Easy — bring it down", say: "Cool down" });
  return phases;
}

// --- McGill Big Three -------------------------------------------------------
// Spine-sparing isometric core work: curl-up, side bridge (both sides), bird
// dog (both sides). Held ~10s, a descending-pyramid rep scheme (e.g. 6/4/2)
// with short rests. Each "rep" is one hold; side exercises run left then right.
export type McGillConfig = {
  holdSec: number; // seconds per hold
  restSec: number; // short rest between reps within a set
  setRestSec: number; // longer rest between sets / sides / exercises (reposition)
  pyramid: number[]; // reps per set, e.g. [6, 4, 2]
};

export const MCGILL_DEFAULT: McGillConfig = {
  holdSec: 10,
  restSec: 8,
  setRestSec: 30,
  pyramid: [6, 4, 2],
};

const BIG_THREE: { name: string; sides: string[]; cue: string }[] = [
  {
    name: "Curl-up",
    sides: [""],
    // McGill curl-up: ONE knee bent, the other leg straight; hands under the
    // lumbar spine to keep its natural arch. Switch the bent leg between sets.
    cue: "One knee bent, other leg straight — hands under your low back, lift head & shoulders just off the floor",
  },
  { name: "Side bridge", sides: ["Left", "Right"], cue: "On your side, hips up in a straight line — brace hard" },
  { name: "Bird dog", sides: ["Left", "Right"], cue: "Opposite arm & leg out, back flat, don't rotate the hips" },
];

export function buildMcGill(c: McGillConfig): Phase[] {
  const phases: Phase[] = [];
  phases.push({
    label: "Get ready",
    seconds: PREP_SEC,
    kind: "prep",
    note: `First up: ${BIG_THREE[0].name} — ${BIG_THREE[0].cue}`,
    say: `Get ready. ${BIG_THREE[0].name}`,
  });

  // Flatten every hold, tagged with its group (exercise + side + set) so we can
  // choose the rest length between consecutive holds.
  type Unit = { ex: number; setIdx: number; side: string; who: string; spoken: string; cue: string; rep: number; reps: number };
  const units: Unit[] = [];
  for (let e = 0; e < BIG_THREE.length; e++) {
    const ex = BIG_THREE[e];
    for (let s = 0; s < c.pyramid.length; s++) {
      const reps = c.pyramid[s];
      for (const side of ex.sides) {
        const who = side ? `${ex.name} · ${side}` : ex.name;
        const spoken = side ? `${ex.name}, ${side}` : ex.name;
        for (let r = 0; r < reps; r++) units.push({ ex: e, setIdx: s, side, who, spoken, cue: ex.cue, rep: r, reps });
      }
    }
  }

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    phases.push({
      label: u.who,
      seconds: c.holdSec,
      kind: "hold",
      note: `Set ${u.setIdx + 1} · hold ${u.rep + 1}/${u.reps} — ${u.cue}`,
      say: "Go",
    });
    const n = units[i + 1];
    if (!n) break;
    const sameGroup = n.ex === u.ex && n.side === u.side && n.setIdx === u.setIdx;
    if (sameGroup) {
      // Between reps of the same set: short breather.
      phases.push({ label: "Rest", seconds: c.restSec, kind: "rest", note: "Breathe, reset your brace", say: "Rest" });
    } else {
      // New set, side, or exercise: longer rest to reposition. Announce what's
      // next so you can get set up during the rest.
      const reposition = n.ex !== u.ex || n.side !== u.side;
      phases.push({
        label: reposition ? `Next: ${n.who}` : "Rest · next set",
        seconds: c.setRestSec,
        kind: "rest",
        note: reposition ? `Get into position — ${n.cue}` : "Longer rest before the next set",
        say: reposition ? `Next, ${n.spoken}` : "Rest, next set",
      });
    }
  }
  return phases;
}
