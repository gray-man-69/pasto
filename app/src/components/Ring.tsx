import type { ReactNode } from "react";

// A crisp SVG progress ring. The track is always drawn (so an empty ring reads
// as "0 of goal", never a stray dot); the coloured arc grows clockwise from 12
// o'clock. Colour comes from a text-* class so the chrome stays neutral.
export default function Ring({
  value,
  max,
  size = "4rem",
  stroke = 8,
  colorClass = "text-primary",
  children,
}: {
  value: number;
  max: number;
  size?: string;
  stroke?: number; // stroke width in the 0–100 viewBox (≈ % of diameter)
  colorClass?: string;
  children?: ReactNode;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = 50 - stroke / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className={`h-full w-full -rotate-90 ${colorClass}`}>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "var(--color-base-300)" }}
        />
        {pct > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ * pct} ${circ}`}
            className="transition-[stroke-dasharray] duration-500 ease-out"
          />
        )}
      </svg>
      {children != null && (
        <div className="absolute inset-0 grid place-items-center">{children}</div>
      )}
    </div>
  );
}
