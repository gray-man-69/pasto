// Read an Italian "Valori nutrizionali" panel from a photo and pull out the
// per-100g macros. OCR runs client-side via tesseract.js (lazy-loaded). The
// caller passes a *cropped + upscaled* image of just the table (see
// LabelCropper) — that is what makes the read reliable. The parse is
// best-effort; the user always verifies the values before saving.
import type { Nutrients } from "./types";

export type LabelValues = Partial<Nutrients>;

// Turn tesseract's internal status strings into something a user understands.
// The first scan downloads a language pack + engine (~10MB), which is the slow
// part on a phone — so we report those stages too, not just the reading.
function stageLabel(status: string): string {
  if (/traineddata|language/i.test(status)) return "Loading Italian (first time only)";
  if (/recogniz/i.test(status)) return "Reading the table";
  if (/core|initializ|loading|worker/i.test(status)) return "Starting scanner";
  return "Working";
}

export async function ocrLabel(
  image: Blob,
  onStage?: (label: string, fraction: number) => void,
): Promise<{ text: string; values: LabelValues }> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("ita", 1, {
    logger: (m: { status: string; progress: number }) => {
      onStage?.(stageLabel(m.status), m.progress ?? 0);
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

    // Energy: the number can come BEFORE or AFTER the unit — real Italian labels
    // write both "250 kcal" and "kcal 351". Match either.
    const kcalM = lower.match(/kcal\s*([\d.,]+)|([\d.,]+)\s*kcal/);
    if (kcalM) {
      const v = toNum(kcalM[1] ?? kcalM[2]);
      if (v != null) out.kcal = v;
      continue;
    }
    // Some labels print only kJ — remember it as a fallback (either order).
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
