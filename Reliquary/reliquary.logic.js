// Pure logic helpers (no DOM)

export const COLORS = ["Red", "Blue", "Yellow", "Green"];

export function normalize(v) {
  return (v ?? "").toString().trim();
}

export function compatId(row) {
  return row?.CompatibilityID == null ? "" : String(row.CompatibilityID);
}

export function relicTypeForRow(row) {
  return normalize(row?.RelicType);
}

export function effectCategoryForRow(row) {
  return normalize(row?.EffectCategory);
}

export function categoriesFor(list) {
  const set = new Set(list.map(effectCategoryForRow).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function applyCategory(list, catValue) {
  const c = normalize(catValue);
  if (!c) return list;
  return list.filter(r => effectCategoryForRow(r) === c);
}

export function baseFilteredByRelicType(rows, selectedType) {
  return rows.filter(r => {
    const t = relicTypeForRow(r);

    if (selectedType === "All") return true;
    if (selectedType === "Both") return t === "Both";
    if (selectedType === "Standard") return (t === "Standard" || t === "Both");
    if (selectedType === "Depth Of Night") return (t === "Depth Of Night" || t === "Both");

    return true;
  });
}

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

// If user is on Relic Type = All and picks Effect 1, return the type to auto-set (or null)
export function autoRelicTypeFromEffect1(currentType, effect1Row) {
  if (!effect1Row) return null;
  if (currentType !== "All") return null;

  const t = relicTypeForRow(effect1Row);
  if (t === "Standard" || t === "Depth Of Night" || t === "Both") return t;

  return null;
}
