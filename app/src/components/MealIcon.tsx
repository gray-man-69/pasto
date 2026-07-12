import type { MealSlot } from "@/lib/types";

// Line icons for the meal groups, matching the nav's thin-stroke style (no
// emoji). Breakfast→sunrise, Lunch→sun, Dinner→moon, Snack→apple, Other→dots.
const p = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-5 w-5",
};

export default function MealIcon({ slot }: { slot: MealSlot | null }) {
  switch (slot) {
    case "breakfast": // sunrise
      return (
        <svg {...p}>
          <path d="M4 18h16" />
          <path d="M7.5 18a4.5 4.5 0 0 1 9 0" />
          <path d="M12 3.5v2.5M4.8 8.3l1.5 1.5M19.2 8.3l-1.5 1.5M2 14h1.5M20.5 14H22" />
        </svg>
      );
    case "lunch": // sun
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.2v2.3M12 19.5v2.3M2.2 12h2.3M19.5 12h2.3M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6" />
        </svg>
      );
    case "dinner": // crescent moon
      return (
        <svg {...p}>
          <path d="M20 13.4A8 8 0 1 1 10.6 4a6.3 6.3 0 0 0 9.4 9.4Z" />
        </svg>
      );
    case "snack": // apple
      return (
        <svg {...p}>
          <path d="M12 8.9C10.7 7 8.3 6.6 6.7 7.8 4.9 9.2 4.7 12 6 14.7c1 2.1 2.8 4.3 4.6 4.3.8 0 1-.5 1.4-.5s.6.5 1.4.5c1.8 0 3.6-2.2 4.6-4.3 1.3-2.7 1.1-5.5-.7-6.9-1.6-1.2-4-.8-5.3 1.1Z" />
          <path d="M12 8.9c-.2-1.9.9-3.4 2.9-3.9" />
        </svg>
      );
    default: // "Other" — three dots
      return (
        <svg {...p} fill="currentColor" stroke="none">
          <circle cx="6" cy="12" r="1.3" />
          <circle cx="12" cy="12" r="1.3" />
          <circle cx="18" cy="12" r="1.3" />
        </svg>
      );
  }
}
