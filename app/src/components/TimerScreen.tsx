"use client";

import Ring from "@/components/Ring";
import { fmtClock, phaseColor, type Phase } from "@/lib/timer";

// The shared big-clock timer face used by the HIIT and McGill pages.
export default function TimerScreen({
  title,
  phases,
  timer,
  onExit,
}: {
  title: string;
  phases: Phase[];
  timer: ReturnType<typeof import("@/lib/timer").useTimer>;
  onExit: () => void;
}) {
  const { phase, index, count, remaining, running, done, overallElapsed, total, start, pause, reset, next, prev } = timer;
  const color = done ? "text-primary" : phaseColor(phase?.kind ?? "prep");
  const upNext = phases[index + 1];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-200">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={onExit} className="btn btn-ghost btn-sm">
          ‹ Exit
        </button>
        <span className="text-sm font-semibold">{title}</span>
        <button onClick={reset} className="btn btn-ghost btn-sm text-base-content/50">
          Reset
        </button>
      </div>

      {/* Overall progress */}
      <div className="mt-2 h-1 w-full bg-base-300">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${total ? (overallElapsed / total) * 100 : 0}%` }}
        />
      </div>

      {/* The face */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-6xl">✓</span>
            <span className="text-2xl font-bold">Done</span>
            <span className="text-sm text-base-content/50">
              {fmtClock(total)} total · nice work
            </span>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className={`text-sm font-semibold uppercase tracking-[0.2em] ${color}`}>
                {phase?.label}
              </span>
              <span className="text-xs text-base-content/40">
                Phase {index + 1} of {count}
              </span>
            </div>

            <Ring value={remaining} max={phase?.seconds || 1} size="16rem" stroke={5} colorClass={color}>
              <span className="flex flex-col items-center">
                <span className="text-6xl font-bold tabular-nums leading-none">{fmtClock(remaining)}</span>
              </span>
            </Ring>

            {phase?.note && (
              <p className="max-w-xs text-center text-sm text-base-content/50">{phase.note}</p>
            )}
            <span className="h-4 text-xs text-base-content/35">
              {upNext ? `Up next · ${upNext.label}` : "Last one — finish strong"}
            </span>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          onClick={prev}
          disabled={index === 0 && !done}
          className="btn btn-circle btn-ghost disabled:opacity-30"
          aria-label="Previous phase"
        >
          <SkipIcon dir="prev" />
        </button>
        {done ? (
          <button onClick={start} className="btn btn-primary btn-lg rounded-full px-10">
            ↻ Again
          </button>
        ) : running ? (
          <button onClick={pause} className="btn btn-primary btn-lg rounded-full px-10">
            Pause
          </button>
        ) : (
          <button onClick={start} className="btn btn-primary btn-lg rounded-full px-10">
            {overallElapsed > 0 ? "Resume" : "Start"}
          </button>
        )}
        <button
          onClick={next}
          disabled={index >= count - 1}
          className="btn btn-circle btn-ghost disabled:opacity-30"
          aria-label="Skip phase"
        >
          <SkipIcon dir="next" />
        </button>
      </div>
    </div>
  );
}

function SkipIcon({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${dir === "prev" ? "" : "rotate-180"}`}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <path d="M18 6.5v11L11 12l7-5.5Z" />
      <path d="M11 6.5v11L4 12l7-5.5Z" />
    </svg>
  );
}
