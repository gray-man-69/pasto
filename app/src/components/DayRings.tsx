// Apple-Health-style concentric progress rings, outermost first. Every track is
// always drawn, so a day with no log reads as a full set of empty rings rather
// than a blank hole. Colour comes from text-* classes, like Ring.
export default function DayRings({
  rings,
  size = "3rem",
  stroke = 8,
  gap = 1.5,
}: {
  rings: { value: number; max: number; colorClass: string }[];
  size?: string;
  stroke?: number; // per-ring stroke width in the 0–100 viewBox
  gap?: number; // space between rings, same units
}) {
  return (
    <div style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        {rings.map((ring, i) => {
          const r = 50 - stroke / 2 - i * (stroke + gap);
          if (r <= stroke / 2) return null; // no room left — skip innermost rings
          const circ = 2 * Math.PI * r;
          const pct = ring.max > 0 ? Math.min(1, Math.max(0, ring.value / ring.max)) : 0;
          return (
            <g key={i} className={ring.colorClass}>
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
            </g>
          );
        })}
      </svg>
    </div>
  );
}
