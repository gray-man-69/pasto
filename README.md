# Pasto 🍽️

A local-first **macro tracker** built on **reliable Italian (CREA) nutritional
values**. Set your daily macro goals, log what you eat, watch your totals.
Installable as a PWA on your phone; works offline; all data stays on your device.

## How it works

```
pipeline/  Python ETL: CREA food table (CSV)  ->  app/public/foods.json  (built once)
app/       Next.js PWA: bundles foods.json, logs meals to IndexedDB on-device
```

- **No backend, no login.** The food database ships inside the app; your log and
  goals live in your browser's IndexedDB (via Dexie).
- Generic Italian foods come from **CREA** (the seed database). Packaged/branded
  products can later be added via **Open Food Facts** barcode lookup.

## Run it

```bash
# 1. Build the food database (writes app/public/foods.json)
cd pipeline
python3 build_foods.py

# 2. Start the app
cd ../app
npm install
npm run dev          # http://localhost:3000
# or: npm run build && npm start   (production)
npm test             # macro math unit tests
```

Open the app, set your goals (Goals tab — manual or the TDEE calculator),
then Add food → search → set grams → log. The Today tab shows totals vs goals.

## Updating the food data

`app/public/foods.json` is generated — never edit it by hand. Edit the source
CSV and re-run the pipeline:

```bash
cd pipeline
python3 build_foods.py                  # uses data/crea_bootstrap.csv
python3 build_foods.py --input crea_full.csv   # full CREA export
```

The bundled `data/crea_bootstrap.csv` is a **curated starter set** of ~45 common
Italian foods. To use the full CREA tables (~1,000 foods), download the export
(e.g. the CREA food-composition Kaggle dataset), map its columns in
`COLUMN_ALIASES` inside `build_foods.py`, and run with `--input`. **Verify values
against the official portal** before trusting any export.

## Data sources & attribution

- **CREA — Tabelle di Composizione degli Alimenti** (ex-INRAN), the official
  Italian food composition tables. Free to use with attribution.
  <https://www.alimentinutrizione.it>
- **Open Food Facts** (optional barcode lookups), open data under ODbL.
  <https://world.openfoodfacts.org>

## Stack

Python (stdlib) pipeline · Next.js 16 + React 19 · Tailwind 4 + DaisyUI 5 ·
Dexie (IndexedDB) · Fuse.js (search).
