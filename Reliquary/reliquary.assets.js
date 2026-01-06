// Paths + image helpers (ALL Asset casing respected)

export const DATA_URL = new URL("../Data/reliquary.json", window.location.href).toString();
export const CHALICE_DATA_URL = new URL("../Data/chalicedata.json", window.location.href).toString();


// Icon folder:
// Assets/icons/reliquary/{StatusIconID}.png
export function iconPath(statusIconId) {
  if (!statusIconId) return "";
  return new URL(`../Assets/icons/reliquary/${statusIconId}.png`, window.location.href).toString();
}

// Default relic images (confirmed filenames)
export function relicDefaultPath(relicType) {
  const file = (relicType === "Depth Of Night") ? "depth_of_night.png" : "standard.png";
  return new URL(`../Assets/relics/default/${file}`, window.location.href).toString();
}

// Colored relics: Assets/relics/{type}/{size}/{color}.png
export function relicFolderForType(relicType) {
  // IMPORTANT: folder is depth_of_night (not depth)
  return relicType === "Depth Of Night" ? "depth_of_night" : "standard";
}

export function relicPath(relicType, color, size) {
  const type = relicFolderForType(relicType);
  const c = String(color).toLowerCase();
  const s = String(size).toLowerCase();
  return new URL(`../Assets/relics/${type}/${s}/${c}.png`, window.location.href).toString();
}

// When type is unset/All, visuals should behave like Standard
export function visualRelicType(selectedType) {
  if (!selectedType || selectedType === "All") return "Standard";
  return selectedType;
}