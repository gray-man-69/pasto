"use client";

import { useRef, useState } from "react";
import LabelCropper from "@/components/LabelCropper";
import NumberField from "@/components/NumberField";
import { deleteCustomFood, newCustomFoodId, saveCustomFood } from "@/lib/db";
import { ocrConfigured, ocrLabel } from "@/lib/labelOcr";
import { emptyNutrients } from "@/lib/macros";
import type { Food, Nutrients } from "@/lib/types";

// Create or edit a custom food. Opened either from a CREA food (`base`) — so
// every field is prefilled with the reference values and you just tweak the few
// that differ for your store's version — or blank for a food not in the
// database. Saved foods live in IndexedDB and outrank CREA in search.

type NutrientField = { key: keyof Nutrients; label: string; unit: string };

const FIELDS: NutrientField[] = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "sugars_g", label: "— of which sugars", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "saturated_g", label: "— of which saturated", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
];

export default function FoodEditor({
  base,
  onClose,
  onSaved,
}: {
  // A CREA or existing custom food to seed from. If it's already custom we edit
  // it in place; otherwise we spin off a new custom variant based on it.
  base: Food | null;
  onClose: () => void;
  onSaved: (food: Food) => void;
}) {
  const editingCustom = base?.custom === true;
  const [name, setName] = useState(
    base ? (editingCustom ? base.name : `${base.name} (custom)`) : "",
  );
  const [category, setCategory] = useState(base?.category ?? "Custom");
  const [n, setN] = useState<Nutrients>(base ? { ...base.per100g } : emptyNutrients());
  const [busy, setBusy] = useState(false);
  const labelInput = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrInfo, setOcrInfo] = useState<string | null>(null);

  const set = (key: keyof Nutrients, value: number) =>
    setN((prev) => ({ ...prev, [key]: value }));

  // Camera shot → let the user frame just the table (LabelCropper) → OCR that crop.
  function handleLabelPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (labelInput.current) labelInput.current.value = "";
    if (!file) return;
    setOcrMsg(null);
    setCropFile(file);
  }

  async function scanCrop(blob: Blob) {
    setCropFile(null);
    setOcrBusy(true);
    setOcrText(null);
    // Show exactly what image we send to the scanner — the fastest way to tell a
    // bad crop (blank/rotated) apart from an OCR miss.
    setOcrPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    const dim = await new Promise<string>((res) => {
      const im = new Image();
      im.onload = () => res(`${im.naturalWidth}×${im.naturalHeight}`);
      im.onerror = () => res("?");
      im.src = URL.createObjectURL(blob);
    });
    setOcrInfo(`${dim} px · ${Math.round(blob.size / 1024)} KB`);
    setOcrMsg("Starting scanner… 0%");
    try {
      const { text, values } = await ocrLabel(blob, (label, p) =>
        setOcrMsg(`${label}… ${Math.round(p * 100)}%`),
      );
      setOcrText(text.trim() || "(the scanner read nothing)");
      const filled = Object.keys(values).length;
      if (filled === 0) {
        setOcrMsg("Couldn't find any values — make sure the box is tight around just the nutrition table, then try again.");
      } else {
        setN((prev) => ({ ...prev, ...values }));
        setOcrMsg(`Filled ${filled} value${filled === 1 ? "" : "s"} — please double-check them.`);
      }
    } catch (err) {
      setOcrMsg(`Label scan failed: ${err instanceof Error ? err.message : "unknown error"}. Type the values in instead.`);
    } finally {
      setOcrBusy(false);
    }
  }

  // CREA calories are measured, not derived, but a from-macros estimate is a
  // handy sanity check / starting point for a scratch food.
  const kcalFromMacros = Math.round(n.protein_g * 4 + n.carbs_g * 4 + n.fat_g * 9);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const food: Food = {
      id: editingCustom ? base!.id : newCustomFoodId(),
      name: name.trim(),
      name_en: base?.name_en ?? null,
      category: category.trim() || "Custom",
      per100g: n,
      custom: true,
      basedOn: editingCustom ? base?.basedOn : base?.id,
      barcode: base?.barcode, // keep the scanned barcode so it matches next time
    };
    await saveCustomFood(food);
    onSaved(food);
  }

  async function remove() {
    if (!editingCustom || !base) return;
    setBusy(true);
    await deleteCustomFood(base.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-base-300 bg-base-100 p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {editingCustom ? "Edit food" : "Custom food"}
          </h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-base-content/50">
          {base && !editingCustom
            ? `Prefilled from ${base.name}. Adjust what differs — values are per 100 g.`
            : "Values are per 100 g. Check the label on the pack."}
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-base-content/60">Name</span>
          <input
            autoFocus={!base}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Petto di pollo — Esselunga"
            className="input input-bordered w-full"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-base-content/60">Category</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input input-bordered input-sm w-full"
          />
        </label>

        {/* Scan the nutrition label to auto-fill the values below */}
        <input
          ref={labelInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleLabelPhoto}
        />
        {ocrConfigured() && (
          <button
            onClick={() => labelInput.current?.click()}
            disabled={ocrBusy}
            className="btn btn-outline btn-sm mb-1 gap-2"
          >
            📷 {ocrBusy ? "Reading…" : "Scan nutrition label"}
          </button>
        )}
        {ocrMsg && <div className="mb-1 text-xs text-base-content/60">{ocrMsg}</div>}
        {ocrPreview && (
          <div className="mb-1">
            <div className="text-[11px] text-base-content/40">Sent to scanner · {ocrInfo}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ocrPreview}
              alt="Image sent to the scanner"
              className="mt-1 max-h-44 rounded-lg border border-base-300"
            />
          </div>
        )}
        {ocrText && (
          <details className="mb-1 text-xs text-base-content/50">
            <summary className="cursor-pointer">What the scanner read</summary>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200 p-2 text-[11px] leading-tight">
              {ocrText}
            </pre>
          </details>
        )}

        {cropFile && (
          <LabelCropper
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onConfirm={scanCrop}
          />
        )}

        <div className="flex flex-col divide-y divide-base-300 rounded-2xl border border-base-300">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span
                className={`text-sm ${
                  f.label.startsWith("—") ? "text-base-content/45" : "text-base-content/80"
                }`}
              >
                {f.label}
              </span>
              <span className="flex items-center gap-2">
                <NumberField
                  min={0}
                  value={n[f.key]}
                  onChange={(v) => set(f.key, v)}
                  className="input input-bordered input-sm w-24 text-right tabular-nums"
                />
                <span className="w-8 text-xs text-base-content/40">{f.unit}</span>
              </span>
            </label>
          ))}
        </div>

        {Math.abs(kcalFromMacros - n.kcal) > 5 && (
          <button
            className="mt-2 text-xs text-primary hover:underline"
            onClick={() => set("kcal", kcalFromMacros)}
          >
            Set calories from macros ≈ {kcalFromMacros} kcal
          </button>
        )}

        <div className="mt-5 flex gap-2">
          {editingCustom && (
            <button className="btn btn-ghost text-error" disabled={busy} onClick={remove}>
              Delete
            </button>
          )}
          <button
            className="btn btn-primary flex-1"
            disabled={busy || !name.trim()}
            onClick={save}
          >
            {editingCustom ? "Save changes" : "Save food"}
          </button>
        </div>
      </div>
    </div>
  );
}
