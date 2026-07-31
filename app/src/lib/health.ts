"use client";

// Apple Health numbers for a day, written to Firestore (users/{uid}/health/{date})
// by the Cloudflare Worker's /health endpoint — fed by an iOS Shortcut, since
// HealthKit has no web API. Read-only here; the app never writes these docs.
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "./firebase";

export interface HealthDay {
  date: string; // YYYY-MM-DD
  steps?: number;
  activeKcal?: number;
  restingKcal?: number;
  exerciseMin?: number;
  updatedAt?: number;
}

/** Live Health numbers for a date range (inclusive), keyed by date — used by
 * the week strip to draw each day's burn arc. Empty map when signed out. */
export function useHealthRange(
  uid: string | undefined,
  start: string,
  end: string,
): Map<string, HealthDay> {
  const [days, setDays] = useState<Map<string, HealthDay>>(new Map());
  useEffect(() => {
    if (!uid) {
      setDays(new Map());
      return;
    }
    const q = query(
      collection(firestore, "users", uid, "health"),
      where("date", ">=", start),
      where("date", "<=", end),
    );
    return onSnapshot(
      q,
      (snap) => {
        const m = new Map<string, HealthDay>();
        snap.forEach((d) => {
          const v = d.data() as HealthDay;
          if (v.date) m.set(v.date, v);
        });
        setDays(m);
      },
      () => setDays(new Map()),
    );
  }, [uid, start, end]);
  return days;
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
