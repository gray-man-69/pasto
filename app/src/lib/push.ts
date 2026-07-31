// Web-push subscription helpers. The VAPID public key is safe to embed; the
// private key lives only in the GitHub Actions sender. Subscriptions + reminder
// settings are stored per user in Firestore (pushSubscribers/{uid}) so the
// scheduled sender can reach them.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";

export const VAPID_PUBLIC_KEY =
  "BIbB0jVMT9W-JXMieo-g6aYJ4fimi4CsehyHqlGkwDyUOjjgOS5LQ_wMQ8X_QLd3MW-jgX-UD-8fZF0lUKexDoQ";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

const subDoc = (uid: string) => doc(firestore, "pushSubscribers", uid);

// Each reminder type is an independent account-level flag on the subscriber
// doc (waterEnabled / big3Enabled). `enabled` stays as the master switch the
// sender queries on: true while ANY type is on. Legacy docs that predate the
// flags have only `enabled` — that means water on, big3 off.
export type ReminderType = "water" | "big3";
export interface ReminderFlags {
  water: boolean;
  big3: boolean;
}

function flagsOf(d: Record<string, unknown> | undefined): ReminderFlags {
  const base = d?.enabled === true;
  return {
    water: (d?.waterEnabled as boolean | undefined) ?? base,
    big3: d?.big3Enabled === true,
  };
}

/** The account's reminder toggles (independent of this device's permission). */
export async function reminderFlags(uid: string): Promise<ReminderFlags> {
  try {
    const snap = await getDoc(subDoc(uid));
    return flagsOf(snap.exists() ? snap.data() : undefined);
  } catch {
    return { water: false, big3: false };
  }
}

/** Turn one reminder type on: asks permission, subscribes this device, and
 * flips just that flag (the other type is untouched). */
export async function enableReminderType(uid: string, type: ReminderType): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked — allow them for this app in your phone settings.");
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await setDoc(
    subDoc(uid),
    {
      uid,
      enabled: true,
      [`${type}Enabled`]: true,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      wakeStart: 8,
      wakeEnd: 22,
      subscription: sub.toJSON(),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

/** Turn one reminder type off. The push subscription stays; when both types
 * are off the master `enabled` goes false so the sender skips the doc. */
export async function disableReminderType(uid: string, type: ReminderType): Promise<void> {
  const snap = await getDoc(subDoc(uid));
  const next = { ...flagsOf(snap.exists() ? snap.data() : undefined), [type]: false };
  await setDoc(
    subDoc(uid),
    {
      waterEnabled: next.water,
      big3Enabled: next.big3,
      enabled: next.water || next.big3,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}
