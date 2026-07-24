"use client";

import { useEffect, useState } from "react";
import { setVoice } from "@/lib/timer";

const KEY = "pasto-timer-voice";

/** Toggle for spoken timer cues; the preference is shared across both timers. */
export default function VoiceToggle() {
  const [on, setOn] = useState(true);

  // Load the saved pref and push it into the timer engine on mount.
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const val = saved == null ? true : saved === "1";
    setOn(val);
    setVoice(val);
  }, []);

  function toggle() {
    const val = !on;
    setOn(val);
    setVoice(val);
    try {
      localStorage.setItem(KEY, val ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-between rounded-2xl border border-base-300 bg-base-100 px-4 py-3"
      aria-pressed={on}
    >
      <span className="flex items-center gap-2 text-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /> : <path d="m17 9 6 6M23 9l-6 6" />}
        </svg>
        Voice cues
      </span>
      <span className={`text-xs font-semibold ${on ? "text-primary" : "text-base-content/40"}`}>
        {on ? "On" : "Off"}
      </span>
    </button>
  );
}
