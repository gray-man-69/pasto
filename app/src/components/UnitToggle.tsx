"use client";

import type { Unit } from "@/lib/types";

// A tiny g / ml switch for logging liquids by volume. Purely a label — the
// macros are per-100-unit either way, so the totals math is unchanged.
export default function UnitToggle({
  value,
  onChange,
}: {
  value: Unit;
  onChange: (u: Unit) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-base-300 text-xs">
      {(["g", "ml"] as Unit[]).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`px-2.5 py-1 font-medium transition-colors ${
            value === u
              ? "bg-primary text-primary-content"
              : "text-base-content/50 hover:bg-base-200"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
