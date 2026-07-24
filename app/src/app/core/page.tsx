"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TimerScreen from "@/components/TimerScreen";
import { useTimer, fmtClock } from "@/lib/timer";
import { useConditioningLogger } from "@/lib/conditioningLog";
import { buildMcGill, MCGILL_DEFAULT, type McGillConfig } from "@/lib/intervals";

const KEY = "pasto-mcgill-config";

function load(): McGillConfig {
  if (typeof window === "undefined") return MCGILL_DEFAULT;
  try {
    return { ...MCGILL_DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return MCGILL_DEFAULT;
  }
}

const PYRAMIDS: { label: string; reps: number[] }[] = [
  { label: "6·4·2", reps: [6, 4, 2] },
  { label: "5·3·1", reps: [5, 3, 1] },
  { label: "8·6·4", reps: [8, 6, 4] },
  { label: "Flat 5·5·5", reps: [5, 5, 5] },
];

export default function CorePage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<McGillConfig>(load);
  const [started, setStarted] = useState(false);
  const phases = useMemo(() => buildMcGill(cfg), [cfg]);
  const timer = useTimer(phases);
  const logExit = useConditioningLogger({
    timer,
    phases,
    kind: "mcgill",
    name: "McGill Big Three",
    workKind: "hold",
    makeSummary: (done, total) => `${done}/${total} holds · ${fmtClock(cfg.holdSec)} each`,
  });

  const total = phases.reduce((n, p) => n + p.seconds, 0);
  const holds = phases.filter((p) => p.kind === "hold").length;

  function save(next: McGillConfig) {
    setCfg(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  if (started) {
    return (
      <TimerScreen
        title="McGill Big Three"
        phases={phases}
        timer={timer}
        onExit={() => {
          logExit();
          timer.pause();
          setStarted(false);
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">
          ‹ Back
        </button>
        <h1 className="text-lg font-bold">McGill Big Three</h1>
        <span className="w-14" />
      </div>

      <p className="text-sm text-base-content/50">
        Spine-sparing isometric core: curl-up, side bridge (both sides), bird dog (both sides).
        Short holds in a descending pyramid — builds endurance without loading the spine.
      </p>

      <div className="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-4">
        <Stepper label="Hold" value={cfg.holdSec} time onChange={(d) => save({ ...cfg, holdSec: Math.max(3, cfg.holdSec + d * 2) })} />
        <Stepper label="Rest" value={cfg.restSec} time onChange={(d) => save({ ...cfg, restSec: Math.max(0, cfg.restSec + d * 5) })} />
        <div className="flex items-center justify-between">
          <span className="text-sm">Reps per set</span>
          <div className="flex gap-1.5">
            {PYRAMIDS.map((p) => {
              const on = p.reps.join() === cfg.pyramid.join();
              return (
                <button
                  key={p.label}
                  onClick={() => save({ ...cfg, pyramid: p.reps })}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                    on ? "bg-primary/15 text-primary" : "text-base-content/50 hover:bg-base-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-base-200/50 px-4 py-3 text-sm">
        <span className="text-base-content/50">{holds} holds · total</span>
        <span className="font-semibold tabular-nums">{fmtClock(total)}</span>
      </div>

      <button
        onClick={() => {
          timer.reset();
          setStarted(true);
        }}
        className="btn btn-primary btn-lg rounded-full"
      >
        Start
      </button>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  time = false,
}: {
  label: string;
  value: number;
  onChange: (dir: number) => void;
  time?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(-1)} className="btn btn-circle btn-sm btn-ghost text-lg" aria-label={`Decrease ${label}`}>
          −
        </button>
        <span className="w-16 text-center text-sm font-semibold tabular-nums">
          {time ? fmtClock(value) : value}
        </span>
        <button onClick={() => onChange(1)} className="btn btn-circle btn-sm btn-ghost text-lg" aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}
