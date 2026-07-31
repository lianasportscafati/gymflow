import assert from "node:assert/strict";
import test from "node:test";
import { calculateWeight, parseWeight } from "../lib/weight";

test("calcola correttamente una percentuale con virgola decimale", () => {
  assert.equal(parseWeight("67,5"), 67.5);
  assert.equal(calculateWeight("67,5", 50), "33,75 kg");
});

test("non produce un carico senza entrambi i valori", () => {
  assert.equal(calculateWeight("", 50), "");
  assert.equal(calculateWeight("67,5", null), "");
});

test("calcola il 60 percento di 60 kg", () => {
  assert.equal(calculateWeight("60", 60), "36 kg");
});

test("calcola percentuali decimali senza arrotondarle a un intero", () => {
  assert.equal(calculateWeight("60", 57.5), "34,5 kg");
  assert.equal(calculateWeight("80", 69.3), "55,44 kg");
});
