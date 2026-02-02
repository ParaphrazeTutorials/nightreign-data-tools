import { normalizeLower } from "./logic.js";
import {
  chaliceData,
  setChalicesByCharacter,
  selectedClass,
  selectedChaliceId,
  setSelectedChaliceId
} from "./state.js";

// ==================== Data ====================

/**
 * Filter chalices by the currently selected character (or return all when unset).
 * @returns {Array<object>} Filtered chalice entries.
 */
export function filteredChalices() {
  if (!Array.isArray(chaliceData) || !chaliceData.length) return [];
  if (!selectedClass) return chaliceData.filter(entry => (entry?.chalicename || "").toString().trim());
  const target = normalizeLower(selectedClass);
  return chaliceData.filter(entry => normalizeLower(entry?.character || "") === target);
}

/**
 * Group chalice data by character and sort each group alphabetically.
 * @param {Array<object>} list Raw chalice data rows.
 */
export function indexChaliceData(list) {
  const grouped = new Map();
  for (const entry of list || []) {
    const char = (entry?.character || "").toString().trim();
    if (!char) continue;
    if (!grouped.has(char)) grouped.set(char, []);
    grouped.get(char).push(entry);
  }

  for (const [, arr] of grouped.entries()) {
    arr.sort((a, b) => String(a?.chalicename || "").localeCompare(String(b?.chalicename || "")));
  }

  setChalicesByCharacter(grouped);

  if (selectedChaliceId == null) setSelectedChaliceId("");
}
