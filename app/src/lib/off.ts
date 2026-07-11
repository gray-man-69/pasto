// Open Food Facts barcode lookup. Single-product API only ("1 call = 1 scan"),
// which is the reliable, allowed usage. Maps an OFF product to our Food shape.
import type { Food, Nutrients } from "./types";

const FIELDS = "code,product_name,product_name_it,brands,nutriments";

// First finite value among candidate nutriment keys (rounded to 1 dp).
function pick(nut: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const x = Number(nut[k]);
    if (Number.isFinite(x)) return Math.round(x * 10) / 10;
  }
  return 0;
}

export type OffLookup = { food: Food; hasNutrition: boolean } | null;

/** Look up a product by barcode. Returns a Food (custom, carrying the barcode)
 * or null if OFF has no such product. Throws on network error. */
export async function lookupBarcode(barcode: string): Promise<OffLookup> {
  const code = barcode.trim();
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
  );
  if (!res.ok) throw new Error(`Open Food Facts lookup failed (${res.status})`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const nut = p.nutriments || {};
  const name = (p.product_name_it || p.product_name || "").trim();
  const brand = (p.brands || "").split(",")[0]?.trim() || "";
  if (!name && !brand) return null;

  // kcal: prefer the kcal field; else convert an energy value (kJ) → kcal.
  let kcal = pick(nut, "energy-kcal_100g", "energy-kcal_value");
  if (!kcal) {
    const kj = pick(nut, "energy-kj_100g", "energy_100g", "energy-kj_value");
    if (kj) kcal = Math.round((kj / 4.184) * 10) / 10;
  }
  const per100g: Nutrients = {
    kcal,
    protein_g: pick(nut, "proteins_100g", "proteins_value"),
    carbs_g: pick(nut, "carbohydrates_100g", "carbohydrates_value"),
    sugars_g: pick(nut, "sugars_100g", "sugars_value"),
    fat_g: pick(nut, "fat_100g", "fat_value"),
    saturated_g: pick(nut, "saturated-fat_100g", "saturated-fat_value"),
    fiber_g: pick(nut, "fiber_100g", "fiber_value"),
  };

  const displayName =
    name && brand && !name.toLowerCase().includes(brand.toLowerCase())
      ? `${name} (${brand})`
      : name || brand;

  return {
    food: {
      id: `off-${p.code || code}`,
      name: displayName,
      name_en: null,
      category: brand || "Confezionati",
      per100g,
      custom: true,
      barcode: p.code || code,
    },
    // Usable only if we actually got calories or at least a couple of macros.
    hasNutrition: kcal > 0 || per100g.protein_g > 0 || per100g.carbs_g > 0 || per100g.fat_g > 0,
  };
}
