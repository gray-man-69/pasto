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

/** Ask permission, subscribe this device to push, and store it for `uid`. */
export async function enableReminders(uid: string): Promise<void> {
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
  await setDoc(subDoc(uid), {
    uid,
    enabled: true,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    wakeStart: 8,
    wakeEnd: 22,
    subscription: sub.toJSON(),
    updatedAt: Date.now(),
  });
}

/** Stop reminders for this device. */
export async function disableReminders(uid: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    /* ignore */
  }
  await setDoc(subDoc(uid), { enabled: false, updatedAt: Date.now() }, { merge: true });
}

export async function remindersEnabled(uid: string): Promise<boolean> {
  try {
    if (Notification.permission !== "granted") return false;
    const snap = await getDoc(subDoc(uid));
    return snap.exists() && snap.data().enabled === true;
  } catch {
    return false;
  }
}
