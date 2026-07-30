"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useLang, useT } from "@/components/LanguageProvider";
import type { Lang } from "@/lib/i18n";
import MesocycleForm from "@/components/MesocycleForm";
import {
  activeMesocycle,
  activeSession,
  allMesocycles,
  allRoutines,
  completedSessions,
  deleteConditioning,
  deleteMesocycle,
  deleteSession,
  endMesocycle,
  localDate,
  purgeSession,
  recentConditioning,
  restoreSession,
  trashedSessions,
} from "@/lib/db";
import { groupOfMuscle } from "@/lib/exercises";
import { isBlockActive, mesoWeek } from "@/lib/mesocycle";
import { sessionVolume, workingSets } from "@/lib/progression";
import type { ConditioningSession, Mesocycle, Routine, WorkoutSession } from "@/lib/types";

function dayLabel(date: string, lang: Lang = "en"): string {
  return new Date(date + "T00:00:00").toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function TrainingPage() {
  const { lang, t } = useLang();
  const routines = useLiveQuery(() => allRoutines(), []);
  const active = useLiveQuery(() => activeSession(), []);
  const recent = useLiveQuery(() => completedSessions(), []);
  const trashed = useLiveQuery(() => trashedSessions(), []);
  const meso = useLiveQuery(() => activeMesocycle(), []);
  const blocks = useLiveQuery(() => allMesocycles(), []);
  const conditioning = useLiveQuery(() => recentConditioning(), []);
  const [showAllCond, setShowAllCond] = useState(false);
  const [startingBlock, setStartingBlock] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [view, setView] = useState<"strength" | "conditioning">("strength");
  const pastBlocks = (blocks ?? []).filter((b) => b.id !== meso?.id);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("Training")}</h1>
        <div className="flex items-center gap-1">
          <Link href="/progress" className="btn btn-ghost btn-sm">
            {t("Progress")}
          </Link>
          <Link href="/exercises" className="btn btn-ghost btn-sm">
            {t("Exercises")}
          </Link>
        </div>
      </div>

      {/* An in-progress workout stays visible above the sub-tabs. */}
      {active && (
        <Link
          href={`/workout?id=${active.id}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3"
        >
          <span>
            <span className="block text-sm font-semibold text-primary">{t("Workout in progress")}</span>
            <span className="block text-xs text-base-content/60">{t("{name} — tap to resume", { name: active.routineName ?? "" })}</span>
          </span>
          <span className="text-primary">▶</span>
        </Link>
      )}

      {/* Sub-tabs: strength work vs conditioning & core. */}
      <div className="flex rounded-xl border border-base-300 bg-base-100 p-0.5 text-sm">
        {(["strength", "conditioning"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition-colors ${
              view === v ? "bg-primary text-primary-content" : "text-base-content/60 hover:bg-base-200"
            }`}
          >
            {v === "strength" ? t("Strength") : t("Conditioning")}
          </button>
        ))}
      </div>

      {view === "strength" ? (
        <>
          <MesoCard
            meso={meso ?? null}
            onStart={() => setStartingBlock(true)}
            onEnd={() => meso?.id != null && endMesocycle(meso.id)}
          />

          {pastBlocks.length > 0 && (
            <details className="rounded-2xl border border-base-300/60 bg-base-100/50">
              <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-base-content/40">
                {t("Past blocks")} · {pastBlocks.length}
              </summary>
              <ul className="flex flex-col gap-1.5 px-2 pb-2">
                {pastBlocks.map((b) => (
                  <PastBlockRow key={b.id} b={b} />
                ))}
              </ul>
            </details>
          )}

          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
              {t("Your routines")}
            </h2>
            <Link href="/routine" className="btn btn-primary btn-sm rounded-full px-4 shadow-lg shadow-primary/20">
              {t("＋ New")}
            </Link>
          </div>

          {routines === undefined ? (
            <div className="py-10 text-center text-base-content/30">{t("Loading…")}</div>
          ) : routines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-base-300 py-12 text-center">
              <div className="text-sm text-base-content/50">{t("No routines yet.")}</div>
              <Link href="/routine" className="text-sm font-medium text-primary hover:underline">
                {t("Create your first split day →")}
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {routines.map((r) => (
                <RoutineCard key={r.id} r={r} />
              ))}
            </ul>
          )}

          {recent && recent.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
                {t("Past workouts · tap to edit")}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {(showAllRecent ? recent : recent.slice(0, 5)).map((s) => (
                  <RecentRow key={s.id} s={s} />
                ))}
              </ul>
              {recent.length > 5 && (
                <button
                  onClick={() => setShowAllRecent((v) => !v)}
                  className="self-center py-1 text-xs font-medium text-primary hover:underline"
                >
                  {showAllRecent ? t("Show less") : t("Show all {n}", { n: recent.length })}
                </button>
              )}
            </div>
          )}

          {trashed && trashed.length > 0 && (
            <details className="mt-2 rounded-2xl border border-base-300/60 bg-base-100/50">
              <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-base-content/40">
                {t("🗑 Recently deleted")} · {trashed.length}
              </summary>
              <ul className="flex flex-col gap-1.5 px-2 pb-2">
                {trashed.map((s) => (
                  <TrashRow key={s.id} s={s} />
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ConditioningCard
              href="/hiit"
              title="Norwegian 4×4"
              desc="HIIT interval timer"
              accent="text-primary"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M13 2 4.5 13.5H12l-1 8L19.5 10H12l1-8Z" strokeLinejoin="round" />
                </svg>
              }
            />
            <ConditioningCard
              href="/core"
              title="McGill Big Three"
              desc="Spine-safe core timer"
              accent="text-sky-400"
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6.5 3v6M6.5 15v6M17.5 3v6M17.5 15v6M4.5 9h4M15.5 9h4M4.5 15h4M15.5 15h4M8.5 12h7" strokeLinecap="round" />
                </svg>
              }
            />
          </div>

          {conditioning && conditioning.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
                {t("Recent conditioning")}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {(showAllCond ? conditioning : conditioning.slice(0, 4)).map((c) => (
                  <ConditioningRow key={c.id} c={c} />
                ))}
              </ul>
              {conditioning.length > 4 && (
                <button
                  onClick={() => setShowAllCond((v) => !v)}
                  className="self-center py-1 text-xs font-medium text-primary hover:underline"
                >
                  {showAllCond ? t("Show less") : t("Show all {n}", { n: conditioning.length })}
                </button>
              )}
            </div>
          ) : (
            <p className="px-1 text-xs text-base-content/40">
              {t("Finish a Norwegian 4×4 or McGill Big Three session and it shows up here.")}
            </p>
          )}
        </>
      )}

      {startingBlock && <MesocycleForm onClose={() => setStartingBlock(false)} />}
    </div>
  );
}

function ConditioningRow({ c }: { c: ConditioningSession }) {
  const { lang, t } = useLang();
  const mins = Math.round(c.durationSec / 60);
  const accent = c.kind === "hiit" ? "text-primary" : "text-sky-400";
  return (
    <li className="flex items-center gap-2.5 rounded-2xl border border-base-300/60 bg-base-100 px-4 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-base-200 ${accent}`}>
        {c.kind === "hiit" ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
            <path d="M13 2 4.5 13.5H12l-1 8L19.5 10H12l1-8Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6.5 3v6M6.5 15v6M17.5 3v6M17.5 15v6M4.5 9h4M15.5 9h4M4.5 15h4M15.5 15h4M8.5 12h7" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {c.name}
          {c.partial && <span className="ml-1.5 text-[10px] font-normal text-amber-500">{t("partial")}</span>}
        </span>
        <span className="block truncate text-xs text-base-content/50">
          {dayLabel(c.date, lang)} · {c.summary}
        </span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-base-content/40">{t("{n} min", { n: mins })}</span>
      <button
        onClick={() => {
          if (c.id != null && confirm(t("Delete this session?"))) deleteConditioning(c.id);
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base-content/30 hover:bg-base-300/60 hover:text-error"
        aria-label={t("Delete {name}", { name: c.name })}
      >
        ✕
      </button>
    </li>
  );
}

function ConditioningCard({
  href,
  title,
  desc,
  icon,
  accent,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
}) {
  const t = useT();
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl border border-base-300/60 bg-base-100 p-3.5 transition-colors hover:border-primary/40"
    >
      <span className={`grid h-9 w-9 place-items-center rounded-full bg-base-200 ${accent}`}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold leading-tight">{t(title)}</span>
        <span className="block text-xs text-base-content/50">{t(desc)}</span>
      </span>
    </Link>
  );
}

function MesoCard({
  meso,
  onStart,
  onEnd,
}: {
  meso: Mesocycle | null;
  onStart: () => void;
  onEnd: () => void;
}) {
  const t = useT();
  const today = localDate();
  const active = meso ? isBlockActive(meso, today) : false;
  if (meso && active) {
    const w = mesoWeek(meso, today);
    const deloading = w.phase === "deload";
    return (
      <div
        className={`rounded-2xl border p-3.5 ${
          deloading ? "border-amber-400/40 bg-amber-400/5" : "border-secondary/40 bg-secondary/5"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/40">
              {t("Training block")}
            </div>
            <div className="truncate font-semibold">{meso.name}</div>
          </div>
          <button
            onClick={() => {
              if (confirm(t("End this training block?"))) onEnd();
            }}
            className="shrink-0 text-xs text-base-content/40 hover:text-error"
          >
            {t("End")}
          </button>
        </div>
        <div className="mt-2.5 flex gap-1">
          {Array.from({ length: meso.weeks }).map((_, i) => {
            const isDeloadDot = meso.deload && i === meso.weeks - 1;
            const current = i === w.index;
            const filled = i <= w.index;
            return (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  current
                    ? isDeloadDot
                      ? "bg-amber-400"
                      : "bg-secondary"
                    : filled
                      ? "bg-secondary/40"
                      : "bg-base-300"
                }`}
              />
            );
          })}
        </div>
        <div className="mt-1.5 text-xs text-base-content/60">
          <span className={`font-semibold ${deloading ? "text-amber-500" : "text-secondary"}`}>
            {deloading
              ? t("Deload · week {n} of {total}", { n: w.index + 1, total: w.total })
              : t("Week {n} of {total}", { n: w.index + 1, total: w.total })}
          </span>{" "}
          · {deloading ? t("recover — volume halved, load eased") : t("volume ramping toward your peak week")}
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={onStart}
      className="flex items-center gap-3 rounded-2xl border border-dashed border-base-300 px-4 py-3 text-left transition-colors hover:border-secondary/50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary/15 text-secondary">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{t("Start a training block")}</span>
        <span className="block text-xs text-base-content/50">
          {t("Auto-ramp weekly volume, then deload — RP-style")}
        </span>
      </span>
    </button>
  );
}

function PastBlockRow({ b }: { b: Mesocycle }) {
  const { lang, t } = useLang();
  const end = new Date(b.startDate + "T00:00:00");
  end.setDate(end.getDate() + b.weeks * 7 - 1);
  const range = `${dayLabel(b.startDate, lang)} – ${end.toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "short" })}`;
  return (
    <li className="flex items-center gap-2 rounded-xl bg-base-200/40 px-3 py-2">
      <Link href="/progress" className="min-w-0 flex-1">
        <span className="block truncate text-sm">{b.name ?? t("Block")}</span>
        <span className="block text-xs text-base-content/40">
          {range} · {t("{n} weeks", { n: b.weeks })}{b.endedAt ? ` · ${t("ended early")}` : ""}
        </span>
      </Link>
      <Link href="/progress" className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25">
        {t("View")}
      </Link>
      <button
        onClick={() => {
          if (b.id != null && confirm(t("Delete this block? Your logged workouts are kept — only the plan is removed.")))
            deleteMesocycle(b.id);
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base-content/30 hover:bg-base-300/60 hover:text-error"
        aria-label={t("Delete block")}
      >
        ✕
      </button>
    </li>
  );
}

function TrashRow({ s }: { s: WorkoutSession }) {
  const { lang, t } = useLang();
  const sets = s.exercises.reduce((n, e) => n + workingSets(e.sets).length, 0);
  return (
    <li className="flex items-center gap-2 rounded-xl bg-base-200/40 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{s.routineName ?? t("Workout")}</span>
        <span className="block text-xs text-base-content/40">
          {dayLabel(s.date, lang)} · {t("{n} sets", { n: sets })}
        </span>
      </span>
      <button
        onClick={() => s.id != null && restoreSession(s.id)}
        className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25"
      >
        {t("Restore")}
      </button>
      <button
        onClick={() => {
          if (s.id != null && confirm(t("Permanently delete this workout? This cannot be undone."))) purgeSession(s.id);
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base-content/30 hover:bg-base-300/60 hover:text-error"
        aria-label={t("Delete permanently")}
      >
        ✕
      </button>
    </li>
  );
}

function RoutineCard({ r }: { r: Routine }) {
  const t = useT();
  const groups = [...new Set(r.exercises.map((e) => groupOfMuscle(e.primaryMuscles[0])))];
  return (
    <li className="flex items-center gap-1 rounded-2xl border border-base-300/60 bg-base-100 pr-2 transition-colors hover:border-primary/40">
      <Link href={`/workout?routine=${r.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3.5 pl-4">
        <span className="min-w-0">
          <span className="block truncate font-medium">{r.name}</span>
          <span className="mt-0.5 block truncate text-xs text-base-content/50">
            {t(r.exercises.length === 1 ? "{n} exercise" : "{n} exercises", { n: r.exercises.length })}
            {groups.length ? ` · ${groups.join(", ")}` : ""}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          {t("Start")}
        </span>
      </Link>
      <Link
        href={`/routine?id=${r.id}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base-content/40 hover:bg-base-300/60 hover:text-base-content"
        aria-label={t("Edit {name}", { name: r.name })}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 20h9" strokeLinecap="round" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </li>
  );
}

function RecentRow({ s }: { s: WorkoutSession }) {
  const { lang, t } = useLang();
  const sets = s.exercises.reduce((n, e) => n + workingSets(e.sets).length, 0);
  const vol = Math.round(sessionVolume(s));
  return (
    <li className="flex items-center gap-1 rounded-2xl border border-base-300/60 bg-base-100 pr-2 transition-colors hover:border-primary/40">
      <Link
        href={`/workout?id=${s.id}`}
        className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{s.routineName ?? t("Workout")}</span>
          <span className="block text-xs text-base-content/50">{dayLabel(s.date, lang)}</span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums text-base-content/50">
          {t("{n} sets", { n: sets })}
          <span className="block text-base-content/35">{t("{n} kg vol", { n: vol.toLocaleString() })}</span>
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-base-content/25" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <button
        onClick={() => s.id != null && deleteSession(s.id)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base-content/30 hover:bg-base-300/60 hover:text-error"
        aria-label={t("Delete {name} from {date}", { name: s.routineName ?? t("workout"), date: dayLabel(s.date, lang) })}
      >
        ✕
      </button>
    </li>
  );
}
