"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLang } from "@/components/LanguageProvider";
import { useAuth } from "@/components/SyncProvider";
import type { TParams } from "@/lib/i18n";
import WeekSummary from "@/components/WeekSummary";
import { useHealthRange } from "@/lib/health";
import { addDays, dailyTotalsBetween, getGoals, localDate, weekStart } from "@/lib/db";

function fmtRange(from: string, to: string, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const s = new Date(from + "T00:00:00").toLocaleDateString(locale, opts);
  const e = new Date(to + "T00:00:00").toLocaleDateString(locale, opts);
  return from === to ? s : `${s} – ${e}`;
}

function relWeek(from: string, thisWeek: string, t: (k: string, p?: TParams) => string): string {
  const diff = Math.round(
    (new Date(from + "T00:00:00").getTime() - new Date(thisWeek + "T00:00:00").getTime()) /
      (7 * 86_400_000),
  );
  if (diff === 0) return t("This week");
  if (diff === -1) return t("Last week");
  if (diff === 1) return t("Next week");
  return diff < 0 ? t("{n} weeks ago", { n: -diff }) : t("In {n} weeks", { n: diff });
}

function daysArr(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const PRESETS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "3 Months" },
] as const;

export default function WeekPage() {
  const { lang, t } = useLang();
  const locale = lang === "it" ? "it-IT" : "en-GB";
  const today = localDate();
  const curWeek = weekStart(today);
  const [from, setFrom] = useState(() => curWeek);
  const [to, setTo] = useState(() => addDays(curWeek, 6));

  const goals = useLiveQuery(() => getGoals(), []);
  const dayTotals = useLiveQuery(() => dailyTotalsBetween(from, to), [from, to]);
  const days = useMemo(() => daysArr(from, to), [from, to]);
  const len = days.length;

  // Apple Health rows (steps / burned) join the same scoreboard + sparklines;
  // rows with no data in the range hide themselves.
  const { user } = useAuth();
  const healthDays = useHealthRange(user?.uid, from, to);
  const extras = useMemo(() => {
    const steps = new Map<string, number>();
    const burned = new Map<string, number>();
    for (const [date, h] of healthDays) {
      if (h.steps != null) steps.set(date, h.steps);
      if ((h.activeKcal ?? 0) > 0) burned.set(date, Math.round(h.activeKcal!));
    }
    return [
      { key: "steps", label: "Steps", cls: "text-base-content/70", dot: "bg-base-content/40", unit: "", goal: 10000, values: steps },
      { key: "burned", label: "Burned", cls: "text-amber-400", dot: "bg-amber-400", unit: " kcal", values: burned },
    ];
  }, [healthDays]);

  // Which preset (if any) the current window exactly matches — for chip state.
  const active =
    from === curWeek && to === addDays(curWeek, 6)
      ? "week"
      : from === addDays(today, -29) && to === today
        ? "month"
        : from === addDays(today, -89) && to === today
          ? "quarter"
          : "custom";
  const isThisWeek = active === "week";

  function applyPreset(id: (typeof PRESETS)[number]["id"]) {
    if (id === "week") {
      setFrom(curWeek);
      setTo(addDays(curWeek, 6));
    } else if (id === "month") {
      setFrom(addDays(today, -29));
      setTo(today);
    } else {
      setFrom(addDays(today, -89));
      setTo(today);
    }
  }
  function shift(dir: -1 | 1) {
    setFrom(addDays(from, dir * len));
    setTo(addDays(to, dir * len));
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => shift(-1)} className="btn btn-ghost btn-sm btn-circle text-lg" aria-label={t("Previous range")}>
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold">{fmtRange(from, to, locale)}</h1>
          <div className="text-xs text-base-content/50">
            {isThisWeek ? relWeek(from, curWeek, t) : t("{n} days", { n: len })}
          </div>
        </div>
        <button onClick={() => shift(1)} className="btn btn-ghost btn-sm btn-circle text-lg" aria-label={t("Next range")}>
          ›
        </button>
      </div>

      {/* Presets */}
      <div className="flex justify-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active === p.id
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content/60 hover:bg-base-300"
            }`}
          >
            {t(p.label)}
          </button>
        ))}
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            active === "custom" ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/40"
          }`}
        >
          {t("Custom")}
        </span>
      </div>

      {/* Custom date range */}
      <div className="flex items-center justify-center gap-2 text-xs text-base-content/60">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => e.target.value && setFrom(e.target.value)}
          className="input input-bordered input-sm"
        />
        <span>→</span>
        <input
          type="date"
          value={to}
          min={from}
          max={today}
          onChange={(e) => e.target.value && setTo(e.target.value)}
          className="input input-bordered input-sm"
        />
      </div>

      {!isThisWeek && (
        <button onClick={() => applyPreset("week")} className="self-center text-xs text-primary hover:underline">
          {t("Back to this week")}
        </button>
      )}

      {goals && dayTotals ? (
        <WeekSummary days={days} dayTotals={dayTotals} goals={goals} today={today} extras={extras} />
      ) : (
        <div className="py-10 text-center text-base-content/40">{t("Loading…")}</div>
      )}
    </div>
  );
}
