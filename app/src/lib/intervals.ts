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

export function buildHiit(c: HiitConfig): Phase[] {
  const phases: Phase[] = [];
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
  restSec: number; // rest between holds/sides/exercises
  pyramid: number[]; // reps per set, e.g. [6, 4, 2]
};

export const MCGILL_DEFAULT: McGillConfig = {
  holdSec: 10,
  restSec: 20,
  pyramid: [6, 4, 2],
};

const BIG_THREE: { name: string; sides: string[]; cue: string }[] = [
  { name: "Curl-up", sides: [""], cue: "Hands under low back, one knee bent, lift head/shoulders slightly" },
  { name: "Side bridge", sides: ["Left", "Right"], cue: "On your side, hips up, straight line — brace" },
  { name: "Bird dog", sides: ["Left", "Right"], cue: "Opposite arm & leg out, back flat, don't rotate" },
];

export function buildMcGill(c: McGillConfig): Phase[] {
  const phases: Phase[] = [];
  const push = (p: Phase) => phases.push(p);
  for (let e = 0; e < BIG_THREE.length; e++) {
    const ex = BIG_THREE[e];
    for (let s = 0; s < c.pyramid.length; s++) {
      const reps = c.pyramid[s];
      for (const side of ex.sides) {
        const who = side ? `${ex.name} · ${side}` : ex.name;
        const spoken = side ? `${ex.name}, ${side}` : ex.name;
        for (let r = 0; r < reps; r++) {
          // Only name the exercise on the first hold of a run; later holds just
          // say "Hold" so the voice isn't chatty every 10 seconds.
          push({
            label: `${who}`,
            seconds: c.holdSec,
            kind: "hold",
            note: `Set ${s + 1} · hold ${r + 1}/${reps} — ${ex.cue}`,
            say: r === 0 ? `${spoken}. Hold` : "Hold",
          });
          const lastHold = e === BIG_THREE.length - 1 && s === c.pyramid.length - 1 && side === ex.sides[ex.sides.length - 1] && r === reps - 1;
          if (!lastHold) push({ label: "Rest", seconds: c.restSec, kind: "rest", note: "Breathe, reset your brace", say: "Rest" });
        }
      }
    }
  }
  return phases;
}
