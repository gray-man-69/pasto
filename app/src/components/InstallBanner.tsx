"use client";

import { useEffect, useState } from "react";

// The browser's deferred install prompt (Chrome/Android/desktop). Capturing it
// lets us offer a real one-tap PWA install (a WebAPK — standalone, no browser
// chrome) instead of relying on the buried menu item, which on a first visit
// often only creates a browser shortcut.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pasto-install-dismissed";

export default function InstallBanner() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Already running as an installed app? Nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setHidden(false);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's own mini-infobar; we drive it
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt — show the manual hint instead.
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)) {
      setIosHint(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!deferred && !iosHint)) return null;

  function close() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user dismissed */
    }
    setDeferred(null);
    close();
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Install Pasto</div>
        <div className="text-xs text-base-content/60">
          {deferred ? "Add it to your home screen — full-screen, works offline." : "Tap Share, then “Add to Home Screen”."}
        </div>
      </div>
      {deferred && (
        <button onClick={install} className="btn btn-primary btn-sm shrink-0 rounded-full px-4">
          Install
        </button>
      )}
      <button onClick={close} aria-label="Dismiss" className="shrink-0 text-base-content/40 hover:text-base-content">
        ✕
      </button>
    </div>
  );
}
