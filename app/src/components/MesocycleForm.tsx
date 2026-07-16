"use client";

import { useState } from "react";
import { addDays, localDate, saveMesocycle, weekStart } from "@/lib/db";
import { MESO_DEFAULTS } from "@/lib/mesocycle";

const thisMonday = () => weekStart(localDate());
const nextMonday = () => addDays(weekStart(localDate()), 7);
const mondayLabel = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Start a training block: sets a start week + length + ramp/deload rules. The
// workout you launch from a routine then auto-scales its set count each week.
export default function MesocycleForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("Hypertrophy block");
  const [weeks, setWeeks] = useState(MESO_DEFAULTS.weeks);
  const [addSetsPerWeek, setAddSetsPerWeek] = useState(MESO_DEFAULTS.addSetsPerWeek);
  const [deload, setDeload] = useState(MESO_DEFAULTS.deload);
  const [startDate, setStartDate] = useState(thisMonday());
  const [busy, setBusy] = useState(false);

  const accumulation = deload ? weeks - 1 : weeks;

  async function start() {
    setBusy(true);
    await saveMesocycle({
      name: name.trim() || "Training block",
      startDate,
      weeks,
      addSetsPerWeek,
      deload,
      endedAt: undefined,
    });
    onClose();
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
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">Start a training block</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs leading-snug text-base-content/50">
          Your routine&apos;s set counts are week 1. Volume ramps{" "}
          {addSetsPerWeek > 0 ? `+${addSetsPerWeek} set/exercise each week` : "stays flat"}
          {deload ? ", and the last week deloads (half the sets, lighter)." : "."}
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-base-content/60">Block name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input input-bordered w-full"
          />
        </label>

        <div className="mb-3">
          <span className="mb-1 block text-xs font-medium text-base-content/60">Starts</span>
          <div className="flex gap-1.5">
            {[
              { d: thisMonday(), label: "This week", sub: `Mon ${mondayLabel(thisMonday())}` },
              { d: nextMonday(), label: "Next Monday", sub: mondayLabel(nextMonday()) },
            ].map((o) => (
              <button
                key={o.d}
                onClick={() => setStartDate(o.d)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  startDate === o.d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-300 text-base-content/60 hover:border-primary/40"
                }`}
              >
                {o.label}
                <span className="block text-[10px] font-normal opacity-70">{o.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <span className="mb-1 block text-xs font-medium text-base-content/60">
            Length · {weeks} weeks{deload ? ` (${accumulation} building + 1 deload)` : ""}
          </span>
          <div className="flex gap-1.5">
            {[4, 5, 6, 8].map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  weeks === w
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-300 text-base-content/60 hover:border-primary/40"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <span className="mb-1 block text-xs font-medium text-base-content/60">
            Weekly volume ramp
          </span>
          <div className="flex gap-1.5">
            {[
              { v: 0, label: "Flat" },
              { v: 1, label: "+1 set/wk" },
              { v: 2, label: "+2 sets/wk" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setAddSetsPerWeek(o.v)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  addSetsPerWeek === o.v
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-300 text-base-content/60 hover:border-primary/40"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mb-4 flex items-center justify-between rounded-xl border border-base-300 px-3 py-2.5">
          <span className="text-sm">
            <span className="font-medium">Deload final week</span>
            <span className="block text-xs text-base-content/50">Half the sets, ~10% lighter</span>
          </span>
          <input
            type="checkbox"
            checked={deload}
            onChange={(e) => setDeload(e.target.checked)}
            className="toggle toggle-primary"
          />
        </label>

        <button className="btn btn-primary w-full" disabled={busy} onClick={start}>
          Start block
        </button>
      </div>
    </div>
  );
}
