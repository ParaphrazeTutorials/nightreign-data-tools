import { normalizeLower } from "./logic.js";
import {
  chaliceData,
  chalicesByCharacter,
  setChalicesByCharacter,
  selectedClass,
  selectedChaliceId,
  setSelectedChaliceId
} from "./state.js";

export function filteredChalices() {
  if (!Array.isArray(chaliceData) || !chaliceData.length) return [];
  if (!selectedClass) return chaliceData.filter(entry => (entry?.chalicename || "").toString().trim());
  const target = normalizeLower(selectedClass);
  return chaliceData.filter(entry => normalizeLower(entry?.character || "") === target);
}

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
