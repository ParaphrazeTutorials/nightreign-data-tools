// Pure logic helpers extracted from reliquary.js (no DOM access)
// ==================== Helpers ====================

/**
 * Clamp a value to the 0–1 range.
 * @param {number} v Value to clamp.
 * @returns {number} Clamped value.
 */
export function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

/**
 * Normalize a value to a trimmed string.
 * @param {unknown} v Input value.
 * @returns {string} Trimmed string.
 */
export function normalize(v) {
  return (v ?? "").toString().trim();
}

/**
 * Normalize a value to lower-case trimmed string.
 * @param {unknown} value Input value.
 * @returns {string} Lower-case trimmed string.
 */
export function normalizeLower(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

/**
 * Extract the compatibility id from a row as a string.
 * @param {object} row Data row.
 * @returns {string} Compatibility id or empty string.
 */
export function compatId(row) {
  return row?.CompatibilityID == null ? "" : String(row.CompatibilityID);
}

/**
 * Group rows that share the same non-empty CompatibilityID; only include conflicts.
 * @param {Array<object>} rows Effect rows to evaluate.
 * @returns {Array<Array<object>>} Groups with duplicate compatibility ids.
 */
export function computeCompatDupGroups(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (!r) continue;
    const cid = compatId(r);
    if (!cid) continue;
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid).push(r);
  }
  return [...map.values()].filter(group => group.length > 1);
}

/**
 * Get normalized relic type for a row.
 * @param {object} row Data row.
 * @returns {string} Relic type value.
 */
export function relicTypeForRow(row) {
  return normalize(row?.RelicType);
}

/**
 * Get normalized effect category for a row.
 * @param {object} row Data row.
 * @returns {string} Effect category value.
 */
export function effectCategoryForRow(row) {
  return normalize(row?.EffectCategory);
}

/**
 * Derive sorted unique categories from a list of rows.
 * @param {Array<object>} list Rows to inspect.
 * @returns {Array<string>} Sorted category values.
 */
export function categoriesFor(list) {
  const set = new Set(list.map(effectCategoryForRow).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Filter rows by category value when provided.
 * @param {Array<object>} list Rows to filter.
 * @param {string} catValue Category to match.
 * @returns {Array<object>} Filtered rows.
 */
export function applyCategory(list, catValue) {
  const c = normalize(catValue);
  if (!c) return list;
  return list.filter(r => effectCategoryForRow(r) === c);
}

/**
 * Filter rows by relic type, honoring shared/both types.
 * @param {Array<object>} rows Rows to filter.
 * @param {string} selectedType Selected relic type.
 * @returns {Array<object>} Filtered rows.
 */
export function baseFilteredByRelicType(rows, selectedType) {
  const type = normalize(selectedType);

  return rows.filter(r => {
    const t = relicTypeForRow(r);

    // Empty/placeholder or "All" means no filtering
    if (!type || type === "All") return true;

    if (type === "Standard") return t === "Standard" || t === "Both";
    if (type === "Depth Of Night") return t === "Depth Of Night" || t === "Both";

    return true;
  });
}

/**
 * Eligible effect list after applying type, taken, and compatibility filters.
 * @param {Array<object>} rows Source rows.
 * @param {string} selectedType Selected relic type.
 * @param {Set<string>} blockedCompatIds Compatibility ids already blocked.
 * @param {Set<string>} takenIds Effect ids already chosen.
 * @param {boolean} showIllegal Whether to include illegal options.
 * @returns {Array<object>} Filtered eligible rows.
 */
export function eligibleList(rows, selectedType, blockedCompatIds, takenIds, showIllegal) {
  const pool = baseFilteredByRelicType(rows, selectedType);

  return pool.filter(r => {
    const id = String(r.EffectID);
    if (takenIds.has(id)) return false;
    if (showIllegal) return true;

    const cid = compatId(r);
    if (!cid) return true;
    return !blockedCompatIds.has(cid);
  });
}

/**
 * Suggest a relic type when selecting Effect 1 while the type is unset/all.
 * @param {string} currentType Current type selection.
 * @param {object|null} effect1Row Chosen effect row.
 * @returns {"Standard"|"Depth Of Night"|null} Auto-selected type or null.
 */
// If user is on Relic Type = All and picks Effect 1, return the type to auto-set (or null)
export function autoRelicTypeFromEffect1(currentType, effect1Row) {
  if (!effect1Row) return null;

  // Only auto-set when dropdown is unset/placeholder or explicitly All
  if (currentType && currentType !== "All") return null;

  const t = relicTypeForRow(effect1Row);
  if (t === "Standard" || t === "Depth Of Night") return t;

  // If effect is "Both", do not force a type
  return null;
}