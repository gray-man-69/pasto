"use client";

import { useEffect, useState } from "react";
import NumberField from "@/components/NumberField";
import { allWeights, getGoals, saveGoals } from "@/lib/db";
import { ACTIVITY, GOALS, goalMeta, macrosFor, suggestGoals, tdee, type BodyStats, type Goal } from "@/lib/nutritionPlan";
import type { Goals } from "@/lib/types";

const GOAL_KEY = "pasto-goal";
const AUTO_KEY = "pasto-auto-macros";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Omit<Goals, "id"> | null>(null);
  const [saved, setSaved] = useState(false);
  const [goal, setGoal] = useState<Goal>("maintain");
  const [auto, setAuto] = useState(true);
  const [body, setBody] = useState<BodyStats>({ sex: "m", age: 30, heightCm: 178, weightKg: 75, activity: 1.55 });

  useEffect(() => {
    getGoals().then(({ id: _id, ...rest }) => setGoals(rest));
    try {
      const g = localStorage.getItem(GOAL_KEY) as Goal | null;
      if (g) setGoal(g);
      if (localStorage.getItem(AUTO_KEY) === "0") setAuto(false);
    } catch {
      /* ignore */
    }
    // Default bodyweight (drives protein) from the most recent weigh-in.
    allWeights().then((w) => {
      if (w.length) setBody((b) => ({ ...b, weightKg: w[w.length - 1].kg }));
    });
  }, []);

  function chooseGoal(g: Goal) {
    setGoal(g);
    try {
      localStorage.setItem(GOAL_KEY, g);
    } catch {
      /* ignore */
    }
    // Re-split the current calories for the new goal's protein target.
    if (auto && goals) setGoals((cur) => (cur ? { ...cur, ...macrosFor(cur.kcal, body.weightKg, g) } : cur));
    setSaved(false);
  }

  function toggleAuto() {
    const v = !auto;
    setAuto(v);
    try {
      localStorage.setItem(AUTO_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (v && goals) setGoals((cur) => (cur ? { ...cur, ...macrosFor(cur.kcal, body.weightKg, goal) } : cur));
  }

  function setKcal(v: number) {
    setGoals((g) => {
      if (!g) return g;
      return auto ? { ...g, kcal: v, ...macrosFor(v, body.weightKg, goal) } : { ...g, kcal: v };
    });
    setSaved(false);
  }

  function update(field: keyof Omit<Goals, "id">, value: number) {
    setGoals((g) => (g ? { ...g, [field]: value } : g));
    setSaved(false);
  }

  async function persist() {
    if (!goals) return;
    await saveGoals(goals);
    setSaved(true);
  }

  if (!goals) return <div className="py-10 text-center text-base-content/40">Loading…</div>;

  const meta = goalMeta(goal);
  const maint = Math.round(tdee(body) / 10) * 10;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">Daily goals</h1>

      {/* Goal */}
      <div className="flex flex-col gap-2">
        <span className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">Your goal</span>
        <div className="grid grid-cols-3 gap-2">
          {GOALS.map((g) => (
            <button
              key={g.key}
              onClick={() => chooseGoal(g.key)}
              className={`rounded-2xl border px-2 py-3 text-sm font-medium transition-colors ${
                goal === g.key ? "border-primary bg-primary/15 text-primary" : "border-base-300 bg-base-100 text-base-content/70 hover:border-primary/40"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <span className="px-1 text-xs text-base-content/50">{meta.note}</span>
      </div>

      {/* Daily goals */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 py-5">
          <Field label="Calories" unit="kcal" value={goals.kcal} onChange={setKcal} />

          <label className="flex items-center justify-between gap-3 border-t border-base-300/60 pt-3">
            <span className="text-sm">
              Auto-balance macros
              <span className="block text-xs text-base-content/40">From calories, goal & bodyweight</span>
            </span>
            <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={auto} onChange={toggleAuto} />
          </label>

          <Field label="Protein" unit="g" value={goals.protein_g} onChange={(v) => update("protein_g", v)} disabled={auto} />
          <Field label="Carbs" unit="g" value={goals.carbs_g} onChange={(v) => update("carbs_g", v)} disabled={auto} />
          <Field label="Fat" unit="g" value={goals.fat_g} onChange={(v) => update("fat_g", v)} disabled={auto} />
          <Field label="Fiber" unit="g" value={goals.fiber_g} onChange={(v) => update("fiber_g", v)} disabled={auto} />
          <Field label="Water" unit="glasses" value={goals.water_glasses} onChange={(v) => update("water_glasses", v)} />

          {auto && (
            <p className="text-xs text-base-content/40">
              Protein {meta.proteinPerKg} g/kg × {body.weightKg} kg · fat ~25% of calories · carbs fill the rest ·
              fibre 14 g/1000 kcal. Change your bodyweight in the calculator below.
            </p>
          )}
        </div>
      </div>

      <button className="btn btn-primary" onClick={persist}>
        {saved ? "Saved ✓" : "Save goals"}
      </button>

      {/* TDEE calculator */}
      <div className="collapse collapse-arrow bg-base-100 shadow-sm">
        <input type="checkbox" />
        <div className="collapse-title font-medium">Calculate from body stats (TDEE)</div>
        <div className="collapse-content flex flex-col gap-3">
          <div className="join">
            <button className={`btn join-item btn-sm ${body.sex === "m" ? "btn-primary" : "btn-ghost"}`} onClick={() => setBody((b) => ({ ...b, sex: "m" }))}>
              Male
            </button>
            <button className={`btn join-item btn-sm ${body.sex === "f" ? "btn-primary" : "btn-ghost"}`} onClick={() => setBody((b) => ({ ...b, sex: "f" }))}>
              Female
            </button>
          </div>
          <Field label="Age" unit="yr" value={body.age} onChange={(v) => setBody((b) => ({ ...b, age: v }))} />
          <Field label="Height" unit="cm" value={body.heightCm} onChange={(v) => setBody((b) => ({ ...b, heightCm: v }))} />
          <Field label="Weight" unit="kg" value={body.weightKg} onChange={(v) => setBody((b) => ({ ...b, weightKg: v }))} />
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-base-content/60">Activity</span>
            <select className="select select-bordered select-sm" value={body.activity} onChange={(e) => setBody((b) => ({ ...b, activity: Number(e.target.value) }))}>
              {ACTIVITY.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between rounded-xl bg-base-200/50 px-3 py-2 text-sm">
            <span className="text-base-content/50">Maintenance</span>
            <span className="tabular-nums">
              {maint} kcal → <span className="font-semibold text-primary">{Math.round((maint * (1 + meta.kcalAdj)) / 10) * 10} kcal</span> for {meta.label.toLowerCase()}
            </span>
          </div>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setGoals(suggestGoals(body, goal));
              setSaved(false);
            }}
          >
            Use suggested goals
          </button>
        </div>
      </div>

      <p className="px-1 text-xs text-base-content/40">
        Calories: Mifflin-St Jeor BMR × activity, adjusted for your goal. Macros follow the hypertrophy /
        body-composition literature (Schoenfeld & Aragon): protein per kg scaled to your goal, fat ~25% of
        calories, carbs the remainder, fibre 14 g per 1000 kcal.
      </p>
    </div>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? "opacity-55" : ""}`}>
      <span className="text-sm text-base-content/70">{label}</span>
      <span className="flex items-center gap-2">
        <NumberField
          inputMode="numeric"
          min={0}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="input input-bordered input-sm w-24 text-right tabular-nums disabled:bg-base-200/50"
        />
        <span className="w-8 text-sm text-base-content/50">{unit}</span>
      </span>
    </label>
  );
}
