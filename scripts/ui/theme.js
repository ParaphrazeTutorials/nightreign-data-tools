// Shared UI theming utilities used across Reliquary and Lexicon
// Keeps gradients and category palettes in one place.

import {
  ALL_THEME,
  baseFromSequence,
  categoryColorFor,
  categoriesFor as reliquaryCategoriesFor,
  themeFromBase,
  textColorFor
} from "../../Reliquary/reliquary.logic.js";

export function gradientFromTheme(theme) {
  if (!theme) return "rgba(40, 40, 44, 0.85)";
  const shades = theme.shades || [];
  if (shades.length >= 3) {
    return `linear-gradient(135deg, ${shades[0]} 0%, ${shades[1]} 50%, ${shades[2]} 100%)`;
  }
  return theme.base || "rgba(40, 40, 44, 0.85)";
}

// Build category → theme map for Reliquary-style datasets (categories derived from rows)
export function buildCategoryThemeMap(rows) {
  if (!Array.isArray(rows) || !rows.length) return new Map();

  const map = new Map();
  const uncategorizedTheme = categoryColorFor("Uncategorized");

  map.set("__default", categoryColorFor(""));
  map.set("Uncategorized", uncategorizedTheme);

  const cats = reliquaryCategoriesFor(rows);
  let seqIdx = 0;

  cats.forEach(cat => {
    if (map.has(cat)) return;

    const isCurse = /curse/i.test(cat);
    if (isCurse) {
      map.set(cat, categoryColorFor(cat));
      return;
    }

    const base = baseFromSequence(seqIdx);
    seqIdx += 1;
    map.set(cat, themeFromBase(base));
  });

  return map;
}

// Build category palette for Reliquary menus given an explicit category list
export function buildCategoryThemes(catList) {
  const map = new Map();
  let seqIdx = 0;

  const defaultCategoryTheme = categoryColorFor("");
  const uncategorizedTheme = categoryColorFor("Uncategorized");

  map.set("__default", defaultCategoryTheme);
  map.set("__all", ALL_THEME);
  map.set("Uncategorized", uncategorizedTheme);

  (catList || []).forEach(cat => {
    if (map.has(cat)) return;

    const isCurse = /curse/i.test(cat);
    if (isCurse) {
      map.set(cat, categoryColorFor(cat));
      return;
    }

    const base = baseFromSequence(seqIdx);
    seqIdx += 1;
    map.set(cat, themeFromBase(base));
  });

  return map;
}

export { textColorFor };
