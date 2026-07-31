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
    return { title: "💧 Obiettivo raggiunto!", body: `${glasses}/${goal} bicchieri oggi — bravissima! 🎉` };
  }
  const options = [
    `Sei a ${glasses}/${goal} bicchieri — è ora di bere un po' d'acqua 💦`,
    `Controllo idratazione: ${glasses}/${goal} oggi. Fai un sorso! 💧`,
    `${glasses}/${goal} bicchieri finora — vai a bere 💦`,
    `Un po' indietro con l'acqua (${glasses}/${goal}) — bevi un sorso 💧`,
  ];
  return { title: "💧 Promemoria acqua", body: options[Math.floor(Math.random() * options.length)] };
}

// McGill Big 3 nudge window (local hours): every run inside it reminds until
// the day's check-off is marked done in the app.
const BIG3_START = 10;
const BIG3_END = 22; // inclusive — last nudge at the 22:00 run

const BIG3_MESSAGES = [
  "Curl-up, side plank, bird dog — la schiena ringrazia 🧱",
  "Non ancora fatti oggi: 10 minuti per i Big 3 💪",
  "Promemoria Big 3: core stabile, schiena protetta 🧱",
  "È ora dei Big 3 di McGill — falli adesso, poi spunta ✓",
];

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
  const who = uid.slice(0, 6);

  // The cron runs hourly (GitHub delays/skips make a 2-hourly cron unreliable);
  // sending only on even LOCAL hours keeps the every-2-hours cadence.
  if (!TEST && Math.floor(hour) % 2 !== 0) {
    skipped++;
    continue;
  }

  // Every device the user enabled reminders from (new per-device map), plus the
  // legacy single `subscription` field from older docs (deduped by endpoint).
  const devices = Object.entries(s.subscriptions || {}).map(([key, sub]) => ({ key, sub }));
  if (s.subscription && !devices.some((d) => d.sub?.endpoint === s.subscription.endpoint)) {
    devices.push({ key: null, sub: s.subscription });
  }
  if (devices.length === 0) {
    console.log(`${who}: no subscriptions — skipping`);
    skipped++;
    continue;
  }

  // Today's progress + goal from the synced state doc.
  const stateSnap = await db.doc(`users/${uid}/state/main`).get();
  const state = stateSnap.exists ? stateSnap.data() : {};
  const goal = state?.goals?.water_glasses ?? 8;
  const today = (state?.water || []).find((w) => w.date === date);
  const glasses = today?.glasses ?? 0;

  // Send a payload to every device; prune subscriptions that are gone (404/410).
  const dead = new Set();
  const push = async (payload) => {
    for (const d of devices) {
      if (dead.has(d)) continue;
      try {
        await webpush.sendNotification(d.sub, JSON.stringify(payload));
        sent++;
      } catch (e) {
        console.error(`${who}: send failed (device ${d.key ?? "legacy"}):`, e.statusCode);
        if (e.statusCode === 404 || e.statusCode === 410) dead.add(d);
      }
    }
  };

  // --- Water -----------------------------------------------------------------
  // Per-user flag; legacy docs (only `enabled`) mean water on. Independent of
  // the Big 3 flag below — each account picks its own mix.
  const waterOn = (s.waterEnabled ?? true) === true;
  let waterDue = waterOn;
  if (waterDue && !TEST) {
    // Only during waking hours, and only if behind the linear pace.
    if (hour < wakeStart || hour >= wakeEnd) waterDue = false;
    else {
      const frac = Math.min(1, (hour - wakeStart) / (wakeEnd - wakeStart));
      const expected = Math.ceil(goal * frac);
      if (glasses >= expected || glasses >= goal) waterDue = false;
    }
  }
  if (waterDue) {
    const { title, body } = buildMessage(glasses, goal);
    await push({ title, body, url: APP_URL });
  } else {
    skipped++;
  }

  // --- McGill Big 3 ------------------------------------------------------------
  // Opt-in per user (big3Enabled on the subscriber doc — Settings toggle).
  // Done = a McGill conditioning session logged today (the in-app Big 3 timer
  // records one on completion — see ConditioningSession kind "mcgill").
  const big3On = s.big3Enabled === true;
  const big3Done = (state?.conditioning || []).some((c) => c.kind === "mcgill" && c.date === date);
  const big3Due = big3On && (TEST || (hour >= BIG3_START && hour <= BIG3_END && !big3Done));
  if (big3Due) {
    await push({
      title: "🧱 McGill Big 3",
      body: BIG3_MESSAGES[Math.floor(Math.random() * BIG3_MESSAGES.length)],
      url: "https://gray-man-69.github.io/pasto/",
      tag: "big3-reminder", // separate tag: doesn't replace the water notification
    });
  }

  console.log(
    `${who}: tz=${tz} hour=${hour.toFixed(2)} devices=${devices.length} ` +
      `water(on=${waterOn} due=${waterDue}) big3(on=${big3On} done=${big3Done} due=${big3Due})`,
  );

  // Prune dead device subscriptions so we stop retrying them.
  if (dead.size) {
    const update = {};
    for (const d of dead) {
      if (d.key) update[`subscriptions.${d.key}`] = admin.firestore.FieldValue.delete();
      else update.subscription = admin.firestore.FieldValue.delete();
    }
    if (dead.size === devices.length) update.enabled = false; // nothing left to reach
    await docSnap.ref.update(update);
  }
}

console.log(`reminders: sent=${sent} skipped=${skipped} total=${subs.size}`);
