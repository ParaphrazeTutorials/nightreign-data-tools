// Paths + image helpers (ALL Asset casing respected)

const PAGE_BASE = (typeof window !== "undefined" && window.location?.href)
  ? window.location.href
  : "http://localhost/";

const ASSET_PREFIX = "../Assets/";

// Explicit list keeps Pages URLs stable and discoverable.
export const STATUS_ICON_PATHS = Object.freeze({
  20006: "icons/reliquary/20006.png",
  20013: "icons/reliquary/20013.png",
  20014: "icons/reliquary/20014.png",
  20015: "icons/reliquary/20015.png",
  20060: "icons/reliquary/20060.png",
  20068: "icons/reliquary/20068.png",
  20069: "icons/reliquary/20069.png",
  20206: "icons/reliquary/20206.png",
  20207: "icons/reliquary/20207.png",
  20208: "icons/reliquary/20208.png",
  20222: "icons/reliquary/20222.png",
  20260: "icons/reliquary/20260.png",
  20267: "icons/reliquary/20267.png",
  20268: "icons/reliquary/20268.png",
  20269: "icons/reliquary/20269.png",
  20291: "icons/reliquary/20291.png",
  20292: "icons/reliquary/20292.png",
  20293: "icons/reliquary/20293.png",
  20295: "icons/reliquary/20295.png",
  20296: "icons/reliquary/20296.png",
  20297: "icons/reliquary/20297.png",
  20302: "icons/reliquary/20302.png",
  20315: "icons/reliquary/20315.png",
  20408: "icons/reliquary/20408.png",
  20429: "icons/reliquary/20429.png",
  20491: "icons/reliquary/20491.png",
  20492: "icons/reliquary/20492.png",
  20980: "icons/reliquary/20980.png",
  20981: "icons/reliquary/20981.png",
  20982: "icons/reliquary/20982.png",
  20983: "icons/reliquary/20983.png",
  20984: "icons/reliquary/20984.png",
  20985: "icons/reliquary/20985.png",
  20986: "icons/reliquary/20986.png"
});

export const RELIC_COLORS = Object.freeze(["blue", "green", "red", "yellow"]);
export const RELIC_SIZES = Object.freeze(["small", "medium", "large"]);

function assetUrl(relativePath) {
  return new URL(relativePath, PAGE_BASE).toString();
}

export const DATA_URL = assetUrl("../Data/reliquary.json");
export const CHALICE_DATA_URL = assetUrl("../Data/chalicedata.json");
export const EFFECT_STATS_URL = assetUrl("../Data/effectstats.json");

const ALERT_ICON_FILES = Object.freeze({
  warning: "icons/reliquary/chalice-warning.svg",
  error: "icons/reliquary/chalice-error.svg"
});

// Icon folder:
// Assets/icons/reliquary/{StatusIconID}.png
export function iconPath(statusIconId) {
  if (!statusIconId) return "";
  const key = String(statusIconId).trim();
  const relative = STATUS_ICON_PATHS[key] || `icons/reliquary/${key}.png`;
  return assetUrl(`${ASSET_PREFIX}${relative}`);
}

// Chalice art placeholders: Assets/chalices/{chaliceIconID}.png
export function chalicePlaceholderPath(chaliceIconId) {
  const key = (chaliceIconId ?? "").toString().trim();
  const relative = key ? `chalices/${key}.png` : "chalices/placeholder.png";
  return assetUrl(`${ASSET_PREFIX}${relative}`);
}

export function alertIconUrl(kind) {
  const key = kind === "error" ? "error" : "warning";
  const file = ALERT_ICON_FILES[key];
  return assetUrl(`${ASSET_PREFIX}${file}`);
}

// Default relic images (confirmed filenames)
export function relicDefaultPath(relicType) {
  const type = visualRelicType(relicType);
  const file = type === "Depth Of Night" ? "depth_of_night.png" : "standard.png";
  return assetUrl(`${ASSET_PREFIX}relics/default/${file}`);
}

// Colored relics: Assets/relics/{type}/{size}/{color}.png
export function relicFolderForType(relicType) {
  // IMPORTANT: folder is depth_of_night (not depth)
  return relicType === "Depth Of Night" ? "depth_of_night" : "standard";
}

function normalizedRelicColor(color) {
  const normalized = String(color || "").trim().toLowerCase();
  return RELIC_COLORS.includes(normalized) ? normalized : RELIC_COLORS[0];
}

function normalizedRelicSize(size) {
  const normalized = String(size || "").trim().toLowerCase();
  return RELIC_SIZES.includes(normalized) ? normalized : RELIC_SIZES[0];
}

export function relicPath(relicType, color, size) {
  const type = relicFolderForType(relicType);
  const c = normalizedRelicColor(color);
  const s = normalizedRelicSize(size);
  return assetUrl(`${ASSET_PREFIX}relics/${type}/${s}/${c}.png`);
}

// When type is unset/All, visuals should behave like Standard
export function visualRelicType(selectedType) {
  if (!selectedType || selectedType === "All") return "Standard";
  return selectedType;
}