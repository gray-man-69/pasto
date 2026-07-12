// Pasto label-OCR proxy — a Cloudflare Worker.
//
// The app POSTs a cropped nutrition-label image here; the Worker forwards it to
// OCR.space with the API key kept SECRET on the server side, and returns the
// recognised text. This keeps the key out of the public app bundle and lets us
// use a good OCR engine for free.
//
// ── One-time setup ────────────────────────────────────────────────────────────
//  1. Get a free OCR.space API key:  https://ocr.space/ocrapi/freekey
//  2. Cloudflare dashboard → Workers & Pages → Create → Worker → Deploy.
//  3. "Edit code", paste this file, Deploy.
//  4. Worker → Settings → Variables and Secrets → add a SECRET named
//     OCR_API_KEY with your OCR.space key. Save & Deploy.
//  5. Copy the Worker URL (https://<name>.<sub>.workers.dev) and put it in the
//     GitHub repo under Settings → Secrets and variables → Actions → Variables
//     as OCR_PROXY_URL.
//
// Only the site below (and localhost for development) is allowed to call it, so
// the free OCR quota can't be spent by other websites.

const ALLOWED_ORIGINS = [
  "https://gray-man-69.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export default {
  async fetch(request, env) {
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
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
