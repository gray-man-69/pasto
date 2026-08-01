// Optional per-exercise demo copy — a purely additive lookup keyed by the
// exercise id. Missing entries just mean "no demo yet" (the detail modal falls
// back to the muscle map alone), so this grows one exercise at a time and never
// touches the exercise library or any user data.
//
// The visual itself is an original line illustration (see exerciseArt.tsx), so
// there's no third-party media / licensing question. This file holds the
// localized form cue and an optional "watch a real demo" link.
import type { Lang } from "./i18n";

export type ExerciseMedia = {
  cue: Record<Lang, string>; // one-line form cue, per language
  youtube?: string; // optional link to a full video demo
};

const MEDIA: Record<string, ExerciseMedia> = {
  "barbell-bench-press": {
    cue: {
      en: "Shoulder blades pinched back and down, feet flat. Lower the bar to mid-chest with elbows ~45°, then press up and slightly back over the shoulders.",
      it: "Scapole retratte e abbassate, piedi ben piantati. Abbassa il bilanciere a metà petto con i gomiti a ~45°, poi spingi verso l'alto e leggermente indietro sopra le spalle.",
    },
    youtube: "https://www.youtube.com/results?search_query=barbell+bench+press+proper+form",
  },
};

/** Demo copy for an exercise, or null when none exists. */
export function getExerciseMedia(id: string): ExerciseMedia | null {
  return MEDIA[id] ?? null;
}
