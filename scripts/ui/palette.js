// Centralized color tokens and CSS variable application for site-wide UI
// Gradients stay ASCII to avoid encoding issues.

export const COLORS = ["Red", "Blue", "Yellow", "Green"];

// Effect/category palette bases remain unchanged; surfaced here for shared use
export const EFFECT_COLOR_BASES = {
  sequence: [
    "#b12f45", // deep crimson
    "#0f8da4", // storm cyan
    "#5f8d1a", // moss green
    "#c74d2e", // ember coral
    "#1a5ba5", // dusk cobalt
    "#3e9c7c", // pine mint
    "#c67914", // burnt amber
    "#177f7f", // shadow teal
    "#b13c79", // wine rose
    "#c49a18", // dark goldenrod
    "#3a8a32", // forest leaf
    "#2d46b0"  // indigo royal
  ],
  curseBase: "#7a4bc6", // reserved purple for curse-related categories
  defaultBase: "#2b2f38"
};

// Effect category color canon pulled from the Reliquary Effect Category dropdown
// Key order matches the sorted dropdown order so previews stay aligned
export const EFFECT_CATEGORY_COLORS = {
  "Actions": "#b12f45",
  "Attack Power": "#0f8da4",
  "Attributes": "#5f8d1a",
  "Character Skills / Ultimate Arts": "#c74d2e",
  "Character-Specific": "#1a5ba5",
  "Damage Negation": "#3e9c7c",
  "Demerits (Actions)": "#c67914",
  "Demerits (Attributes)": "#177f7f",
  "Demerits (Damage Negation)": "#b13c79",
  "Environment": "#c49a18",
  "Restoration": "#3a8a32",
  "Sorceries / Incantations": "#2d46b0",
  "Starting Armaments (Skills/Spells)": "#b02d68",
  "Starting Armaments(Imbue)": "#8ab02d",
  "Starting Item": "#2dacb0",
  "Starting Item (Tear)": "#922db0",
  "Status Ailment Resistances": "#b0702d",
  "Team Members": "#2db04e",
  "Weapon Discovery": "#2d2eb0",
  "Weapon Specific": "#b02d50"
};

// UI swatches for the color chip selector
export const COLOR_SWATCHES = {
  Red: "linear-gradient(135deg, #642121, #b84242)",
  Blue: "linear-gradient(135deg, #1e4275, #3f7ad0)",
  Yellow: "linear-gradient(135deg, #645019, #b28d2c)",
  Green: "linear-gradient(135deg, #10482a, #2f8a52)"
};

export const RANDOM_SWATCH = "linear-gradient(135deg, #c94b4b, #3b82f6, #f2c94c, #2fa44a)";

// Known characters (order preserved for display heuristics)
export const CHARACTERS = [
  "Duchess",
  "Executor",
  "Guardian",
  "Ironeye",
  "Raider",
  "Recluse",
  "Revenant",
  "Scholar",
  "Undertaker",
  "Wylder"
];

// Dark, high-contrast bases per character (can be tuned later)
export const CHARACTER_COLORS = {
  duchess: { bg: "linear-gradient(135deg, #2e1a2b 0%, #5c345a 50%, #5c345a 100%)", border: "rgba(209, 144, 210, 0.7)", text: "#f7f0fa" },
  executor: { bg: "linear-gradient(135deg, #1f2c38 0%, #3a566a 50%, #3a566a 100%)", border: "rgba(140, 184, 220, 0.65)", text: "#eef6ff" },
  guardian: { bg: "linear-gradient(135deg, #1f3b2f 0%, #35644e 50%, #35644e 100%)", border: "rgba(140, 210, 175, 0.65)", text: "#e8fff4" },
  ironeye: { bg: "linear-gradient(135deg, #20303c 0%, #355269 50%, #355269 100%)", border: "rgba(140, 180, 210, 0.65)", text: "#e9f4ff" },
  raider: { bg: "linear-gradient(135deg, #3a231c 0%, #6a3a2a 50%, #6a3a2a 100%)", border: "rgba(230, 170, 135, 0.7)", text: "#fff3e9" },
  recluse: { bg: "linear-gradient(135deg, #1f1f32 0%, #3d3c61 50%, #3d3c61 100%)", border: "rgba(170, 160, 220, 0.7)", text: "#f2f3ff" },
  revenant: { bg: "linear-gradient(135deg, #2d2a3a 0%, #4b4760 50%, #4b4760 100%)", border: "rgba(190, 170, 230, 0.65)", text: "#f3f0ff" },
  scholar: { bg: "linear-gradient(135deg, #1f323d 0%, #345468 50%, #345468 100%)", border: "rgba(150, 195, 225, 0.68)", text: "#e9f6ff" },
  undertaker: { bg: "linear-gradient(135deg, #2d1f1f 0%, #4e3534 50%, #4e3534 100%)", border: "rgba(215, 150, 150, 0.65)", text: "#fff0f0" },
  wylder: { bg: "linear-gradient(135deg, #21311f 0%, #395339 50%, #395339 100%)", border: "rgba(170, 215, 150, 0.65)", text: "#f0fff0" }
};

// Build character art URLs relative to the current page so both local file:// and
// subpath-hosted dev servers resolve correctly.
function characterAssetUrl(file) {
  if (!file) return null;
  try {
    return new URL(`../Assets/characters/${file}`, window.location.href).toString();
  } catch (err) {
    // Fallback to a simple relative path if URL construction fails (e.g., non-browser env)
    return `../Assets/characters/${file}`;
  }
}

// Chip color tokens; keep gradients centralized
export const CHIP_COLORS = {
  curseYes: {
    bg: "linear-gradient(135deg, #4c2a80 0%, #8b5fd4 50%, #8b5fd4 100%)",
    border: "rgba(168, 120, 230, 0.7)",
    text: "#f7f1ff"
  },
  curseNo: {
    bg: "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.08) 100%)",
    border: "rgba(255, 255, 255, 0.14)",
    text: "rgba(245, 245, 245, 0.92)"
  },
  selfStackYes: {
    bg: "linear-gradient(135deg, #103828 0%, #27a06a 50%, #27a06a 100%)",
    border: "rgba(120, 230, 170, 0.8)",
    text: "#e9fff5"
  },
  selfStackNo: {
    bg: "linear-gradient(135deg, #3d1318 0%, #9b2f35 50%, #9b2f35 100%)",
    border: "rgba(255, 130, 150, 0.8)",
    text: "#ffeef2"
  },
  selfStackUnknown: {
    bg: "linear-gradient(135deg, #2e2f36 0%, #4b4e57 50%, #4b4e57 100%)",
    border: "rgba(255, 255, 255, 0.18)",
    text: "rgba(245, 245, 245, 0.92)"
  },
  placeholder: {
    bg: "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.08) 100%)",
    border: "rgba(255, 255, 255, 0.12)",
    text: "rgba(255, 255, 255, 0.9)"
  },
  character: {
    bg: "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.08) 100%)",
    border: "rgba(255, 255, 255, 0.16)",
    text: "rgba(245, 245, 245, 0.92)"
  },
  characterAll: {
    bg: "linear-gradient(135deg, #4c2a80 0%, #8b5fd4 50%, #8b5fd4 100%)", // reserved purple gradient for ALL
    border: "rgba(168, 120, 230, 0.7)",
    text: "#f7f1ff"
  }
};

// Relic type chips (Depth/Standard/Both)
export const RELIC_TYPE_COLORS = {
  depth: {
    bg: "linear-gradient(135deg, #1b1233 0%, #4b2d7a 50%, #7a4cc2 100%)",
    border: "rgba(180, 150, 255, 0.6)",
    text: "#f6f2ff"
  },
  standard: {
    bg: "linear-gradient(135deg, #0f213d 0%, #1f4f8a 50%, #2f7ad0 100%)",
    border: "rgba(135, 185, 245, 0.65)",
    text: "#e8f3ff"
  },
  both: {
    bg: "linear-gradient(135deg, #0f2b35 0%, #1f5a66 50%, #2f8896 100%)",
    border: "rgba(135, 210, 225, 0.6)",
    text: "#e7f9ff"
  }
};

// Button styling tokens (canonical gradients + states)
export const BUTTONS = {
  instructions: {
    bg: "linear-gradient(135deg, #5b3c9f 0%, #8f6bd8 55%, #2b1a4f 100%)",
    text: "#f5f0ff",
    border: "rgba(180, 150, 255, 0.55)",
    shadow: "0 8px 18px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06) inset",
    hoverBorder: "rgba(200, 175, 255, 0.8)",
    hoverFilter: "brightness(1.06)",
    activeFilter: "brightness(0.98)"
  },
  autoSort: {
    bg: "linear-gradient(135deg, #5b3c9f 0%, #8f6bd8 55%, #2b1a4f 100%)",
    text: "#f5f0ff",
    border: "rgba(180, 150, 255, 0.55)",
    shadow: "0 8px 18px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06) inset",
    hoverBorder: "rgba(200, 175, 255, 0.8)",
    hoverFilter: "brightness(1.06)",
    activeFilter: "brightness(0.98)"
  },
  startOver: {
    bg: "linear-gradient(135deg, #7a0b1a 0%, #c71f3a 50%, #3a0007 100%)",
    text: "#fff6f6",
    border: "rgba(255, 115, 115, 0.55)",
    shadow: "inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 8px 18px rgba(0, 0, 0, 0.5)",
    hoverBg: "linear-gradient(135deg, #8d0f24 0%, #da2646 50%, #4a000a 100%)",
    hoverBorder: "rgba(255, 145, 145, 0.75)",
    hoverFilter: "brightness(1.04)",
    activeBg: "linear-gradient(135deg, #6b0b19 0%, #b01c34 50%, #2b0005 100%)",
    focusOutline: "rgba(255, 145, 145, 0.85)"
  }
};

export function characterSlug(name) {
  return (name || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export function characterColors(name) {
  const slug = characterSlug(name);
  const token = CHARACTER_COLORS[slug];
  return token ? { ...token, slug } : { ...CHIP_COLORS.character, slug };
}

export function characterBackdrop(name) {
  const slug = characterSlug(name);
  if (!slug || slug === "unknown") return null;
  const url = characterAssetUrl(`${slug}_full_default.png`);
  return url ? `url("${url}")` : null;
}

export function characterPortrait(name) {
  const slug = characterSlug(name);
  if (!slug || slug === "unknown") return null;
  const url = characterAssetUrl(`${slug}_portrait.png`);
  return url ? `url("${url}")` : null;
}

export function randomPortrait() {
  const url = characterAssetUrl("random_portrait.png");
  return url ? `url("${url}")` : null;
}

function setVar(root, name, value) {
  if (!root || !name || value == null) return;
  root.style.setProperty(name, value);
}

// Push CSS variables to :root so CSS can stay declarative
export function applyPaletteCssVars(root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root) return;

  setVar(root, "--chip-curse-yes-bg", CHIP_COLORS.curseYes.bg);
  setVar(root, "--chip-curse-yes-border", CHIP_COLORS.curseYes.border);
  setVar(root, "--chip-curse-yes-text", CHIP_COLORS.curseYes.text);

  setVar(root, "--chip-curse-no-bg", CHIP_COLORS.curseNo.bg);
  setVar(root, "--chip-curse-no-border", CHIP_COLORS.curseNo.border);
  setVar(root, "--chip-curse-no-text", CHIP_COLORS.curseNo.text);

  setVar(root, "--chip-self-stack-yes-bg", CHIP_COLORS.selfStackYes.bg);
  setVar(root, "--chip-self-stack-yes-border", CHIP_COLORS.selfStackYes.border);
  setVar(root, "--chip-self-stack-yes-text", CHIP_COLORS.selfStackYes.text);

  setVar(root, "--chip-self-stack-no-bg", CHIP_COLORS.selfStackNo.bg);
  setVar(root, "--chip-self-stack-no-border", CHIP_COLORS.selfStackNo.border);
  setVar(root, "--chip-self-stack-no-text", CHIP_COLORS.selfStackNo.text);

  setVar(root, "--chip-self-stack-unknown-bg", CHIP_COLORS.selfStackUnknown.bg);
  setVar(root, "--chip-self-stack-unknown-border", CHIP_COLORS.selfStackUnknown.border);
  setVar(root, "--chip-self-stack-unknown-text", CHIP_COLORS.selfStackUnknown.text);

  setVar(root, "--chip-placeholder-bg", CHIP_COLORS.placeholder.bg);
  setVar(root, "--chip-placeholder-border", CHIP_COLORS.placeholder.border);
  setVar(root, "--chip-placeholder-text", CHIP_COLORS.placeholder.text);

  setVar(root, "--chip-character-bg", CHIP_COLORS.character.bg);
  setVar(root, "--chip-character-border", CHIP_COLORS.character.border);
  setVar(root, "--chip-character-text", CHIP_COLORS.character.text);

  setVar(root, "--chip-character-all-bg", CHIP_COLORS.characterAll.bg);
  setVar(root, "--chip-character-all-border", CHIP_COLORS.characterAll.border);
  setVar(root, "--chip-character-all-text", CHIP_COLORS.characterAll.text);

  // Relic types
  setVar(root, "--chip-relic-depth-bg", RELIC_TYPE_COLORS.depth.bg);
  setVar(root, "--chip-relic-depth-border", RELIC_TYPE_COLORS.depth.border);
  setVar(root, "--chip-relic-depth-text", RELIC_TYPE_COLORS.depth.text);

  setVar(root, "--chip-relic-standard-bg", RELIC_TYPE_COLORS.standard.bg);
  setVar(root, "--chip-relic-standard-border", RELIC_TYPE_COLORS.standard.border);
  setVar(root, "--chip-relic-standard-text", RELIC_TYPE_COLORS.standard.text);

  setVar(root, "--chip-relic-both-bg", RELIC_TYPE_COLORS.both.bg);
  setVar(root, "--chip-relic-both-border", RELIC_TYPE_COLORS.both.border);
  setVar(root, "--chip-relic-both-text", RELIC_TYPE_COLORS.both.text);

  // Buttons (canonical styles)
  setVar(root, "--btn-instructions-bg", BUTTONS.instructions.bg);
  setVar(root, "--btn-instructions-text", BUTTONS.instructions.text);
  setVar(root, "--btn-instructions-border", BUTTONS.instructions.border);
  setVar(root, "--btn-instructions-shadow", BUTTONS.instructions.shadow);
  setVar(root, "--btn-instructions-hover-border", BUTTONS.instructions.hoverBorder);
  setVar(root, "--btn-instructions-hover-filter", BUTTONS.instructions.hoverFilter);
  setVar(root, "--btn-instructions-active-filter", BUTTONS.instructions.activeFilter);

  setVar(root, "--btn-auto-sort-bg", BUTTONS.autoSort.bg);
  setVar(root, "--btn-auto-sort-text", BUTTONS.autoSort.text);
  setVar(root, "--btn-auto-sort-border", BUTTONS.autoSort.border);
  setVar(root, "--btn-auto-sort-shadow", BUTTONS.autoSort.shadow);
  setVar(root, "--btn-auto-sort-hover-border", BUTTONS.autoSort.hoverBorder);
  setVar(root, "--btn-auto-sort-hover-filter", BUTTONS.autoSort.hoverFilter);
  setVar(root, "--btn-auto-sort-active-filter", BUTTONS.autoSort.activeFilter);

  setVar(root, "--btn-startover-bg", BUTTONS.startOver.bg);
  setVar(root, "--btn-startover-color", BUTTONS.startOver.text);
  setVar(root, "--btn-startover-border", BUTTONS.startOver.border);
  setVar(root, "--btn-startover-shadow", BUTTONS.startOver.shadow);
  setVar(root, "--btn-startover-hover-bg", BUTTONS.startOver.hoverBg);
  setVar(root, "--btn-startover-hover-border", BUTTONS.startOver.hoverBorder);
  setVar(root, "--btn-startover-hover-filter", BUTTONS.startOver.hoverFilter);
  setVar(root, "--btn-startover-active-bg", BUTTONS.startOver.activeBg);
  setVar(root, "--btn-startover-focus-outline", BUTTONS.startOver.focusOutline);

  Object.entries(CHARACTER_COLORS).forEach(([slug, val]) => {
    setVar(root, `--chip-character-${slug}-bg`, val.bg);
    setVar(root, `--chip-character-${slug}-border`, val.border);
    setVar(root, `--chip-character-${slug}-text`, val.text);
  });

  setVar(root, "--random-swatch", RANDOM_SWATCH);

  Object.entries(COLOR_SWATCHES).forEach(([key, val]) => {
    setVar(root, `--color-swatch-${key.toLowerCase()}`, val);
  });
}

const EFFECT_CATEGORY_LOOKUP = new Map(
  Object.entries(EFFECT_CATEGORY_COLORS).map(([label, base]) => [label.toLowerCase(), base])
);

// Returns the canonical base color for an Effect Category label (case-insensitive), or null if unknown
export function effectCategoryBase(label) {
  const key = (label ?? "").toString().trim().toLowerCase();
  if (!key) return null;
  return EFFECT_CATEGORY_LOOKUP.get(key) || null;
}
