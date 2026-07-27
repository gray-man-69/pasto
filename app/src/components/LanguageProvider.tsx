"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getStoredLang, storeLang, translate, type Lang, type TParams } from "@/lib/i18n";

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: TParams) => string;
};

const Ctx = createContext<LangCtx | null>(null);

export function useLang(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLang must be used inside LanguageProvider");
  return c;
}

/** Convenience: just the translate function. */
export function useT() {
  return useLang().t;
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  // Start at "en" to match the server-rendered HTML (avoids a hydration
  // mismatch), then adopt the stored preference on mount.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = getStoredLang();
    setLangState(stored);
    document.documentElement.lang = stored;
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storeLang(l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: string, params?: TParams) => translate(lang, key, params), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
