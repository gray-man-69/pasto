// Turns your logged training + nutrition into a short, prioritised, science-based
// "what to do this week" list. Ordered by the levers that most drive hypertrophy:
// enough hard sets per muscle (10–20, near failure) → protein → recovery/deload.

const MEV = 10; // minimum effective volume (sets/muscle/week)
const MRV = 22; // past here, recovery becomes the limiter

export type CoachLevel = "warn" | "info" | "good";
export interface CoachTip {
  level: CoachLevel;
  text: string;
}

export interface CoachInput {
  volume: { muscle: string; sets: number }[]; // hard sets per muscle THIS week
  avgRir: number | null; // avg reps-in-reserve of RIR-logged sets this week
  ratedSets: number; // how many sets have an RIR logged
  proteinAvg: number | null; // avg protein g/day over tracked days this week
  proteinGoal: number; // daily protein goal (g)
  proteinDaysTracked: number;
  deloadNext: boolean; // this is the last hard week of an active block
  deloadNow: boolean; // currently a deload week
  trainedThisWeek: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function coachTips(i: CoachInput): CoachTip[] {
  const warns: CoachTip[] = [];
  const infos: CoachTip[] = [];
  const goods: CoachTip[] = [];

  // 1 · Volume gaps — the #1 driver. Muscles under MEV, biggest gap first.
  const gaps = i.volume.filter((v) => v.sets < MEV).sort((a, b) => a.sets - b.sets);
  for (const g of gaps.slice(0, 3)) {
    const need = MEV - g.sets;
    warns.push({
      level: "warn",
      text: `Add ${need} set${need === 1 ? "" : "s"} to ${cap(g.muscle)} — ${g.sets}/10–20 hard sets this week.`,
    });
  }

  // 2 · Effort — a set only counts if it's hard (0–3 RIR).
  if (i.ratedSets >= 3 && i.avgRir != null && i.avgRir >= 4) {
    warns.push({
      level: "warn",
      text: `Your sets average ~${i.avgRir} reps in reserve — take them closer to failure (1–2 left) or they barely count.`,
    });
  } else if (i.ratedSets === 0 && i.trainedThisWeek) {
    infos.push({
      level: "info",
      text: `Tap RIR on your sets to check they're hard enough — aim 0–3 reps from failure.`,
    });
  }

  // 3 · Protein — fuel for growth (the app's edge: it knows your food too).
  if (i.proteinDaysTracked >= 2 && i.proteinAvg != null && i.proteinGoal > 0 && i.proteinAvg < i.proteinGoal * 0.9) {
    warns.push({
      level: "warn",
      text: `Protein ~${Math.round(i.proteinAvg)} g/day vs your ${i.proteinGoal} g goal — eat more to build muscle.`,
    });
  }

  // 4 · Over-volume — recovery becomes the limiter past MRV.
  const high = i.volume.filter((v) => v.sets > MRV).sort((a, b) => b.sets - a.sets)[0];
  if (high) {
    infos.push({
      level: "info",
      text: `${cap(high.muscle)} at ${high.sets} sets — that's a lot; make sure you're recovering, or trim a little.`,
    });
  }

  // 5 · Deload timing.
  if (i.deloadNow) {
    goods.push({ level: "good", text: `Deload week — keep it light; you're recovering to grow into the next block.` });
  } else if (i.deloadNext) {
    infos.push({ level: "info", text: `Last hard week — a deload next week will let you rebound stronger.` });
  }

  if (warns.length === 0 && infos.length === 0) {
    goods.unshift({
      level: "good",
      text: i.trainedThisWeek
        ? `On track — volume, effort and protein look good. Keep progressing.`
        : `No training logged this week yet — get your hard sets in.`,
    });
  }

  return [...warns, ...infos, ...goods].slice(0, 5);
}
