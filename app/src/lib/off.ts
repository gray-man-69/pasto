// Open Food Facts barcode lookup. Single-product API only ("1 call = 1 scan"),
// which is the reliable, allowed usage. Maps an OFF product to our Food shape.
import type { Food, Nutrients } from "./types";

const FIELDS = "code,product_name,product_name_it,brands,nutriments";

function toNum(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : 0;
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

  const per100g: Nutrients = {
    kcal: toNum(nut["energy-kcal_100g"]),
    protein_g: toNum(nut["proteins_100g"]),
    carbs_g: toNum(nut["carbohydrates_100g"]),
    sugars_g: toNum(nut["sugars_100g"]),
    fat_g: toNum(nut["fat_100g"]),
    saturated_g: toNum(nut["saturated-fat_100g"]),
    fiber_g: toNum(nut["fiber_100g"]),
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
    hasNutrition: nut["energy-kcal_100g"] != null,
  };
}
