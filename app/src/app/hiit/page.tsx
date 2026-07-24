"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TimerScreen from "@/components/TimerScreen";
import { useTimer, fmtClock } from "@/lib/timer";
import { buildHiit, NORWEGIAN_4x4, type HiitConfig } from "@/lib/intervals";

const KEY = "pasto-hiit-config";

function load(): HiitConfig {
  if (typeof window === "undefined") return NORWEGIAN_4x4;
  try {
    return { ...NORWEGIAN_4x4, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return NORWEGIAN_4x4;
  }
}

export default function HiitPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<HiitConfig>(load);
  const [started, setStarted] = useState(false);
  const phases = useMemo(() => buildHiit(cfg), [cfg]);
  const timer = useTimer(phases);

  const total = phases.reduce((n, p) => n + p.seconds, 0);
  function set<K extends keyof HiitConfig>(k: K, v: number) {
    const next = { ...cfg, [k]: Math.max(k === "intervals" ? 1 : 0, v) };
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
        title="Norwegian 4×4"
        phases={phases}
        timer={timer}
        onExit={() => {
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
        <h1 className="text-lg font-bold">Norwegian 4×4</h1>
        <span className="w-14" />
      </div>

      <p className="text-sm text-base-content/50">
        High-intensity intervals: warm up, then hard bouts with active recovery between, and a
        cool-down. The classic 4×4 is four 4-minute bouts at 85–95% max heart rate.
      </p>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-base-300 bg-base-100 p-4">
        <Stepper label="Intervals" value={cfg.intervals} suffix="×" onChange={(d) => set("intervals", cfg.intervals + d)} step={1} />
        <Stepper label="Work" value={cfg.workSec} time onChange={(d) => set("workSec", cfg.workSec + d * 30)} step={30} />
        <Stepper label="Recovery" value={cfg.recoverSec} time onChange={(d) => set("recoverSec", cfg.recoverSec + d * 30)} step={30} />
        <Stepper label="Warm-up" value={cfg.warmupSec} time onChange={(d) => set("warmupSec", cfg.warmupSec + d * 60)} step={60} />
        <Stepper label="Cool-down" value={cfg.cooldownSec} time onChange={(d) => set("cooldownSec", cfg.cooldownSec + d * 60)} step={60} />
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-base-200/50 px-4 py-3 text-sm">
        <span className="text-base-content/50">Total time</span>
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

      <button onClick={() => set2Preset(setCfg)} className="btn btn-ghost btn-sm self-center text-base-content/50">
        Reset to classic 4×4
      </button>
    </div>
  );
}

function set2Preset(setCfg: (c: HiitConfig) => void) {
  setCfg(NORWEGIAN_4x4);
  try {
    localStorage.setItem(KEY, JSON.stringify(NORWEGIAN_4x4));
  } catch {
    /* ignore */
  }
}

function Stepper({
  label,
  value,
  onChange,
  step,
  time = false,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (dir: number) => void;
  step: number;
  time?: boolean;
  suffix?: string;
}) {
  void step;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(-1)} className="btn btn-circle btn-sm btn-ghost text-lg" aria-label={`Decrease ${label}`}>
          −
        </button>
        <span className="w-16 text-center text-sm font-semibold tabular-nums">
          {time ? fmtClock(value) : `${value}${suffix}`}
        </span>
        <button onClick={() => onChange(1)} className="btn btn-circle btn-sm btn-ghost text-lg" aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}
