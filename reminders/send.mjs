// Scheduled water-reminder sender. Runs in GitHub Actions a few times a day.
// For each opted-in user it reads their water progress (from the synced state
// doc) and, if they're behind for the time of day, sends a web-push nudge.
// Secrets (env): FIREBASE_SERVICE_ACCOUNT (JSON), VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT.
import admin from "firebase-admin";
import webpush from "web-push";

const APP_URL = "https://gray-man-69.github.io/pasto/?water=1";

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// Local calendar date + fractional hour for a timezone.
function localNow(tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  const hour = Number(g("hour")) % 24;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: hour + Number(g("minute")) / 60 };
}

const subs = await db.collection("pushSubscribers").where("enabled", "==", true).get();
let sent = 0,
  skipped = 0;

for (const docSnap of subs.docs) {
  const s = docSnap.data();
  const uid = s.uid || docSnap.id;
  const tz = s.tz || "UTC";
  const wakeStart = s.wakeStart ?? 8;
  const wakeEnd = s.wakeEnd ?? 22;
  const { date, hour } = localNow(tz);

  if (hour < wakeStart || hour >= wakeEnd) {
    skipped++;
    continue;
  }

  const stateSnap = await db.doc(`users/${uid}/state/main`).get();
  const state = stateSnap.exists ? stateSnap.data() : {};
  const goal = state?.goals?.water_glasses ?? 8;
  const today = (state?.water || []).find((w) => w.date === date);
  const glasses = today?.glasses ?? 0;

  // Expected intake by now, spread linearly across the waking window.
  const frac = Math.min(1, (hour - wakeStart) / (wakeEnd - wakeStart));
  const expected = Math.ceil(goal * frac);

  if (glasses >= expected || glasses >= goal) {
    skipped++;
    continue;
  }

  const payload = JSON.stringify({
    title: "💧 Water reminder",
    body: `${glasses}/${goal} glasses — time for a drink`,
    url: APP_URL,
  });

  try {
    await webpush.sendNotification(s.subscription, payload);
    sent++;
  } catch (e) {
    console.error(`send failed for ${uid}:`, e.statusCode);
    if (e.statusCode === 404 || e.statusCode === 410) {
      await docSnap.ref.set({ enabled: false }, { merge: true }); // subscription gone
    }
  }
}

console.log(`water-reminders: sent=${sent} skipped=${skipped} total=${subs.size}`);
