"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import BarcodeScanner from "@/components/BarcodeScanner";
import ComponentsEditor from "@/components/ComponentsEditor";
import FoodEditor from "@/components/FoodEditor";
import MealPicker from "@/components/MealPicker";
import NumberField from "@/components/NumberField";
import { addEntry, allCustomFoods, allMeals, localDate, logMeal, saveCustomFood } from "@/lib/db";
import { searchAllFoods } from "@/lib/foods";
import { defaultMealSlot, isMealSlot } from "@/lib/mealSlots";
import { lookupBarcode } from "@/lib/off";
import { scale } from "@/lib/macros";
import type { Food, Meal, MealComponent, MealSlot } from "@/lib/types";

function dayLabel(date: string): string {
  if (date === localDate()) return "today";
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function AddPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => localDate());
  const [meal, setMeal] = useState<MealSlot>(() => defaultMealSlot());

  // The day + meal to log to are passed from Today via /add?date=…&meal=….
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date");
    if (d) setDate(d);
    const m = params.get("meal");
    if (isMealSlot(m)) setMeal(m);
  }, []);

  const meals = useLiveQuery(() => allMeals(), []);
  const customFoods = useLiveQuery(() => allCustomFoods(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);
  const [mealDraft, setMealDraft] = useState<{ meal: Meal; components: MealComponent[] } | null>(null);
  const [editorBase, setEditorBase] = useState<Food | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  async function handleBarcode(barcode: string) {
    setScanning(false);
    setScanMsg("Looking up…");
    try {
      const r = await lookupBarcode(barcode);
      if (r && r.hasNutrition) {
        await saveCustomFood(r.food); // keep it for next time (and sync it)
        setFood(r.food);
        setGrams(100);
        setScanMsg(null);
      } else if (r) {
        // Product exists but Open Food Facts has no usable nutrition — let the
        // user type it off the pack (prefilled with the name + barcode).
        setScanMsg(`“${r.food.name}” has no nutrition in Open Food Facts — add it from the label.`);
        openEditor(r.food);
      } else {
        setScanMsg(`Barcode ${barcode} isn't in Open Food Facts — add it as a custom food.`);
        openEditor(null);
      }
    } catch {
      setScanMsg("Lookup failed — check your connection and try again.");
    }
  }

  useEffect(() => {
    let active = true;
    searchAllFoods(query, customFoods ?? []).then((r) => active && setResults(r));
    return () => {
      active = false;
    };
  }, [query, customFoods]);

  const preview = useMemo(() => (food ? scale(food.per100g, grams) : null), [food, grams]);

  const back = () => router.push(`/?date=${date}`);

  async function logFood() {
    if (!food) return;
    setSaving(true);
    await addEntry({ date, foodId: food.id, foodName: food.name, grams, per100g: food.per100g, meal });
    back();
  }

  async function logMealInstance() {
    if (!mealDraft || mealDraft.components.length === 0) return;
    setSaving(true);
    await logMeal(mealDraft.meal, date, mealDraft.components, meal);
    back();
  }

  function openEditor(base: Food | null) {
    setEditorBase(base);
    setEditorOpen(true);
  }

  // --- Meal instance editor (tweak a serving before logging) ---
  if (mealDraft) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{mealDraft.meal.name}</h1>
          <button className="btn btn-ghost btn-sm" onClick={() => setMealDraft(null)}>
            ← Back
          </button>
        </div>
        <p className="text-xs text-base-content/50">
          Adjust this serving for <span className="font-medium">{dayLabel(date)}</span> — the saved
          meal won&apos;t change.
        </p>
        <MealPicker value={meal} onChange={setMeal} />
        <ComponentsEditor
          components={mealDraft.components}
          onChange={(c) => setMealDraft({ ...mealDraft, components: c })}
        />
        <button
          className="btn btn-primary"
          disabled={saving || mealDraft.components.length === 0}
          onClick={logMealInstance}
        >
          Log to {dayLabel(date)}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Add to {dayLabel(date)}</h1>
        <Link href={`/?date=${date}`} className="btn btn-ghost btn-sm">
          Done
        </Link>
      </div>

      {/* Your meals */}
      {meals && meals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Your meals
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {meals.map((m) => (
              <button
                key={m.id}
                onClick={() => setMealDraft({ meal: m, components: m.components.map((c) => ({ ...c })) })}
                className="flex shrink-0 flex-col items-start rounded-2xl border border-base-300 bg-base-100 px-3 py-2 text-left transition-colors hover:border-primary/50"
              >
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-xs text-base-content/50">
                  {Math.round(m.perServing.kcal)} kcal
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Food search + barcode scan */}
      <div className="flex gap-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods… (e.g. pollo)"
          className="input input-bordered w-full"
        />
        <button
          onClick={() => {
            setScanMsg(null);
            setScanning(true);
          }}
          className="btn btn-outline shrink-0"
          aria-label="Scan a barcode"
          title="Scan a barcode"
        >
          <ScanIcon />
        </button>
      </div>

      {scanMsg && <div className="px-1 text-xs text-base-content/60">{scanMsg}</div>}

      <ul className="flex flex-col gap-1.5">
        {results.map((f) => {
          const selected = food?.id === f.id;
          return (
            <li
              key={f.id}
              className={`flex items-center gap-1 rounded-2xl border transition-colors ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-base-300 bg-base-100 hover:border-primary/40"
              }`}
            >
              <button
                onClick={() => {
                  setFood(f);
                  setGrams(100);
                }}
                className="flex min-w-0 flex-1 items-center justify-between py-2.5 pl-4 pr-2 text-left"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{f.name}</span>
                    {f.custom && (
                      <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        custom
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-base-content/50">{f.category}</span>
                </span>
                <span className="shrink-0 pl-2 text-sm tabular-nums text-base-content/60">
                  {Math.round(f.per100g.kcal)}
                  <span className="text-base-content/30"> kcal/100g</span>
                </span>
              </button>
              <button
                onClick={() => openEditor(f)}
                className="mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-base-content/40 hover:bg-base-300/60 hover:text-base-content"
                aria-label={f.custom ? `Edit ${f.name}` : `Make a custom version of ${f.name}`}
                title={f.custom ? "Edit" : "Wrong macros? Make a custom version"}
              >
                <PencilIcon />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Always available: log something not in the database */}
      <button
        onClick={() => openEditor(null)}
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-base-300 py-3 text-sm text-base-content/60 transition-colors hover:border-primary/50 hover:text-base-content"
      >
        <span className="text-base leading-none">＋</span>
        {query.trim() ? `Add “${query.trim()}” as a custom food` : "Add a custom food"}
      </button>

      {/* Sticky food portion editor — pins to the bottom of the shell's scroll. */}
      {food && preview && (
        <div className="sticky bottom-2 z-40">
          <div className="rounded-3xl border border-base-300 bg-base-100/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="min-w-0 truncate font-semibold">{food.name}</span>
                <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setFood(null)}>
                  ✕
                </button>
              </div>
              <label className="flex items-center gap-3">
                <span className="text-sm text-base-content/60">Amount</span>
                <NumberField
                  inputMode="numeric"
                  min={0}
                  value={grams}
                  onChange={setGrams}
                  className="input input-bordered input-sm w-24 text-right tabular-nums"
                />
                <span className="text-sm text-base-content/60">g</span>
                <button
                  onClick={() => openEditor(food)}
                  className="ml-auto text-xs text-base-content/50 underline-offset-2 hover:text-primary hover:underline"
                >
                  {food.custom ? "Edit macros" : "Macros off?"}
                </button>
              </label>
              <div className="grid grid-cols-4 gap-1 text-center text-sm">
                <Stat label="kcal" value={Math.round(preview.kcal)} />
                <Stat label="P" value={preview.protein_g} />
                <Stat label="C" value={preview.carbs_g} />
                <Stat label="F" value={preview.fat_g} />
              </div>
              <MealPicker value={meal} onChange={setMeal} />
              <button className="btn btn-primary w-full" disabled={saving || grams <= 0} onClick={logFood}>
                {saving ? "Adding…" : `Add to ${dayLabel(date)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {editorOpen && (
        <FoodEditor
          base={editorBase}
          onClose={() => setEditorOpen(false)}
          onSaved={(f) => {
            setEditorOpen(false);
            setFood(f);
            setGrams(100);
          }}
        />
      )}

      {scanning && (
        <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" />
      <path d="M7 8v8M10 8v8M13 8v8M17 8v8" strokeLinecap="round" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-base-200 py-1.5">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-base-content/50">{label}</div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 20h9" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
