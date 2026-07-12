"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max"
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

// A number input that behaves like a normal text box: clear it to empty while
// typing (no forced "0"), type freely with no stuck leading zero, and it settles
// on blur. Accepts BOTH "," and "." as the decimal separator (Italian keyboards
// type a comma) and shows the value using the user's locale separator.
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
  const [sep, setSep] = useState("."); // locale decimal separator; resolved after mount (SSR-safe)

  useEffect(() => {
    try {
      if ((1.1).toLocaleString().includes(",")) setSep(",");
    } catch {
      /* keep "." */
    }
  }, []);

  const shown = focused && draft != null ? draft : String(value).replace(".", sep);
  const parse = (s: string) => Number(s.replace(",", "."));
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
        if (raw !== "" && !/^-?\d*[.,]?\d*$/.test(raw)) return; // digits + one decimal (. or ,)
        setDraft(raw);
        if (/^-?[.,]?$/.test(raw)) return; // partial ("", "-", ".", ",") — don't push a value yet
        const n = parse(raw);
        if (!Number.isNaN(n)) onChange(min != null ? Math.max(min, n) : n);
      }}
      onBlur={(e) => {
        const n = parse(draft ?? shown);
        onChange(draft === "" || Number.isNaN(n) ? clamp(min ?? 0) : clamp(n));
        setDraft(null);
        setFocused(false);
        rest.onBlur?.(e);
      }}
    />
  );
}
