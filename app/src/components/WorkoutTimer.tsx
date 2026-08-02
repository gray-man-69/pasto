"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import type { WorkoutSession } from "@/lib/types";

// Resolve the timer's base seconds + running anchor, tolerating older sessions
// that predate the stopwatch (an in-progress one just runs from startedAt).
function derive(session: WorkoutSession, finished: boolean): { base: number; runningSince: number | null } {
  if (finished) {
    const sec =
      session.elapsedSec ??
      (session.endedAt && session.startedAt ? Math.round((session.endedAt - session.startedAt) / 1000) : 0);
    return { base: sec, runningSince: null };
  }
  if (session.timerRunningSince != null || session.elapsedSec != null) {
    return { base: session.elapsedSec ?? 0, runningSince: session.timerRunningSince ?? null };
  }
  return { base: 0, runningSince: session.startedAt ?? null };
}

/** Live elapsed seconds for a session (used by the page when finishing). */
export function currentElapsedSec(session: WorkoutSession, finished = false, now = Date.now()): number {
  const { base, runningSince } = derive(session, finished);
  return Math.round(base + (runningSince != null ? (now - runningSince) / 1000 : 0));
}

function fmt(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

const icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-3.5 w-3.5",
};

export default function WorkoutTimer({
  session,
  finished,
  onChange,
}: {
  session: WorkoutSession;
  finished: boolean;
  onChange: (patch: Partial<WorkoutSession>) => void;
}) {
  const t = useT();
  const { base, runningSince } = derive(session, finished);
  const running = runningSince != null && !finished;
  const [, tick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");

  // Re-render each second while the clock runs.
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const elapsed = base + (running && runningSince != null ? (Date.now() - runningSince) / 1000 : 0);

  function pause() {
    onChange({ elapsedSec: currentElapsedSec(session, finished), timerRunningSince: undefined });
  }
  function resume() {
    onChange({ elapsedSec: base, timerRunningSince: Date.now() });
  }
  function openEdit() {
    const total = Math.round(elapsed);
    setHrs(String(Math.floor(total / 3600)));
    setMins(String(Math.round((total % 3600) / 60)));
    setEditing(true);
  }
  function saveEdit() {
    const h = parseFloat(hrs.replace(",", ".")) || 0;
    const m = parseFloat(mins.replace(",", ".")) || 0;
    if (h >= 0 && m >= 0) {
      const sec = Math.round(h * 3600 + m * 60);
      onChange({ elapsedSec: sec, timerRunningSince: running ? Date.now() : undefined });
    }
    setEditing(false);
  }

  if (editing) {
    const key = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") saveEdit();
      if (e.key === "Escape") setEditing(false);
    };
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={hrs}
          autoFocus
          onChange={(e) => setHrs(e.target.value)}
          onKeyDown={key}
          className="input input-bordered input-xs w-11 tabular-nums"
        />
        <span className="text-[11px]">{t("h")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={mins}
          onChange={(e) => setMins(e.target.value)}
          onKeyDown={key}
          className="input input-bordered input-xs w-11 tabular-nums"
        />
        <span className="text-[11px]">{t("min")}</span>
        <button onClick={saveEdit} aria-label={t("Set duration")} className="text-success hover:opacity-80">
          <svg {...icon} className="h-4 w-4">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </button>
        <button onClick={() => setEditing(false)} aria-label={t("Cancel")} className="text-base-content/40 hover:text-base-content">
          <svg {...icon} className="h-4 w-4">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-base-200/60 py-0.5 pl-2 pr-1">
      <button
        onClick={openEdit}
        aria-label={t("Edit workout time")}
        className="inline-flex items-center gap-1 tabular-nums font-medium text-base-content/70 hover:text-base-content"
      >
        <svg {...icon}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        {fmt(elapsed)}
      </button>
      {!finished && (
        <button
          onClick={running ? pause : resume}
          aria-label={running ? t("Pause") : t("Resume")}
          className={`grid h-5 w-5 place-items-center rounded-full ${
            running ? "text-base-content/60 hover:bg-base-300/60" : "bg-primary/20 text-primary hover:bg-primary/30"
          }`}
        >
          {running ? (
            <svg {...icon} fill="currentColor" stroke="none" className="h-3 w-3">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg {...icon} fill="currentColor" stroke="none" className="h-3 w-3">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}
    </span>
  );
}
