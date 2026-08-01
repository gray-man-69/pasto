"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { ExerciseArt, artFrames } from "@/components/exerciseArt";
import { getExerciseMedia } from "@/lib/exerciseMedia";

// Shows a demo for an exercise inside the detail modal, when media exists:
// the start/end stills alternate to suggest the movement, with a one-line form
// cue and an optional link to a full video demo. Renders nothing when the
// exercise has no media yet — the modal just shows its muscle map.
export default function ExerciseDemo({ id }: { id: string }) {
  const { lang, t } = useLang();
  const media = getExerciseMedia(id);
  const frameCount = artFrames(id);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (frameCount < 2) return;
    const iv = setInterval(() => setFrame((f) => (f + 1) % frameCount), 1100);
    return () => clearInterval(iv);
  }, [frameCount]);

  if (!media) return null;

  return (
    <div className="flex flex-col gap-2">
      {frameCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-base-300 bg-base-200/40">
          <div className="px-4 py-2">
            <ExerciseArt id={id} frame={frame} />
          </div>
          {frameCount > 1 && (
            <span className="absolute bottom-2 right-2 flex gap-1">
              {Array.from({ length: frameCount }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === frame ? "bg-primary" : "bg-base-content/25"}`}
                />
              ))}
            </span>
          )}
        </div>
      )}
      <p className="px-0.5 text-xs leading-relaxed text-base-content/70">{media.cue[lang]}</p>
      {media.youtube && (
        <a
          href={media.youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          {t("Watch demo")}
        </a>
      )}
    </div>
  );
}
