// Scheduled water-reminder sender. Runs in GitHub Actions a few times a day.
// For each opted-in user it reads their water progress (from the synced state
// doc) and, if they're behind for the time of day, sends a web-push nudge.
// Secrets (env): FIREBASE_SERVICE_ACCOUNT (JSON), VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT. TEST_MODE=true forces a send now.
import admin from "firebase-admin";
import webpush from "web-push";

const APP_URL = "https://gray-man-69.github.io/pasto/?water=1";

// Not configured yet? Exit cleanly (green run) instead of failing.
if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.VAPID_PRIVATE_KEY) {
  console.log("water-reminders: not configured yet (missing secrets) — skipping.");
  process.exit(0);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// Test mode forces a real reminder now, bypassing the waking-hours/behind checks.
const TEST = process.env.TEST_MODE === "true";

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

function buildMessage(glasses, goal) {
  if (glasses >= goal) {
    return { title: "💧 Goal reached!", body: `${glasses}/${goal} glasses today — nice work 🎉` };
  }
  const options = [
    `You're at ${glasses}/${goal} glasses — time for a drink 💦`,
    `Hydration check: ${glasses}/${goal} today. Sip sip! 💧`,
    `${glasses}/${goal} glasses so far — go grab some water 💦`,
    `A little behind on water (${glasses}/${goal}) — take a sip 💧`,
  ];
  return { title: "💧 Water reminder", body: options[Math.floor(Math.random() * options.length)] };
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

  // Today's progress + goal from the synced state doc.
  const stateSnap = await db.doc(`users/${uid}/state/main`).get();
  const state = stateSnap.exists ? stateSnap.data() : {};
  const goal = state?.goals?.water_glasses ?? 8;
  const today = (state?.water || []).find((w) => w.date === date);
  const glasses = today?.glasses ?? 0;

  if (!TEST) {
    // Only during waking hours, and only if behind the linear pace.
    if (hour < wakeStart || hour >= wakeEnd) {
      skipped++;
      continue;
    }
    const frac = Math.min(1, (hour - wakeStart) / (wakeEnd - wakeStart));
    const expected = Math.ceil(goal * frac);
    if (glasses >= expected || glasses >= goal) {
      skipped++;
      continue;
    }
  }

  const { title, body } = buildMessage(glasses, goal);
  try {
    await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, url: APP_URL }));
    sent++;
  } catch (e) {
    console.error(`send failed for ${uid}:`, e.statusCode);
    if (e.statusCode === 404 || e.statusCode === 410) {
      await docSnap.ref.set({ enabled: false }, { merge: true }); // subscription gone
    }
  }
}

console.log(`water-reminders: sent=${sent} skipped=${skipped} total=${subs.size}`);
