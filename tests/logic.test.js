import { describe, expect, it } from "vitest";

import {
  compatId,
  computeCompatDupGroups,
  eligibleList,
  baseFilteredByRelicType
} from "../Reliquary/modules/logic.js";

const ROW_STD_A1 = { EffectID: 1, CompatibilityID: 7, RelicType: "Standard" };
const ROW_STD_A2 = { EffectID: 2, CompatibilityID: 7, RelicType: "Standard" };
const ROW_DEPTH = { EffectID: 3, CompatibilityID: "D", RelicType: "Depth Of Night" };
const ROW_BOTH = { EffectID: 4, CompatibilityID: "", RelicType: "Both" };

const SAMPLE_ROWS = [ROW_STD_A1, ROW_STD_A2, ROW_DEPTH, ROW_BOTH];

describe("compatibility helpers", () => {
  it("extracts normalized compatibility ids", () => {
    expect(compatId({ CompatibilityID: 10 })).toBe("10");
    expect(compatId({ CompatibilityID: null })).toBe("");
    expect(compatId(undefined)).toBe("");
  });

  it("groups only duplicate compatibility ids", () => {
    const groups = computeCompatDupGroups(SAMPLE_ROWS);
    expect(groups).toHaveLength(1);
    expect(groups[0].map(r => r.EffectID)).toEqual([1, 2]);
  });

  it("filters eligible list by type, taken ids, and compatibility blocks", () => {
    const blocked = new Set(["7"]);
    const taken = new Set();

    const filtered = eligibleList(SAMPLE_ROWS, "Standard", blocked, taken, false);
    expect(filtered.map(r => r.EffectID)).toEqual([4]);

    const filteredIllegal = eligibleList(SAMPLE_ROWS, "Standard", blocked, taken, true);
    expect(filteredIllegal.map(r => r.EffectID)).toEqual([1, 2, 4]);
  });

  it("allows Both types to pass either relic type filter", () => {
    const stdList = baseFilteredByRelicType(SAMPLE_ROWS, "Standard");
    expect(stdList.map(r => r.EffectID)).toEqual([1, 2, 4]);

    const depthList = baseFilteredByRelicType(SAMPLE_ROWS, "Depth Of Night");
    expect(depthList.map(r => r.EffectID)).toEqual([3, 4]);

    const allList = baseFilteredByRelicType(SAMPLE_ROWS, "All");
    expect(allList.map(r => r.EffectID)).toEqual([1, 2, 3, 4]);
  });
});
