"use client";

import { useEffect, useRef } from "react";
import { addConditioning, localDate } from "./db";
import type { Phase, useTimer } from "./timer";
import type { ConditioningSession } from "./types";

/** How many of the "work" phases (bouts / holds) have been completed so far. */
export function workStats(phases: Phase[], index: number, done: boolean, workKind: Phase["kind"]) {
  const total = phases.filter((p) => p.kind === workKind).length;
  const doneCount = done ? total : phases.slice(0, index).filter((p) => p.kind === workKind).length;
  return { total, done: doneCount };
}

/** Logs a ConditioningSession when the protocol completes, and returns a
 * callback to log a partial session if the user exits after real work. One
 * session per run (guarded), reset when the timer is reset back to the start. */
export function useConditioningLogger(opts: {
  timer: ReturnType<typeof useTimer>;
  phases: Phase[];
  kind: ConditioningSession["kind"];
  name: string;
  workKind: Phase["kind"];
  makeSummary: (done: number, total: number) => string;
}): () => void {
  const { timer, phases, kind, name, workKind, makeSummary } = opts;
  const logged = useRef(false);

  // New run started → allow logging again.
  useEffect(() => {
    if (!timer.done && timer.overallElapsed === 0) logged.current = false;
  }, [timer.done, timer.overallElapsed]);

  // Completed the whole protocol.
  useEffect(() => {
    if (!timer.done || logged.current) return;
    logged.current = true;
    const { total, done } = workStats(phases, timer.index, true, workKind);
    void addConditioning({
      date: localDate(),
      kind,
      name,
      durationSec: timer.overallElapsed,
      workDone: done,
      workTotal: total,
      summary: makeSummary(done, total),
      partial: false,
      completedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.done]);

  // Called from the page's exit handler: log what was actually done.
  return () => {
    if (logged.current || timer.done) return;
    const { total, done } = workStats(phases, timer.index, false, workKind);
    if (done < 1) return; // no real work — don't clutter history
    logged.current = true;
    void addConditioning({
      date: localDate(),
      kind,
      name,
      durationSec: timer.overallElapsed,
      workDone: done,
      workTotal: total,
      summary: `${makeSummary(done, total)} · stopped early`,
      partial: true,
      completedAt: Date.now(),
    });
  };
}
