"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/basePath";

// Registers the service worker (installable + offline) and asks the browser to
// make our IndexedDB storage *persistent* so it isn't silently evicted under
// storage pressure. Persistence is per-origin — it can't share data across
// different browsers/profiles (that's what Backup & restore on Goals is for).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Best-effort: mark storage persistent so the food log survives eviction.
    if (navigator.storage?.persist) {
      navigator.storage.persisted().then((already) => {
        if (!already) navigator.storage.persist().catch(() => {});
      });
    }

    if (!("serviceWorker" in navigator)) return;

    // Auto-update: when a new deploy's service worker takes control, reload once
    // so the newest code applies without a manual hard-restart. Guarded so it
    // never loops and never fires on the very first install.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // updateViaCache: "none" makes update checks bypass the HTTP cache (GitHub
    // Pages serves sw.js with max-age=600, which otherwise delays updates).
    const register = () =>
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`, { updateViaCache: "none" })
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {
          /* offline support is best-effort */
        });
    // `load` may already have fired (PWA resume, fast hydration) — register now
    // in that case, or we'd never register/update at all this session.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);

    // A PWA brought back from the background resumes without any navigation, so
    // also check for a new version whenever the app becomes visible again.
    let lastCheck = 0;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}));
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
