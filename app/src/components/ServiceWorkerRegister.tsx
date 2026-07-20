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

    const onLoad = () =>
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`)
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {
          /* offline support is best-effort */
        });
    window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
