import { describe, expect, it } from "vitest";

import { categoryColorFor, SEQ_CATEGORY_BASES } from "../Reliquary/modules/theme.js";
import { EFFECT_COLOR_BASES, effectCategoryBase } from "../scripts/ui/palette.js";

describe("categoryColorFor", () => {
  it("uses canonical colors for known categories", () => {
    const base = effectCategoryBase("Attack Power");
    const theme = categoryColorFor("Attack Power");
    expect(theme.base).toBe(base);
    expect(theme.shades).toHaveLength(3);
  });

  it("returns reserved palette for curse categories", () => {
    const theme = categoryColorFor("Minor Curse");
    expect(theme.base).toBe(EFFECT_COLOR_BASES.curseBase);
    expect(theme.shades[1]).toBe(EFFECT_COLOR_BASES.curseBase);
  });

  it("falls back to default base for empty categories", () => {
    const theme = categoryColorFor("");
    expect(theme.base).toBe(EFFECT_COLOR_BASES.defaultBase);
  });

  it("assigns deterministic sequence colors for unknown categories", () => {
    const themeOne = categoryColorFor("Mystery");
    const themeTwo = categoryColorFor("Mystery");
    expect(themeOne.base).toBe(themeTwo.base);
    expect(SEQ_CATEGORY_BASES).toContain(themeOne.base);
  });
});
