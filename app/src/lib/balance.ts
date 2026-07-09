// Auto-balance the amounts of chosen items to hit daily macro goals — the classic
// "diet problem", solved on-device as a small convex optimisation (coordinate
// descent + integer/step polish). No dependency, runs in microseconds.
//
// An "item" is anything with a per-unit macro vector and a [min,max] range in that
// unit: a food (per gram) or a saved meal (per serving). Same math either way.
//
// Rules encoded: calories within ±KCAL_TOL of goal; protein & fiber at least their
// goal (more is fine, only lightly discouraged from overshooting a lot); carbs &
// fat as close to goal as possible, free to flex to keep calories in band. Hard
// rules use a large quadratic + linear (L1) penalty, so they hold right at the
// boundary and the objective stays convex with a single optimum.
import type { Goals, Nutrients } from "./types";

export const KCAL_TOL = 50;

export type BalanceItem = {
  per: Nutrients; // macros per one unit (per gram for a food, per serving for a meal)
  min: number; // lower bound in units (a locked item has min === max)
  max: number; // upper bound in units
  step: number; // rounding granularity in units (1 g for food, e.g. 0.25 serving for a meal)
};

type Coef = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };

/** Solve for the amount of each item (snapped to its step; locked items kept
 * exact) that best meets the goals. Always returns a best-effort answer. */
export function balanceDay(items: BalanceItem[], goals: Goals): number[] {
  const n = items.length;
  if (n === 0) return [];

  const A: Coef[] = items.map((it) => ({
    kcal: it.per.kcal,
    protein: it.per.protein_g,
    carbs: it.per.carbs_g,
    fat: it.per.fat_g,
    fiber: it.per.fiber_g,
  }));

  const Gk = goals.kcal || 1;
  const Gp = goals.protein_g || 1;
  const Gc = goals.carbs_g || 1;
  const Gf = goals.fat_g || 1;
  const Gfib = goals.fiber_g || 1;

  const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  const hinge = (x: number) => (x > 0 ? x : 0);
  const snap = (x: number, step: number) => Math.round(x / step) * step;

  // Warm start: give each item an equal share of the calorie goal.
  const g = items.map((it, i) => clamp(Gk / n / Math.max(A[i].kcal, 0.05), it.min, it.max));

  const totals = (gg: number[]) => {
    let k = 0, p = 0, c = 0, f = 0, fib = 0;
    for (let i = 0; i < n; i++) {
      k += gg[i] * A[i].kcal;
      p += gg[i] * A[i].protein;
      c += gg[i] * A[i].carbs;
      f += gg[i] * A[i].fat;
      fib += gg[i] * A[i].fiber;
    }
    return { k, p, c, f, fib };
  };

  const P = 2000, PL = 400, wC = 1, wF = 1, wKc = 0.6, sOver = 0.3;
  const cost = (gg: number[]) => {
    const { k, p, c, f, fib } = totals(gg);
    const overBand = hinge(k - (Gk + KCAL_TOL)) / Gk;
    const underBand = hinge(Gk - KCAL_TOL - k) / Gk;
    const shortP = hinge(Gp - p) / Gp;
    const shortFib = hinge(Gfib - fib) / Gfib;
    let J = 0;
    J += wC * ((c - Gc) / Gc) ** 2; // carbs → goal
    J += wF * ((f - Gf) / Gf) ** 2; // fat → goal
    J += wKc * ((k - Gk) / Gk) ** 2; // gently centre kcal in the band
    J += P * (overBand ** 2 + underBand ** 2 + shortP ** 2 + shortFib ** 2);
    J += PL * (overBand + underBand + shortP + shortFib); // L1 exact-penalty push
    J += sOver * (hinge(p - Gp) / Gp) ** 2; // keep protein only slightly over
    J += sOver * (hinge(fib - Gfib) / Gfib) ** 2; // keep fiber only slightly over
    return J;
  };

  for (let sweep = 0; sweep < 50; sweep++) {
    for (let i = 0; i < n; i++) {
      let lo = items[i].min;
      let hi = items[i].max;
      if (hi - lo < 1e-9) {
        g[i] = lo;
        continue;
      }
      for (let it = 0; it < 50; it++) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        g[i] = m1;
        const c1 = cost(g);
        g[i] = m2;
        const c2 = cost(g);
        if (c1 < c2) hi = m2;
        else lo = m1;
      }
      g[i] = clamp((lo + hi) / 2, items[i].min, items[i].max);
    }
  }

  // Snap to each item's step, then a short polish so rounding can't tip a
  // satisfiable band/floor back out of range. Locked items stay exact.
  for (let i = 0; i < n; i++) {
    g[i] = items[i].min === items[i].max ? items[i].min : snap(g[i], items[i].step);
  }
  for (let sweep = 0; sweep < 8; sweep++) {
    for (let i = 0; i < n; i++) {
      if (items[i].min === items[i].max) continue;
      const step = items[i].step;
      const base0 = snap(g[i], step); // anchor candidates on the current value
      let best = g[i];
      let bestC = cost(g);
      for (let d = -5; d <= 5; d++) {
        const cand = clamp(base0 + d * step, items[i].min, items[i].max);
        g[i] = cand;
        const c = cost(g);
        if (c < bestC - 1e-12) {
          bestC = c;
          best = cand;
        }
      }
      g[i] = best;
    }
  }
  return g;
}

export type GoalStatus = {
  kcal: "ok" | "over" | "under";
  protein: "ok" | "short";
  fiber: "ok" | "short";
  proteinGap: number;
  fiberGap: number;
};

/** Classify achieved totals against the rules, for the result banner. */
export function dayStatus(totals: Nutrients, goals: Goals): GoalStatus {
  const dk = totals.kcal - goals.kcal;
  return {
    kcal: dk > KCAL_TOL ? "over" : dk < -KCAL_TOL ? "under" : "ok",
    protein: totals.protein_g >= goals.protein_g - 1 ? "ok" : "short",
    fiber: totals.fiber_g >= goals.fiber_g - 1 ? "ok" : "short",
    proteinGap: Math.max(0, goals.protein_g - totals.protein_g),
    fiberGap: Math.max(0, goals.fiber_g - totals.fiber_g),
  };
}
