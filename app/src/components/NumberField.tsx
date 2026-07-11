"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max"
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

// A number input that behaves like a normal text box: you can clear it to empty
// while typing (no forced "0"), type freely with no stuck leading zero, and it
// only settles to a clean number when you leave the field. While editing it holds
// the raw draft string; when idle it mirrors the numeric value.
export default function NumberField({
  value,
  onChange,
  min,
  max,
  inputMode = "decimal",
  ...rest
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // While focused, show what's being typed (the draft); otherwise always mirror
  // the numeric value, so external changes (e.g. picking another food) show through.
  const shown = focused && draft != null ? draft : String(value);

  const clamp = (n: number) => {
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return n;
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={inputMode}
      value={shown}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return; // ignore non-numeric keystrokes
        setDraft(raw);
        // Partial input (empty, lone "-" or ".") — keep the field as typed, don't push a value yet.
        if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(min != null ? Math.max(min, n) : n);
      }}
      onBlur={(e) => {
        const n = Number(draft ?? shown);
        onChange(draft === "" || Number.isNaN(n) ? clamp(min ?? 0) : clamp(n));
        setDraft(null);
        setFocused(false);
        rest.onBlur?.(e);
      }}
    />
  );
}
