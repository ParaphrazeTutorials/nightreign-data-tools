import { COLOR_SWATCHES, RANDOM_SWATCH } from "../../scripts/ui/palette.js";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[ch] || ch;
  });
}

export function swatchForColorName(name) {
  const normalized = name || "Random";
  if (normalized === "Random") return RANDOM_SWATCH;
  return COLOR_SWATCHES[normalized] || "#b9c2d0";
}

export function colorChipLabel(value, randomColor) {
  const v = value || "Random";
  if (v === "Random") return `Color: Random (${randomColor || "?"})`;
  return `Color: ${v}`;
}
