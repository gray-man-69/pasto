// Read an Italian "Valori nutrizionali" panel from a photo and pull out the
// per-100g macros. OCR runs client-side via tesseract.js (lazy-loaded). The
// caller passes a *cropped + upscaled* image of just the table (see
// LabelCropper) — that is what makes the read reliable. The parse is
// best-effort; the user always verifies the values before saving.
import type { Nutrients } from "./types";

export type LabelValues = Partial<Nutrients>;

export async function ocrLabel(
  image: Blob,
  onProgress?: (fraction: number) => void,
): Promise<{ text: string; values: LabelValues }> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("ita", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    // "single uniform block of text" — right for a cropped nutrition table,
    // far better than the default full-page segmentation.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const { data } = await worker.recognize(image);
    return { text: data.text, values: parseLabel(data.text) };
  } finally {
    await worker.terminate();
  }
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

  let kj: number | null = null;

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
    // Some labels only print kJ — remember it as a fallback for later.
    const kjM = lower.match(/([\d.,]+)\s*kj/);
    if (kjM) {
      if (kj == null) kj = Number(kjM[1].replace(",", "."));
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

  // No kcal printed but we saw kJ → convert (1 kcal = 4.184 kJ).
  if (out.kcal == null && kj != null) out.kcal = Math.round(kj / 4.184);
  return out;
}
