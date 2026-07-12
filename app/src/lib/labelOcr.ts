// Read an Italian "Valori nutrizionali" panel from a photo and pull out the
// per-100g macros. OCR runs client-side via tesseract.js (lazy-loaded). The parse
// is best-effort — the user always verifies the values before saving.
import type { Nutrients } from "./types";

export type LabelValues = Partial<Nutrients>;

export async function ocrLabel(
  image: Blob,
  onProgress?: (fraction: number) => void,
): Promise<{ text: string; values: LabelValues }> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(image, "ita", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  return { text: data.text, values: parseLabel(data.text) };
}

/** Parse an Italian nutrition label's OCR text into per-100g values. */
export function parseLabel(text: string): LabelValues {
  const out: LabelValues = {};
  const numFrom = (s: string): number | null => {
    const m = s.match(/(\d+(?:[.,]\d+)?)/); // first number, comma or dot decimal
    if (!m) return null;
    const v = Number(m[1].replace(",", "."));
    return Number.isFinite(v) ? v : null;
  };

  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();

    // Energy line: "Energia 1046 kJ / 250 kcal" → take the kcal number.
    const kcalM = lower.match(/([\d.,]+)\s*kcal/);
    if (kcalM) {
      out.kcal = Number(kcalM[1].replace(",", "."));
      continue;
    }

    const num = numFrom(line);
    if (num == null) continue;

    // Order matters: sub-nutrients ("di cui zuccheri/saturi") before their parents.
    if (/zucch/.test(lower)) out.sugars_g = num;
    else if (/satur/.test(lower)) out.saturated_g = num;
    else if (/fibr/.test(lower)) out.fiber_g = num;
    else if (/protein/.test(lower)) out.protein_g = num;
    else if (/carboidr/.test(lower)) out.carbs_g = num;
    else if (/grass/.test(lower)) out.fat_g = num;
  }
  return out;
}
