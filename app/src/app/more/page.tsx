"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// A simple hub for everything that isn't a primary daily destination: goals,
// settings, saved meals, history and the day planner. Keeps the bottom bar to
// five tabs while leaving room to grow.

type Entry = { href: string; label: string; desc: string; icon: ReactNode; disabled?: boolean };

const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-5 w-5",
};

const ENTRIES: Entry[] = [
  {
    href: "/body",
    label: "Body",
    desc: "Weight trend, progress photos & intake",
    icon: (
      <svg {...svg}>
        <path d="M3 17l4.5-6 3.5 4 4-7 6 9" />
        <circle cx="6.5" cy="6.5" r="2" />
      </svg>
    ),
  },
  {
    href: "/goals",
    label: "Goals",
    desc: "Daily calories, macros & water — and the TDEE calculator",
    icon: (
      <svg {...svg}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/meals",
    label: "Meals",
    desc: "Your saved meals to log in one tap",
    icon: (
      <svg {...svg}>
        <path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18" />
        <path d="M17 3c-1.5 1-2.5 3-2.5 5.5S15.5 13 17 13v8" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Day planner",
    desc: "Coming soon",
    disabled: true,
    icon: (
      <svg {...svg}>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    desc: "Browse past days",
    icon: (
      <svg {...svg}>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    desc: "Sync across devices, water reminders, backup & restore",
    icon: (
      <svg {...svg}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.22.66.22 1v.09a2 2 0 0 1 0 4H21c-.34 0-.69.08-1 .22" />
      </svg>
    ),
  },
];

export default function MorePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">More</h1>
      <ul className="flex flex-col gap-2">
        {ENTRIES.map((e) =>
          e.disabled ? (
            <li key={e.href}>
              <div
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-4 rounded-2xl border border-base-300/50 bg-base-100/50 px-4 py-3.5 opacity-50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-base-content/10 text-base-content/40">
                  {e.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-base-content/50">{e.label}</span>
                  <span className="block truncate text-xs text-base-content/40">{e.desc}</span>
                </span>
              </div>
            </li>
          ) : (
            <li key={e.href}>
              <Link
                href={e.href}
                className="flex items-center gap-4 rounded-2xl border border-base-300 bg-base-100 px-4 py-3.5 transition-colors hover:border-primary/50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  {e.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{e.label}</span>
                  <span className="block truncate text-xs text-base-content/50">{e.desc}</span>
                </span>
                <span className="text-base-content/30">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
