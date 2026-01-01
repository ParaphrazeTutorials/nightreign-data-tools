// Pure logic helpers (no DOM)

export const COLORS = ["Red", "Blue", "Yellow", "Green"];

// Category color configuration (non-purple palette by default; purple reserved for curses)
// Sequential palette bases (walked in order across categories; purple reserved for curses)
export const SEQ_CATEGORY_BASES = [
  "#702020", // dark red (All)
  "#8a232a", // deep red
  "#b43a22", // ember
  "#c66a1c", // orange
  "#d48b1c", // amber
  "#c9a42d", // warm yellow
  "#b6b02d", // yellow-green
  "#5d8ac7", // mid blue
  "#3f7fb8", // steel blue
  "#2f9d9f", // teal
  "#3f9d58", // green
  "#5ca34d"  // soft green
];

const CURSE_COLOR_BASE = "#7a4bc6"; // reserved purple for curse-related categories

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function hexToHsl(hex) {
  const sanitized = hex.replace("#", "");
  const bigint = parseInt(sanitized, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h, s, l };
}

function hslToHex(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  let p = 2 * l - q;

  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  const toHex = x => {
    const v = Math.round(x * 255).toString(16).padStart(2, "0");
    return v;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function adjustLightness(hex, delta) {
  const { h, s, l } = hexToHsl(hex);
  const nextL = clamp01(l + delta);
  return hslToHex(h, s, nextL);
}

export function themeFromBase(base) {
  const shades = [adjustLightness(base, -0.2), base, adjustLightness(base, 0.16)];
  return { base, shades, border: adjustLightness(base, -0.22) };
}

export function baseFromSequence(idx) {
  const seq = SEQ_CATEGORY_BASES;
  if (idx < seq.length) return seq[idx];

  // When we exhaust the fixed list, continue rotating hue forward without wrapping to prior reds
  const last = seq[seq.length - 1];
  const { h, s, l } = hexToHsl(last);
  const step = 18 / 360; // 18° hue step per extra category
  const n = idx - seq.length + 1;
  const nextH = (h + step * n) % 1;
  return hslToHex(nextH, s, l);
}

export const ALL_THEME = themeFromBase("#702020");

function hashCategory(cat) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) {
    h = (h * 31 + cat.charCodeAt(i)) >>> 0;
  }
  return h;
}

function isCurseCategory(cat) {
  return /curse/i.test(cat);
}

export function categoryColorFor(category) {
  const cat = normalize(category);

  // Special handling for curses: reserve purple tones
  if (isCurseCategory(cat)) {
    const base = CURSE_COLOR_BASE;
    const shades = [adjustLightness(base, -0.22), base, adjustLightness(base, 0.18)];
    return { base, shades, border: adjustLightness(base, -0.25) };
  }

  if (!cat) {
    const base = "#2b2f38";
    const shades = [adjustLightness(base, -0.16), base, adjustLightness(base, 0.14)];
    return { base, shades, border: adjustLightness(base, -0.22) };
  }

  const palette = SEQ_CATEGORY_BASES;
  const idx = hashCategory(cat) % palette.length;
  const base = palette[idx];
  return themeFromBase(base);
}

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
