#!/usr/bin/env python3
"""Build the Pasto food database (foods.json) from a CREA-format CSV.

The app reads a single bundled `foods.json`; it never calls a nutrition API at
runtime. This script is the one place that turns source data into that file, so
re-running it on an updated CREA export regenerates the whole database.

Usage:
    python build_foods.py                       # uses the curated bootstrap CSV
    python build_foods.py --input crea_full.csv # full CREA export
    python build_foods.py --output ../app/public/foods.json

Input CSV columns (per 100 g of edible food):
    name, name_en, category, kcal, protein_g, carbs_g, sugars_g,
    fat_g, saturated_g, fiber_g

To ingest the full CREA / alimentinutrizione.it export, map its column names to
the ones above in COLUMN_ALIASES below, then run with --input.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
DEFAULT_INPUT = HERE / "data" / "crea_bootstrap.csv"
DEFAULT_OUTPUT = HERE.parent / "app" / "public" / "foods.json"

# Per-100g nutrient fields kept for every food.
NUTRIENTS = [
    "kcal",
    "protein_g",
    "carbs_g",
    "sugars_g",
    "fat_g",
    "saturated_g",
    "fiber_g",
]

# Map alternative source column names -> our canonical names. Extend this when
# loading the full CREA export (its headers differ from the bootstrap CSV).
COLUMN_ALIASES = {
    "nome": "name",
    "alimento": "name",
    "categoria": "category",
    "energia_kcal": "kcal",
    "energia": "kcal",
    "proteine": "protein_g",
    "carboidrati": "carbs_g",
    "carboidrati_disponibili": "carbs_g",
    "zuccheri": "sugars_g",
    "lipidi": "fat_g",
    "grassi": "fat_g",
    "acidi_grassi_saturi": "saturated_g",
    "fibra": "fiber_g",
    "fibra_totale": "fiber_g",
}


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[àáâ]", "a", text)
    text = re.sub(r"[èé]", "e", text)
    text = re.sub(r"[ìí]", "i", text)
    text = re.sub(r"[òó]", "o", text)
    text = re.sub(r"[ùú]", "u", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def num(value: str | None) -> float:
    """Parse a number, tolerating commas, blanks, and 'tr'/'n.d.' markers."""
    if value is None:
        return 0.0
    value = value.strip().replace(",", ".")
    if value in ("", "tr", "n.d.", "nd", "-"):
        return 0.0
    try:
        return round(float(value), 2)
    except ValueError:
        return 0.0


def canonicalize(field: str) -> str:
    field = field.strip().lower()
    return COLUMN_ALIASES.get(field, field)


def load_rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        try:
            header = [canonicalize(c) for c in next(reader)]
        except StopIteration:
            return []
        rows = []
        for raw in reader:
            if not any(cell.strip() for cell in raw):
                continue
            rows.append(dict(zip(header, raw)))
        return rows


def build(rows: list[dict]) -> list[dict]:
    foods: list[dict] = []
    seen_ids: set[str] = set()
    skipped = 0

    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            skipped += 1
            continue

        food_id = f"crea-{slugify(name)}"
        # Guarantee uniqueness if two foods slugify to the same id.
        base_id, n = food_id, 2
        while food_id in seen_ids:
            food_id = f"{base_id}-{n}"
            n += 1
        seen_ids.add(food_id)

        foods.append(
            {
                "id": food_id,
                "name": name,
                "name_en": (row.get("name_en") or "").strip() or None,
                "category": (row.get("category") or "Altro").strip(),
                "per100g": {key: num(row.get(key)) for key in NUTRIENTS},
            }
        )

    if skipped:
        print(f"  ! skipped {skipped} row(s) with no name", file=sys.stderr)

    foods.sort(key=lambda f: (f["category"], f["name"]))
    return foods


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Pasto foods.json from a CREA CSV")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--source-name",
        default="CREA - Tabelle di Composizione degli Alimenti (curated bootstrap)",
        help="Attribution string written into the food records' meta",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 1

    rows = load_rows(args.input)
    foods = build(rows)
    if not foods:
        print("No foods produced — check the input CSV.", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": args.source_name,
        "source_url": "https://www.alimentinutrizione.it",
        "unit": "per 100 g edible portion",
        "count": len(foods),
        "foods": foods,
    }
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    categories = sorted({f["category"] for f in foods})
    print(f"Wrote {len(foods)} foods -> {args.output}")
    print(f"  categories ({len(categories)}): {', '.join(categories)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
