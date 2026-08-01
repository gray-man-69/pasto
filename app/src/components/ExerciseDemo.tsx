"use client";

import { useLang } from "@/components/LanguageProvider";
import { getExerciseMedia } from "@/lib/exerciseMedia";

// Shows an exercise's execution help inside the detail modal, when it exists:
// a one-line form cue plus a link out to a video demonstration on YouTube.
// Styled to match the app (rounded card, lime accent) — no embedded media, so
// it stays on-brand and light. Renders nothing when the exercise has no entry.
export default function ExerciseDemo({ id }: { id: string }) {
  const { lang, t } = useLang();
  const media = getExerciseMedia(id);
  if (!media) return null;

  return (
    <div className="mt-1 flex flex-col gap-2.5">
      <p className="px-0.5 text-xs leading-relaxed text-base-content/70">{media.cue[lang]}</p>
      {media.youtube && (
        <a
          href={media.youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 px-4 py-3 transition-colors hover:border-primary/50"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t("Watch demo")}</span>
            <span className="block text-xs text-base-content/50">{t("Opens a video on YouTube")}</span>
          </span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-base-content/30" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
    </div>
  );
}
