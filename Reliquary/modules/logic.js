// Pure logic helpers extracted from reliquary.js (no DOM access)

export function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

export function normalize(v) {
  return (v ?? "").toString().trim();
}

export function normalizeLower(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

export function compatId(row) {
  return row?.CompatibilityID == null ? "" : String(row.CompatibilityID);
}

// Group rows that share the same non-empty CompatibilityID; only return groups with conflicts (length > 1)
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

  // Only auto-set when dropdown is unset/placeholder or explicitly All
  if (currentType && currentType !== "All") return null;

  const t = relicTypeForRow(effect1Row);
  if (t === "Standard" || t === "Depth Of Night") return t;

  // If effect is "Both", do not force a type
  return null;
}