// Shared UI theming utilities used across Reliquary and Lexicon
// Keeps gradients and category palettes in one place.
// ==================== Helpers ====================

import { categoriesFor as reliquaryCategoriesFor } from "../../Reliquary/modules/logic.js";
import {
  ALL_THEME,
  categoryColorFor,
  gradientFromTheme,
  textColorFor
} from "../../Reliquary/modules/theme.js";

/**
 * Build a category → theme map for Reliquary-style datasets (categories derived from rows).
 * @param {Array<object>} rows Data rows to derive categories from.
 * @returns {Map<string, import("../../Reliquary/modules/theme.js").Theme>} Map of category to theme colors.
 */
export function buildCategoryThemeMap(rows) {
  if (!Array.isArray(rows) || !rows.length) return new Map();

  const map = new Map();
  map.set("__default", categoryColorFor(""));
  map.set("Uncategorized", categoryColorFor("Uncategorized"));

  const cats = reliquaryCategoriesFor(rows);

  cats.forEach(cat => {
    if (map.has(cat)) return;
    map.set(cat, categoryColorFor(cat));
  });

  return map;
}

/**
 * Build category palette for Reliquary menus given an explicit category list.
 * @param {Array<string>} catList Categories to include.
 * @returns {Map<string, import("../../Reliquary/modules/theme.js").Theme>} Map of category to theme colors.
 */
export function buildCategoryThemes(catList) {
  const map = new Map();

  const defaultCategoryTheme = categoryColorFor("");
  const uncategorizedTheme = categoryColorFor("Uncategorized");

  map.set("__default", defaultCategoryTheme);
  map.set("__all", ALL_THEME);
  map.set("Uncategorized", uncategorizedTheme);

  (catList || []).forEach(cat => {
    if (map.has(cat)) return;
    map.set(cat, categoryColorFor(cat));
  });

  return map;
}

export { gradientFromTheme, textColorFor };
