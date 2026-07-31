// Pasto Worker — label-OCR proxy + Apple Health ingest. One Cloudflare Worker,
// routed by path:
//
//   POST /            nutrition-label OCR (the app; unchanged behavior)
//   POST /health      daily Health numbers from the iOS Shortcut → Firestore
//
// ── OCR setup (existing) ──────────────────────────────────────────────────────
//  1. Get a free OCR.space API key:  https://ocr.space/ocrapi/freekey
//  2. Cloudflare dashboard → Workers & Pages → Create → Worker → Deploy.
//  3. "Edit code", paste this file, Deploy.
//  4. Worker → Settings → Variables and Secrets → add a SECRET named
//     OCR_API_KEY with your OCR.space key. Save & Deploy.
//  5. Copy the Worker URL (https://<name>.<sub>.workers.dev) and put it in the
//     GitHub repo under Settings → Secrets and variables → Actions → Variables
//     as OCR_PROXY_URL.
//
// ── Health ingest setup ───────────────────────────────────────────────────────
//  1. Add SECRET HEALTH_TOKEN: any long random string (the Shortcut sends it).
//  2. Add SECRET FIREBASE_SERVICE_ACCOUNT: the service-account JSON (same one
//     used by the reminders sender). Save & Deploy.
//  3. The iOS Shortcut POSTs to <worker-url>/health:
//       { "token": "<HEALTH_TOKEN>", "uid": "<firebase-uid>",
//         "days": { "2026-07-31": { "steps": 8214, "activeKcal": 512 } } }
//     Numbers land in Firestore users/{uid}/health/{date}, which the app reads
//     (rules already scope users/{uid}/** to the signed-in owner).
//
// Only the site below (and localhost for development) is allowed to call the
// OCR route, so the free OCR quota can't be spent by other websites.

const ALLOWED_ORIGINS = [
  "https://gray-man-69.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const FIREBASE_PROJECT = "pasto-9b607";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return handleHealth(request, env);
    return handleOcr(request, env);
  },
};

// ── OCR proxy (unchanged) ────────────────────────────────────────────────────

async function handleOcr(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const cors = {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json({ error: "POST an image as multipart 'file'." }, 405, cors);
  if (!env.OCR_API_KEY) return json({ error: "Worker missing OCR_API_KEY secret." }, 500, cors);

  try {
    const inForm = await request.formData();
    const file = inForm.get("file");
    if (!file || typeof file === "string") return json({ error: "No image uploaded." }, 400, cors);

    const out = new FormData();
    out.append("apikey", env.OCR_API_KEY);
    out.append("language", "ita");
    out.append("OCREngine", "2"); // engine 2 handles real-world photos best
    out.append("isTable", "true"); // nutrition panels are tables
    out.append("scale", "true");
    out.append("file", file, "label.jpg");

    const res = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: out });
    const data = await res.json();
    if (data.IsErroredOnProcessing) {
      const msg = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(" ") : data.ErrorMessage;
      return json({ error: msg || "OCR service error." }, 502, cors);
    }
    const text = data.ParsedResults?.[0]?.ParsedText || "";
    return json({ text }, 200, cors);
  } catch (e) {
    return json({ error: `Proxy error: ${e}` }, 500, cors);
  }
}

// ── Apple Health ingest ──────────────────────────────────────────────────────
// The Shortcut is not a browser (no CORS needed). Idempotent: re-sending a day
// overwrites that day's provided fields, so multiple automation fires are fine.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = ["steps", "activeKcal", "restingKcal", "exerciseMin"];

async function handleHealth(request, env) {
  if (request.method !== "POST") return json({ error: "POST JSON." }, 405, {});
  if (!env.HEALTH_TOKEN || !env.FIREBASE_SERVICE_ACCOUNT)
    return json({ error: "Worker missing HEALTH_TOKEN / FIREBASE_SERVICE_ACCOUNT secrets." }, 500, {});

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400, {});
  }
  if (body?.token !== env.HEALTH_TOKEN) return json({ error: "Bad token." }, 401, {});
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  if (!/^[A-Za-z0-9]{10,64}$/.test(uid)) return json({ error: "Bad uid." }, 400, {});

  let days = body.days && typeof body.days === "object" ? Object.entries(body.days) : [];
  // Flat single-day shape too — much easier to build in the iOS Shortcut:
  //   { token, uid, date: "2026-07-31", steps: 8214, activeKcal: 512 }
  if (days.length === 0 && typeof body.date === "string") {
    days = [[body.date.trim(), body]];
  }
  if (days.length === 0 || days.length > 7) return json({ error: "Send 1–7 days." }, 400, {});

  let token;
  try {
    token = await googleAccessToken(env);
  } catch (e) {
    return json({ error: `Auth to Firestore failed: ${e}` }, 502, {});
  }

  const written = [];
  for (const [date, values] of days) {
    if (!DATE_RE.test(date) || !values || typeof values !== "object") continue;
    const fields = { date: { stringValue: date }, updatedAt: { integerValue: String(Date.now()) } };
    const mask = ["date", "updatedAt"];
    for (const f of FIELDS) {
      const n = Number(values[f]);
      if (Number.isFinite(n) && n >= 0) {
        fields[f] = { doubleValue: Math.round(n) };
        mask.push(f);
      }
    }
    if (mask.length === 2) continue; // no numeric fields provided

    const doc = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${uid}/health/${date}`;
    const maskQs = mask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await fetch(`https://firestore.googleapis.com/v1/${doc}?${maskQs}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) return json({ error: `Firestore write failed (${res.status}).` }, 502, {});
    written.push(date);
  }
  return json({ ok: true, written }, 200, {});
}

// OAuth2 service-account flow (RS256 JWT via WebCrypto), token cached ~50 min.
let cachedToken = null; // { value, expiresAt }
async function googleAccessToken(env) {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const toSign = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  const jwt = `${toSign}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || "no access_token");
  cachedToken = { value: data.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.access_token;
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
