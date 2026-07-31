"use client";

// Apple Health numbers for a day, written to Firestore (users/{uid}/health/{date})
// by the Cloudflare Worker's /health endpoint — fed by an iOS Shortcut, since
// HealthKit has no web API. Read-only here; the app never writes these docs.
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "./firebase";

export interface HealthDay {
  date: string; // YYYY-MM-DD
  steps?: number;
  activeKcal?: number;
  restingKcal?: number;
  exerciseMin?: number;
  updatedAt?: number;
}

/** Live Health numbers for one day, or null when signed out / no data yet. */
export function useHealthDay(uid: string | undefined, date: string): HealthDay | null {
  const [day, setDay] = useState<HealthDay | null>(null);
  useEffect(() => {
    if (!uid) {
      setDay(null);
      return;
    }
    setDay(null);
    return onSnapshot(
      doc(firestore, "users", uid, "health", date),
      (snap) => setDay(snap.exists() ? ({ ...(snap.data() as Omit<HealthDay, "date">), date }) : null),
      () => setDay(null), // offline / rules issue → just hide the card
    );
  }, [uid, date]);
  return day;
}
