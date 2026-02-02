import { describe, expect, it } from "vitest";

import { computeRollOrderIssue, getRollValue } from "../Reliquary/modules/rollOrder.js";

describe("getRollValue", () => {
  it("treats missing or invalid roll orders as infinity", () => {
    expect(getRollValue({ RollOrder: "" })).toBe(Number.POSITIVE_INFINITY);
    expect(getRollValue({})).toBe(Number.POSITIVE_INFINITY);
    expect(getRollValue({ RollOrder: null })).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns numeric roll order when present", () => {
    expect(getRollValue({ RollOrder: "2" })).toBe(2);
    expect(getRollValue({ RollOrder: 1 })).toBe(1);
  });
});

describe("computeRollOrderIssue", () => {
  const row1 = { EffectID: 1, RollOrder: 1 };
  const row2 = { EffectID: 2, RollOrder: 2 };
  const row3 = { EffectID: 3, RollOrder: 3 };

  it("returns no issue when already sorted", () => {
    const result = computeRollOrderIssue(row1, row2, row3);
    expect(result.hasIssue).toBe(false);
    expect(result.sorted).toEqual([row1, row2, row3]);
    expect(result.movedSlots).toEqual([false, false, false]);
    expect(result.moveDeltaBySlot).toEqual([0, 0, 0]);
  });

  it("detects out-of-order rows and provides deltas", () => {
    const result = computeRollOrderIssue(row3, row1, row2);
    expect(result.hasIssue).toBe(true);
    expect(result.sorted.map(r => r?.EffectID)).toEqual([1, 2, 3]);
    expect(result.movedSlots).toEqual([true, true, true]);
    expect(result.moveDeltaBySlot).toEqual([2, -1, -1]);
  });

  it("handles sparse selections without errors", () => {
    const result = computeRollOrderIssue(row2, null, row1);
    expect(result.hasIssue).toBe(true);
    expect(result.sorted.map(r => r?.EffectID)).toEqual([1, undefined, 2]);
    expect(result.movedSlots).toEqual([true, false, true]);
  });
});
