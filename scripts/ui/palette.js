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
  "Revenant",
  "Scholar",
  "Undertaker",
  "Wylder"
];

// Dark, high-contrast bases per character (can be tuned later)
export const CHARACTER_COLORS = {
  duchess: { bg: "linear-gradient(135deg, #2e1a2b, #5c345a)", border: "rgba(209, 144, 210, 0.7)", text: "#f7f0fa" },
  executor: { bg: "linear-gradient(135deg, #1f2c38, #3a566a)", border: "rgba(140, 184, 220, 0.65)", text: "#eef6ff" },
  guardian: { bg: "linear-gradient(135deg, #1f3b2f, #35644e)", border: "rgba(140, 210, 175, 0.65)", text: "#e8fff4" },
  ironeye: { bg: "linear-gradient(135deg, #20303c, #355269)", border: "rgba(140, 180, 210, 0.65)", text: "#e9f4ff" },
  raider: { bg: "linear-gradient(135deg, #3a231c, #6a3a2a)", border: "rgba(230, 170, 135, 0.7)", text: "#fff3e9" },
  revenant: { bg: "linear-gradient(135deg, #2d2a3a, #4b4760)", border: "rgba(190, 170, 230, 0.65)", text: "#f3f0ff" },
  scholar: { bg: "linear-gradient(135deg, #1f323d, #345468)", border: "rgba(150, 195, 225, 0.68)", text: "#e9f6ff" },
  undertaker: { bg: "linear-gradient(135deg, #2d1f1f, #4e3534)", border: "rgba(215, 150, 150, 0.65)", text: "#fff0f0" },
  wylder: { bg: "linear-gradient(135deg, #21311f, #395339)", border: "rgba(170, 215, 150, 0.65)", text: "#f0fff0" }
};

// Chip color tokens; keep gradients centralized
export const CHIP_COLORS = {
  curseYes: {
    bg: "linear-gradient(135deg, #4c2a80, #8b5fd4)",
    border: "rgba(168, 120, 230, 0.7)",
    text: "#f7f1ff"
  },
  curseNo: {
    bg: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.14)",
    text: "rgba(245, 245, 245, 0.92)"
  },
  selfStackYes: {
    bg: "linear-gradient(135deg, #103828, #27a06a)",
    border: "rgba(120, 230, 170, 0.8)",
    text: "#e9fff5"
  },
  selfStackNo: {
    bg: "linear-gradient(135deg, #3d1318, #9b2f35)",
    border: "rgba(255, 130, 150, 0.8)",
    text: "#ffeef2"
  },
  selfStackUnknown: {
    bg: "linear-gradient(135deg, #2e2f36, #4b4e57)",
    border: "rgba(255, 255, 255, 0.18)",
    text: "rgba(245, 245, 245, 0.92)"
  },
  placeholder: {
    bg: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.12)",
    text: "rgba(255, 255, 255, 0.9)"
  },
  character: {
    bg: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.16)",
    text: "rgba(245, 245, 245, 0.92)"
  },
  characterAll: {
    bg: "linear-gradient(135deg, #4c2a80, #8b5fd4)", // reserved purple gradient for ALL
    border: "rgba(168, 120, 230, 0.7)",
    text: "#f7f1ff"
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
