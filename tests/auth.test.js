import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateRank } from "../convex/auth.js";

test("calculateRank returns the lowest rank below every threshold", () => {
  assert.equal(calculateRank(0), "2nd Lieutenant");
  assert.equal(calculateRank(999), "2nd Lieutenant");
});

test("calculateRank promotes at each score threshold", () => {
  assert.equal(calculateRank(1000), "Captain");
  assert.equal(calculateRank(3000), "Major");
  assert.equal(calculateRank(6000), "Colonel");
  assert.equal(calculateRank(12000), "Brigadier");
  assert.equal(calculateRank(25000), "Balidan Director");
  assert.equal(calculateRank(999999), "Balidan Director");
});
