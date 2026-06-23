// Run with: node --test --experimental-strip-types src/lib/macros.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { scale, sum, remaining } from "./macros.ts";

const parmigiano = {
  kcal: 392,
  protein_g: 33.5,
  carbs_g: 0,
  sugars_g: 0,
  fat_g: 28.1,
  saturated_g: 19.5,
  fiber_g: 0,
};

test("scale: 150g of Parmigiano", () => {
  const m = scale(parmigiano, 150);
  assert.equal(m.kcal, 588); // 392 * 1.5
  assert.equal(m.protein_g, 50.3); // 33.5 * 1.5 = 50.25 -> 50.3
  assert.equal(m.fat_g, 42.2); // 28.1 * 1.5 = 42.15 -> 42.2
});

test("scale: zero grams is all zeros", () => {
  const m = scale(parmigiano, 0);
  assert.equal(m.kcal, 0);
  assert.equal(m.protein_g, 0);
});

test("sum: adds two portions", () => {
  const total = sum([scale(parmigiano, 100), scale(parmigiano, 100)]);
  assert.equal(total.kcal, 784);
  assert.equal(total.protein_g, 67);
});

test("remaining: never negative", () => {
  assert.equal(remaining(2000, 1500), 500);
  assert.equal(remaining(2000, 2500), 0);
});
