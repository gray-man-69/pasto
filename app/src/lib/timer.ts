"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A phase in a timed protocol (a HIIT bout, a plank hold, a rest, …).
export type Phase = {
  label: string; // "Work 2", "Recovery", "Left side"…
  seconds: number;
  kind: "warmup" | "work" | "recover" | "hold" | "rest" | "cooldown" | "prep";
  note?: string; // short cue shown under the label
};

const KIND_COLOR: Record<Phase["kind"], string> = {
  warmup: "text-sky-400",
  work: "text-primary",
  recover: "text-amber-400",
  hold: "text-primary",
  rest: "text-amber-400",
  cooldown: "text-sky-400",
  prep: "text-base-content",
};
export const phaseColor = (k: Phase["kind"]) => KIND_COLOR[k];

// --- Audio cues: short beeps synthesized on the fly (no asset to ship/cache). --
let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx ?? new AC();
    return audioCtx;
  } catch {
    return null;
  }
}
/** Must be called from a user gesture (unlocks audio on iOS). */
export function primeAudio() {
  const c = ctx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}
function beep(freq: number, ms: number, gain = 0.15) {
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.value = freq;
  osc.type = "sine";
  g.gain.value = gain;
  osc.connect(g).connect(c.destination);
  const now = c.currentTime;
  osc.start(now);
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
  osc.stop(now + ms / 1000);
}
function cue(kind: "tick" | "go" | "done") {
  if (kind === "tick") beep(660, 120);
  else if (kind === "go") beep(880, 260, 0.2);
  else beep(520, 500, 0.2);
  try {
    navigator.vibrate?.(kind === "tick" ? 40 : kind === "go" ? 120 : [80, 60, 80]);
  } catch {
    /* not supported */
  }
}

type State = {
  index: number; // current phase
  remaining: number; // whole seconds left in this phase
  running: boolean;
  done: boolean;
};

/** Drives a list of phases: accurate wall-clock countdown, phase auto-advance,
 * 3-2-1 beeps into each phase change, and a screen wake-lock while running. */
export function useTimer(phases: Phase[]) {
  const [state, setState] = useState<State>({ index: 0, remaining: phases[0]?.seconds ?? 0, running: false, done: false });
  // Absolute epoch ms at which the current phase ends; null while paused.
  const endAt = useRef<number | null>(null);
  const idx = useRef(0);
  const lastBeep = useRef(-1);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  // Keep refs in step for the ticking closure.
  idx.current = state.index;

  const total = phases.reduce((n, p) => n + p.seconds, 0);
  const elapsedBefore = phases.slice(0, state.index).reduce((n, p) => n + p.seconds, 0);
  const overallElapsed = elapsedBefore + ((phases[state.index]?.seconds ?? 0) - state.remaining);

  const releaseWake = useCallback(() => {
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);
  const requestWake = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock) wakeLock.current = await nav.wakeLock.request("screen");
    } catch {
      /* best-effort */
    }
  }, []);

  // The tick loop: recompute remaining from the wall clock so background
  // throttling can't drift the timer.
  useEffect(() => {
    if (!state.running) return;
    let raf = 0;
    const step = () => {
      const end = endAt.current;
      if (end == null) return;
      const rem = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      const cur = phases[idx.current];
      // 3-2-1 beeps at the tail of each phase.
      if (rem <= 3 && rem >= 1 && rem !== lastBeep.current) {
        lastBeep.current = rem;
        cue("tick");
      }
      if (rem <= 0) {
        const next = idx.current + 1;
        if (next >= phases.length) {
          cue("done");
          endAt.current = null;
          releaseWake();
          setState({ index: phases.length - 1, remaining: 0, running: false, done: true });
          return;
        }
        cue("go");
        lastBeep.current = -1;
        endAt.current = Date.now() + phases[next].seconds * 1000;
        setState((s) => ({ ...s, index: next, remaining: phases[next].seconds }));
      } else {
        setState((s) => (s.remaining === rem ? s : { ...s, remaining: rem }));
      }
      raf = requestAnimationFrame(step);
      void cur;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state.running, phases, releaseWake]);

  useEffect(() => releaseWake, [releaseWake]);

  const start = useCallback(() => {
    primeAudio();
    setState((s) => {
      const from = s.done ? { index: 0, remaining: phases[0]?.seconds ?? 0 } : { index: s.index, remaining: s.remaining };
      endAt.current = Date.now() + from.remaining * 1000;
      lastBeep.current = -1;
      return { ...from, running: true, done: false };
    });
    requestWake();
  }, [phases, requestWake]);

  const pause = useCallback(() => {
    endAt.current = null;
    releaseWake();
    setState((s) => ({ ...s, running: false }));
  }, [releaseWake]);

  const reset = useCallback(() => {
    endAt.current = null;
    lastBeep.current = -1;
    releaseWake();
    setState({ index: 0, remaining: phases[0]?.seconds ?? 0, running: false, done: false });
  }, [phases, releaseWake]);

  const jump = useCallback(
    (delta: number) => {
      setState((s) => {
        const next = Math.min(phases.length - 1, Math.max(0, s.index + delta));
        const rem = phases[next].seconds;
        lastBeep.current = -1;
        if (s.running) endAt.current = Date.now() + rem * 1000;
        return { ...s, index: next, remaining: rem, done: false };
      });
    },
    [phases],
  );

  return {
    phase: phases[state.index],
    index: state.index,
    count: phases.length,
    remaining: state.remaining,
    running: state.running,
    done: state.done,
    overallElapsed,
    total,
    start,
    pause,
    reset,
    next: () => jump(1),
    prev: () => jump(-1),
  };
}

export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
