"use client";

import { useEffect, useState } from "react";
import NumberField from "@/components/NumberField";
import { getGoals, saveGoals } from "@/lib/db";
import type { Goals } from "@/lib/types";

// Mifflin-St Jeor BMR × activity, then a balanced macro split:
// protein 1.8 g/kg, fat 25% of kcal, carbs the remainder.
function suggestGoals(input: {
  sex: "m" | "f";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number;
}): Omit<Goals, "id"> {
  const { sex, age, heightCm, weightKg, activity } = input;
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "m" ? 5 : -161);
  const kcal = Math.round((bmr * activity) / 10) * 10;
  const protein_g = Math.round(weightKg * 1.8);
  const fat_g = Math.round((kcal * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  const fiber_g = Math.round((14 * kcal) / 1000); // ~14 g per 1000 kcal guideline
  const water_glasses = Math.max(6, Math.round((weightKg * 35) / 250)); // ~35 ml/kg, 250 ml glasses
  return { kcal, protein_g, carbs_g, fat_g, fiber_g, water_glasses };
}

const ACTIVITY = [
  { label: "Sedentary", value: 1.2 },
  { label: "Light", value: 1.375 },
  { label: "Moderate", value: 1.55 },
  { label: "Active", value: 1.725 },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Omit<Goals, "id"> | null>(null);
  const [saved, setSaved] = useState(false);
  const [calc, setCalc] = useState({
    sex: "m" as "m" | "f",
    age: 30,
    heightCm: 178,
    weightKg: 75,
    activity: 1.55,
  });

  useEffect(() => {
    getGoals().then(({ id: _id, ...rest }) => setGoals(rest));
  }, []);

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

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">Daily goals</h1>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 py-5">
          <Field label="Calories" unit="kcal" value={goals.kcal} onChange={(v) => update("kcal", v)} />
          <Field label="Protein" unit="g" value={goals.protein_g} onChange={(v) => update("protein_g", v)} />
          <Field label="Carbs" unit="g" value={goals.carbs_g} onChange={(v) => update("carbs_g", v)} />
          <Field label="Fat" unit="g" value={goals.fat_g} onChange={(v) => update("fat_g", v)} />
          <Field label="Fiber" unit="g" value={goals.fiber_g} onChange={(v) => update("fiber_g", v)} />
          <Field
            label="Water"
            unit="glasses"
            value={goals.water_glasses}
            onChange={(v) => update("water_glasses", v)}
          />
        </div>
      </div>

      <button className="btn btn-primary" onClick={persist}>
        {saved ? "Saved ✓" : "Save goals"}
      </button>

      {/* Optional calculator */}
      <div className="collapse collapse-arrow bg-base-100 shadow-sm">
        <input type="checkbox" />
        <div className="collapse-title font-medium">Calculate from body stats (TDEE)</div>
        <div className="collapse-content flex flex-col gap-3">
          <div className="join">
            <button
              className={`btn join-item btn-sm ${calc.sex === "m" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setCalc((c) => ({ ...c, sex: "m" }))}
            >
              Male
            </button>
            <button
              className={`btn join-item btn-sm ${calc.sex === "f" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setCalc((c) => ({ ...c, sex: "f" }))}
            >
              Female
            </button>
          </div>
          <Field label="Age" unit="yr" value={calc.age} onChange={(v) => setCalc((c) => ({ ...c, age: v }))} />
          <Field label="Height" unit="cm" value={calc.heightCm} onChange={(v) => setCalc((c) => ({ ...c, heightCm: v }))} />
          <Field label="Weight" unit="kg" value={calc.weightKg} onChange={(v) => setCalc((c) => ({ ...c, weightKg: v }))} />
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-base-content/60">Activity</span>
            <select
              className="select select-bordered select-sm"
              value={calc.activity}
              onChange={(e) => setCalc((c) => ({ ...c, activity: Number(e.target.value) }))}
            >
              {ACTIVITY.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setGoals(suggestGoals(calc));
              setSaved(false);
            }}
          >
            Use suggested goals
          </button>
        </div>
      </div>

      <p className="px-1 text-xs text-base-content/40">
        Suggestion uses Mifflin-St Jeor BMR × activity, protein 1.8 g/kg, fat 25%
        of calories. Tune the numbers above to your plan, then Save.
      </p>
    </div>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-base-content/70">{label}</span>
      <span className="flex items-center gap-2">
        <NumberField
          inputMode="numeric"
          min={0}
          value={value}
          onChange={onChange}
          className="input input-bordered input-sm w-24 text-right tabular-nums"
        />
        <span className="w-8 text-sm text-base-content/50">{unit}</span>
      </span>
    </label>
  );
}
