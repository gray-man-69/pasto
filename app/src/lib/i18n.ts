// Lightweight, dependency-free i18n for the static-export PWA.
//
// Design goals (deliberate, for safety):
//  • The **English source text is its own key** — `t("Training")` — so any
//    string that hasn't been translated yet simply renders in English. Missing
//    a key can never blank the UI or throw; the worst case is untranslated copy.
//  • The chosen language lives in `localStorage` only (like the g/ml unit
//    toggle) — no Dexie schema change, no sync/backup change, nothing that could
//    touch or migrate user data.
//  • `{name}`-style placeholders keep dynamic copy translatable.
import { it } from "./locales/it";

export type Lang = "en" | "it";
export const LANGS: Lang[] = ["en", "it"];
export const LANG_LABEL: Record<Lang, string> = { en: "English", it: "Italiano" };

const STORAGE_KEY = "pasto:lang";
const DICTS: Record<Lang, Record<string, string>> = { en: {}, it };

/** Read the saved language. Defaults to English so current behaviour is
 * unchanged until the user opts into Italian. */
export function getStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "it" || v === "en") return v;
  } catch {
    /* private mode / disabled storage — fall through */
  }
  return "en";
}

export function storeLang(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export type TParams = Record<string, string | number>;

/** Translate `key` (the English source string) into `lang`, falling back to the
 * key itself when there's no entry. Interpolates `{name}` placeholders. */
export function translate(lang: Lang, key: string, params?: TParams): string {
  let out = DICTS[lang]?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return out;
}
