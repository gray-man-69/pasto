import type { CSSProperties, ReactNode } from "react";

// Thin wrapper over DaisyUI's radial-progress. Colour comes from a text-* class
// so the minimal-mono chrome stays neutral while the rings carry the colour.
export default function Ring({
  value,
  max,
  size = "5rem",
  thickness = "5px",
  colorClass = "text-primary",
  trackClass = "text-base-300",
  children,
}: {
  value: number;
  max: number;
  size?: string;
  thickness?: string;
  colorClass?: string;
  trackClass?: string;
  children?: ReactNode;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={`radial-progress ${colorClass} ${trackClass}`}
      style={{ "--value": pct, "--size": size, "--thickness": thickness } as CSSProperties}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
    >
      <span className="text-base-content">{children}</span>
    </div>
  );
}
