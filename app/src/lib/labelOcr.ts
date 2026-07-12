// Read an Italian "Valori nutrizionali" panel from a photo and pull out the
// per-100g/ml macros. OCR runs in the cloud via a Cloudflare Worker proxy (see
// worker/ocr.js) that keeps the OCR key secret — this is far more reliable on
// real grid-style Italian labels than on-device OCR. The parse is best-effort;
// the user always verifies the values before saving.
import type { Nutrients } from "./types";

export type LabelValues = Partial<Nutrients>;

const PROXY_URL = process.env.NEXT_PUBLIC_OCR_PROXY_URL;

export function ocrConfigured(): boolean {
  return !!PROXY_URL;
}

export async function ocrLabel(
  image: Blob,
  onStage?: (label: string, fraction: number) => void,
): Promise<{ text: string; values: LabelValues }> {
  if (!PROXY_URL) throw new Error("Label scanning isn't set up yet (missing OCR proxy URL).");

  onStage?.("Uploading photo", 0.25);
  const form = new FormData();
  form.append("file", image, "label.jpg");

  let res: Response;
  try {
    res = await fetch(PROXY_URL, { method: "POST", body: form });
  } catch {
    throw new Error("Couldn't reach the scanner — check your connection.");
  }
  onStage?.("Reading the table", 0.75);

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Scanner error (${res.status}).`);

  const text: string = data.text || "";
  onStage?.("Done", 1);
  return { text, values: parseLabel(text) };
}

/** Parse an Italian nutrition label's OCR text into per-100g/ml values. */
export function parseLabel(text: string): LabelValues {
  const out: LabelValues = {};
  const toNum = (s: string): number | null => {
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) ? v : null;
  };
  const firstNum = (s: string): number | null => {
    const m = s.match(/\d+(?:[.,]\d+)?/); // first number, comma or dot decimal
    return m ? toNum(m[0]) : null;
  };

  let kj: number | null = null;

  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();

    // Skip the "reference intakes (2000 kcal)" footer so it can't be mistaken
    // for the product's energy.
    if (/riferiment|assunzioni|reference intake|apporto/.test(lower)) continue;

    // Energy: the number can come BEFORE or AFTER the unit — real Italian labels
    // write both "250 kcal" and "kcal 351". Take the first energy line only.
    const kcalM = lower.match(/kcal\s*([\d.,]+)|([\d.,]+)\s*kcal/);
    if (kcalM) {
      const v = toNum(kcalM[1] ?? kcalM[2]);
      if (v != null && out.kcal == null) out.kcal = v;
      continue;
    }
    const kjM = lower.match(/kj\s*([\d.,]+)|([\d.,]+)\s*kj/);
    if (kjM) {
      const v = toNum(kjM[1] ?? kjM[2]);
      if (v != null && kj == null) kj = v;
      continue;
    }

    const num = firstNum(line);
    if (num == null) continue;

    // Order matters: sub-nutrients ("di cui zuccheri/saturi") before their parents.
    if (/zucch/.test(lower)) out.sugars_g = num;
    else if (/satur/.test(lower)) out.saturated_g = num;
    else if (/fibr/.test(lower)) out.fiber_g = num;
    else if (/protein/.test(lower)) out.protein_g = num;
    else if (/carboidr|carbo/.test(lower)) out.carbs_g = num;
    else if (/grass/.test(lower)) out.fat_g = num;
  }

  // No kcal printed but we saw kJ → convert (1 kcal = 4.184 kJ).
  if (out.kcal == null && kj != null) out.kcal = Math.round(kj / 4.184);
  return out;
}
