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
    const onLoad = () =>
      navigator.serviceWorker.register(`${BASE_PATH}/sw.js`).catch(() => {
        /* offline support is best-effort */
      });
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
