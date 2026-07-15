"use client";

import { useState } from "react";
import MuscleMap from "@/components/MuscleMap";
import { newCustomExerciseId, saveCustomExercise } from "@/lib/db";
import { MUSCLES } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";

const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "body only", "kettlebells", "other"];

// Create an exercise that isn't in the bundled 72 (a machine at your gym, an
// Italian-named lift, whatever). Stored in IndexedDB and synced like the rest.
export default function CustomExerciseForm({
  initialName = "",
  onClose,
  onCreated,
}: {
  initialName?: string;
  onClose: () => void;
  onCreated: (ex: Exercise) => void;
}) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<string>("chest");
  const [equipment, setEquipment] = useState("barbell");
  const [mechanic, setMechanic] = useState<"compound" | "isolation">("compound");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const ex: Exercise = {
      id: newCustomExerciseId(),
      name: name.trim(),
      category: "strength",
      equipment,
      mechanic,
      primaryMuscles: [muscle],
      custom: true,
    };
    await saveCustomExercise(ex);
    onCreated(ex);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-base-300 bg-base-100 p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">New exercise</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-base-content/60">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pendolo · Chest press machine"
            className="input input-bordered w-full"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-base-content/60">Primary muscle</span>
          <select
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
            className="select select-bordered w-full capitalize"
          >
            {MUSCLES.map((m) => (
              <option key={m} value={m} className="capitalize">
                {m}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-base-content/60">Equipment</span>
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="select select-bordered select-sm w-full capitalize"
            >
              {EQUIPMENT.map((eq) => (
                <option key={eq} value={eq} className="capitalize">
                  {eq}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-base-content/60">Type</span>
            <div className="flex overflow-hidden rounded-lg border border-base-300 text-sm">
              {(["compound", "isolation"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMechanic(t)}
                  className={`flex-1 px-2 py-1.5 capitalize ${
                    mechanic === t ? "bg-primary text-primary-content" : "text-base-content/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </label>
        </div>

        <div className="mb-4 flex justify-center rounded-2xl bg-base-200/40 py-2">
          <MuscleMap primary={[muscle]} />
        </div>

        <button className="btn btn-primary w-full" disabled={busy || !name.trim()} onClick={save}>
          Create exercise
        </button>
      </div>
    </div>
  );
}
