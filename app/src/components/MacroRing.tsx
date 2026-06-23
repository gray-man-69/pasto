"use client";

// A labelled progress bar for one macro: consumed vs goal, with a remaining hint.
export default function MacroBar({
  label,
  consumed,
  goal,
  unit,
  color,
}: {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  color: "primary" | "secondary" | "accent" | "info";
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
  const over = goal > 0 && consumed > goal;
  const remaining = Math.max(0, Math.round((goal - consumed) * 10) / 10);

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-base-content/70">
          {Math.round(consumed * 10) / 10}
          <span className="text-base-content/40"> / {goal} {unit}</span>
        </span>
      </div>
      <progress
        className={`progress w-full ${over ? "progress-error" : `progress-${color}`}`}
        value={pct}
        max={100}
      />
      <div className="mt-0.5 text-right text-xs text-base-content/50">
        {over ? `${Math.round((consumed - goal) * 10) / 10} ${unit} over` : `${remaining} ${unit} left`}
      </div>
    </div>
  );
}
