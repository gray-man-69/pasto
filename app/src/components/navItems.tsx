import type { ReactNode } from "react";

// Shared navigation model, rendered as a bottom tab bar on phones (BottomNav)
// and a left sidebar on desktop (SideNav).
export type NavItem = { href: string; label: string; icon: ReactNode };

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-6 w-6",
};

function TodayIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function WeekIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function GoalsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: <TodayIcon /> },
  { href: "/week", label: "Week", icon: <WeekIcon /> },
  { href: "/add", label: "Add", icon: <AddIcon /> },
  { href: "/goals", label: "Goals", icon: <GoalsIcon /> },
];

/** True when `href` is the active route for `pathname`. */
export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
