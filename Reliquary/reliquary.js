import { CHALICE_DATA_URL, DATA_URL, EFFECT_STATS_URL, relicDefaultPath, visualRelicType } from "./reliquary.assets.js";
import {
  COLORS,
  compatId,
  categoriesFor,
  applyCategory,
  eligibleList,
  baseFilteredByRelicType,
  autoRelicTypeFromEffect1,
  categoryColorFor,
  themeFromBase,
  ALL_THEME,
  textColorFor,
  relicTypeForRow,
  computeCompatDupGroups,
  effectCategoryForRow
} from "./reliquary.logic.js";
import {
  renderChosenLine,
  updateCounts,
  setRelicImageForStage,
  installRelicImgFallback,
  moveIndicatorHtml
} from "./reliquary.ui.js";
import { getDom } from "./reliquary.dom.js";
import { gradientFromTheme, buildCategoryThemes } from "../scripts/ui/theme.js";
import { applyPaletteCssVars, COLOR_SWATCHES, RANDOM_SWATCH, CHARACTERS, characterColors, characterBackdrop, characterPortrait } from "../scripts/ui/palette.js";
import { openEffectMenu, closeEffectMenu, openCurseMenu, closeCurseMenu } from "./reliquary.menus.js";

const dom = getDom();

applyPaletteCssVars();

const resultsEl = document.getElementById("results");
const resultsHeader = document.querySelector("#results .panel-header");
const validityBadge = document.getElementById("relicValidity");
const autoSortBtn = document.getElementById("autoSortBtn");

const MODES = { INDIVIDUAL: "individual", CHALICE: "chalice" };
let activeMode = MODES.INDIVIDUAL;

// Chalice details states: collapsed (header only), partial (default), full (takeover).
const DETAILS_VIEW = { COLLAPSED: "collapsed", PARTIAL: "partial", FULL: "full" };
let chaliceDetailsView = DETAILS_VIEW.COLLAPSED;

let rows = [];
let byId = new Map();
let rowsAll = [];
let byIdAll = new Map();
let curses = [];
let selectedClass = "";

let chaliceData = [];
let chalicesByCharacter = new Map();
let selectedChaliceId = "";

function moveNode(node, target, before = null) {
  if (!node || !target) return;
  if (before) {
    target.insertBefore(node, before);
  } else {
    target.appendChild(node);
  }
}

const chaliceSelections = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};

const chaliceGroupOrder = {
  standard: [],
  depth: []
};

const chaliceEffectDrag = {
  side: "",
  slot: -1
};

const chaliceCurses = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};

const chaliceCats = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};

// Track which chalice badges have been hovered so pulse animations can stop
const seenChaliceBadges = new Set();

const selectedEffects = ["", "", ""];
const selectedCats = ["", "", ""];
const curseBySlot = [null, null, null];
const curseCatBySlot = ["", "", ""];

const chaliceColorCache = {
  standard: "#ffffff",
  depth: "#ffffff"
};
const chaliceColorListCache = {
  standard: [],
  depth: []
};

let lastChaliceRollIssues = { standard: [], depth: [] };

let effectStatsRows = [];
let effectStatsByEffectId = new Map();
let conditionalEffectState = new Map();
let conditionalEffectStacks = new Map();
let lastChaliceIssues = { errors: [], warnings: [] };
let lastChaliceIconOffsets = { warning: null, error: null };
let lastChaliceIssueAssignments = {
  rail: { errors: [], warnings: [] },
  perSlot: new Map()
};

// Tooltip portal (escapes stacking contexts)
let tooltipPortal;
function ensureTooltipPortal() {
  if (tooltipPortal) return tooltipPortal;
  const el = document.createElement("div");
  el.id = "tooltipPortal";
  el.className = "tooltip-portal";
  document.body.appendChild(el);
  tooltipPortal = el;
  return el;
}

function showPortalTooltip(target) {
  const el = ensureTooltipPortal();
  const txt = target?.getAttribute("data-tooltip") || target?.dataset?.tooltipText;
  if (!txt) return;
  const rect = target.getBoundingClientRect();
  const placeLeft = !!(target.closest(".chalice-slot__issue-col, .chalice-slot__issue-badges")
    || target.closest('#chaliceDetails[data-details-state="collapsed"]'));
  el.textContent = txt;
  if (placeLeft) {
    el.classList.add("tooltip-portal--left");
    el.style.left = `${rect.left - 8}px`;
    el.style.top = `${rect.top + rect.height / 2}px`;
  } else {
    el.classList.remove("tooltip-portal--left");
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top - 8}px`;
  }
  document.body.classList.add("tooltip-portal-active");
  el.classList.add("is-visible");
}

function hidePortalTooltip() {
  if (!tooltipPortal) return;
  tooltipPortal.classList.remove("is-visible");
  tooltipPortal.textContent = "";
  document.body.classList.remove("tooltip-portal-active");
}

function normalizeChaliceColor(value) {
  if (!value) return "#ffffff";
  const trimmed = String(value).trim();
  if (trimmed.startsWith("#")) return trimmed;
  const rgbMatch = trimmed.match(/rgba?\([^\)]+\)/i);
  if (rgbMatch) return rgbMatch[0];
  if (trimmed.includes("gradient")) {
    const hexMatch = trimmed.match(/#([0-9a-fA-F]{3,8})/);
    if (hexMatch) return `#${hexMatch[1]}`;
  }
  // Attempt to resolve named colors
  const probe = document.createElement("div");
  probe.style.display = "none";
  probe.style.color = trimmed;
  document.body.appendChild(probe);
  const resolved = window.getComputedStyle(probe).color;
  probe.remove();
  return resolved || "#ffffff";
}

function setChaliceSideColorVar(meta, color) {
  const colEl = document.querySelector(`article.chalice-column[data-side="${meta.key}"]`);
  if (colEl) colEl.style.setProperty("--chalice-side-color", color);
}

let currentRandomColor = "Red";
let selectedColor = "Random";
const COLOR_CHOICES = ["Random", ...COLORS];
let showIllegalActive = false;
let autoSortEnabled = true;

function showIllegalButtons() {
  if (Array.isArray(dom.showIllegalButtons) && dom.showIllegalButtons.length) return dom.showIllegalButtons;
  return [dom.showIllegalBtn, dom.showIllegalBtnChalice].filter(Boolean);
}

function autoSortButtons() {
  if (Array.isArray(dom.autoSortToggleButtons) && dom.autoSortToggleButtons.length) return dom.autoSortToggleButtons;
  return [dom.autoSortToggle, dom.autoSortToggleChalice].filter(Boolean);
}

function installHoverTooltip(btn) {
  if (!btn || btn.dataset.tooltipHoverInstalled) return;
  const apply = () => {
    const txt = btn.dataset.tooltipText || "";
    if (txt) btn.setAttribute("data-tooltip", txt);
    showPortalTooltip(btn);
  };
  const clear = () => {
    btn.removeAttribute("data-tooltip");
    hidePortalTooltip();
  };
  btn.addEventListener("pointerenter", apply);
  btn.addEventListener("pointerleave", clear);
  btn.addEventListener("blur", clear);
  btn.dataset.tooltipHoverInstalled = "true";
}

function setHoverTooltip(btn, text) {
  if (!btn) return;
  btn.dataset.tooltipText = text || "";
  btn.removeAttribute("data-tooltip");
  installHoverTooltip(btn);
}

// Global portal tooltip handlers (covers static data-tooltip elements too)
document.addEventListener("pointerenter", e => {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const el = target.closest("[data-tooltip]");
  if (!el) return;
  showPortalTooltip(el);
}, true);

document.addEventListener("pointerleave", e => {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const el = target.closest("[data-tooltip]");
  if (!el) return;
  hidePortalTooltip();
}, true);

document.addEventListener("scroll", () => hidePortalTooltip(), true);
window.addEventListener("resize", () => hidePortalTooltip());

function isShowIllegalActive() {
  return showIllegalActive;
}

function setShowIllegalActive(active) {
  showIllegalActive = !!active;
  const tooltip = showIllegalActive
    ? "Showing illegal effect combinations. Type filtering is ignored and incompatible effects will appear."
    : "Show Illegal Effect Combinations";
  const ariaLabel = showIllegalActive
    ? "Hide illegal effect combinations (currently showing all effects, including illegal)"
    : "Show illegal effect combinations";

  showIllegalButtons().forEach(btn => {
    btn.classList.toggle("is-active", showIllegalActive);
    btn.setAttribute("aria-pressed", String(showIllegalActive));
    btn.setAttribute("aria-label", ariaLabel);
    btn.setAttribute("title", "");
    setHoverTooltip(btn, tooltip);
  });
}

function isAutoSortEnabled() {
  return autoSortEnabled;
}

function setAutoSortEnabled(enabled) {
  autoSortEnabled = !!enabled;

  const tooltip = autoSortEnabled
    ? "Auto-Sorting Roll Orders is On"
    : "Auto-Sorting Roll Orders is Off";
  const ariaLabel = autoSortEnabled
    ? "Disable auto-sort (currently on)"
    : "Enable auto-sort (currently off)";

  autoSortButtons().forEach(btn => {
    btn.classList.toggle("is-active", autoSortEnabled);
    btn.setAttribute("aria-pressed", String(autoSortEnabled));
    btn.setAttribute("aria-label", ariaLabel);
    btn.setAttribute("title", "");
    setHoverTooltip(btn, tooltip);

    const sr = btn.querySelector(".sr-only");
    if (sr) sr.textContent = autoSortEnabled ? "Auto-Sort Enabled" : "Auto-Sort Disabled";
  });

  if (Array.isArray(dom.autoSortPills)) {
    dom.autoSortPills.forEach(pill => {
      if (!pill) return;
      // Keep legacy pill markup hidden; replaced by warning badge in Chalice view
      pill.hidden = true;
      pill.setAttribute("aria-hidden", "true");
    });
  }
}

function autoSortSelectedEffectsIfNeeded() {
  const selections = [getSelectedRow(0), getSelectedRow(1), getSelectedRow(2)];
  const selectedCount = selections.filter(Boolean).length;
  if (selectedCount < 2) return false;

  const roll = computeRollOrderIssue(selections[0], selections[1], selections[2]);
  const position = computePositionIssue(selections[0], selections[1], selections[2]);

  const canSort = roll && roll.hasIssue && roll.sorted && position && !position.hasIssue;
  if (!canSort) return false;

  applyAutoSort();
  return true;
}

function handleAutoSortToggle() {
  const next = !isAutoSortEnabled();
  setAutoSortEnabled(next);

  const hasChaliceSelections = !!(
    chaliceSelections &&
    ((chaliceSelections.standard && chaliceSelections.standard.some(Boolean)) ||
      (chaliceSelections.depth && chaliceSelections.depth.some(Boolean)))
  );
  const shouldRenderChalice = hasChaliceSelections || (typeof isChaliceMode === "function" && isChaliceMode());

  if (next) {
    const sortedBuilder = autoSortSelectedEffectsIfNeeded();
    const sortedChalice = hasChaliceSelections ? maybeAutoSortChalice(true) : false;

    if (!sortedBuilder) updateUI("auto-sort-toggle");
    if (sortedChalice || shouldRenderChalice) renderChaliceUI();
  } else {
    updateUI("auto-sort-toggle");
    if (shouldRenderChalice) renderChaliceUI();
  }
}

const COLOR_SWATCH = COLOR_SWATCHES;

const defaultCategoryTheme = categoryColorFor("");

function escapeHtml(value) {
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

function statusIconPath(statusIconId) {
  const id = (statusIconId ?? "").toString().trim();
  if (!id) return "";
  return new URL(`../Assets/icons/reliquary/${id}.png`, window.location.href).toString();
}

function alertIconUrl(kind) {
  const file = kind === "error" ? "chalice-error.svg" : "chalice-warning.svg";
  return new URL(`../Assets/icons/reliquary/${file}`, window.location.href).toString();
}

function chaliceIconHtml(statusIconId, fallbackText = "") {
  const src = statusIconPath(statusIconId);
  const fallback = (fallbackText || "").trim().slice(0, 2);
  const fallbackHtml = fallback ? `<span class="chalice-slot__icon-fallback">${escapeHtml(fallback)}</span>` : "";
  const imgHtml = src ? `<img src="${src}" alt="" onerror="this.remove()">` : fallbackHtml;
  return `<span class="chalice-slot__icon">${imgHtml}</span>`;
}

function colorChipLabel(value) {
  const v = value || "Random";
  if (v === "Random") return `Color: Random (${currentRandomColor})`;
  return `Color: ${v}`;
}

function twoDecimal(value) {
  if (!Number.isFinite(value)) return "0.00";
  return (Math.round(value * 100) / 100).toFixed(2);
}

function isZeroish(value) {
  return !Number.isFinite(value) ? false : Math.abs(value) < 1e-6;
}

function formatSignedInt(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}`;
}

function formatSigned(value, suffix = "") {
  const fixed = twoDecimal(value);
  const sign = value > 0 ? "+" : "";
  return `${sign}${fixed}${suffix}`;
}

const DEFAULT_STAT_ICON = { label: "Stat", badge: "ST" };
const STAT_ICON_MAP = {
  "Attack:Physical": { label: "Attack Physical", badge: "PH" },
  "Attack:Fire": { label: "Attack Fire", badge: "AF" },
  "Attack:Lightning": { label: "Attack Lightning", badge: "AL" },
  "Attack:Magic": { label: "Attack Magic", badge: "AM" },
  "Attack:Dark": { label: "Attack Dark", badge: "AD" },
  "Attack:Pierce": { label: "Attack Pierce", badge: "AP" },
  "Attack:Slash": { label: "Attack Slash", badge: "AS" },
  "Attack:Strike": { label: "Attack Strike", badge: "AK" },
  "Attack:Holy": { label: "Attack Holy", badge: "AH" },
  "Negation:Physical": { label: "Negation Physical", badge: "PH" },
  "Negation:Fire": { label: "Negation Fire", badge: "NF" },
  "Negation:Lightning": { label: "Negation Lightning", badge: "NL" },
  "Negation:Magic": { label: "Negation Magic", badge: "NM" },
  "Negation:Dark": { label: "Negation Dark", badge: "ND" },
  "Negation:Holy": { label: "Negation Holy", badge: "NH" },
  "Negation:Pierce": { label: "Negation Pierce", badge: "NP" },
  "Negation:Slash": { label: "Negation Slash", badge: "NS" },
  "Negation:Strike": { label: "Negation Strike", badge: "NK" },
  "Attributes:Strength": { label: "Strength", badge: "ST" },
  "Attributes:Dexterity": { label: "Dexterity", badge: "DX" },
  "Attributes:Intelligence": { label: "Intelligence", badge: "IN" },
  "Attributes:Faith": { label: "Faith", badge: "FA" },
  "Attributes:Endurance": { label: "Endurance", badge: "EN" },
  "Attributes:Vigor": { label: "Vigor", badge: "VI" },
  "Attributes:Mind": { label: "Mind", badge: "MI" },
  "Attributes:Arcane": { label: "Arcane", badge: "AR" },
  "Recovery:HP": { label: "Recovery HP", badge: "RH" },
  "Recovery:FP": { label: "Recovery FP", badge: "RF" },
  "Poise:Poise": { label: "Poise", badge: "PO" },
  "Other:Status": { label: "Status", badge: "ST" }
};

const STAT_LAYOUT = {
  attributes: [
    { label: "STR", group: "Attributes", type: "Strength", unit: "flat" },
    { label: "DEX", group: "Attributes", type: "Dexterity", unit: "flat" },
    { label: "VIG", group: "Attributes", type: "Vigor", unit: "flat" },
    { label: "END", group: "Attributes", type: "Endurance", unit: "flat" },
    { label: "MND", group: "Attributes", type: "Mind", unit: "flat" },
    { label: "INT", group: "Attributes", type: "Intelligence", unit: "flat" },
    { label: "FTH", group: "Attributes", type: "Faith", unit: "flat" },
    { label: "ARC", group: "Attributes", type: "Arcane", unit: "flat" }
  ],
  attack: [
    { label: "Physical", group: "Attack", type: "Physical" },
    { label: "Slashing", group: "Attack", type: "Slash" },
    { label: "Bludgeoning", group: "Attack", type: "Strike" },
    { label: "Piercing", group: "Attack", type: "Pierce" },
    { label: "Magic", group: "Attack", type: "Magic" },
    { label: "Fire", group: "Attack", type: "Fire" },
    { label: "Lightning", group: "Attack", type: "Lightning" },
    { label: "Holy", group: "Attack", type: "Holy", altTypes: ["Dark"] }
  ],
  defense: [
    { label: "Physical", group: "Negation", type: "Physical" },
    { label: "Slashing", group: "Negation", type: "Slash" },
    { label: "Bludgeoning", group: "Negation", type: "Strike" },
    { label: "Piercing", group: "Negation", type: "Pierce" },
    { label: "Magic", group: "Negation", type: "Magic" },
    { label: "Fire", group: "Negation", type: "Fire" },
    { label: "Lightning", group: "Negation", type: "Lightning" },
    { label: "Holy", group: "Negation", type: "Holy", altTypes: ["Dark"] }
  ]
};

function statIconMeta(metricGroup, metricType) {
  const key = `${metricGroup}:${metricType}`;
  return STAT_ICON_MAP[key] || STAT_ICON_MAP[metricGroup] || DEFAULT_STAT_ICON;
}

function statIconHtml(metricGroup, metricType) {
  const meta = statIconMeta(metricGroup, metricType);
  const badge = (meta.badge || metricType || "?").slice(0, 3).toUpperCase();
  return `<span class="stat-box__icon" title="${escapeHtml(meta.label || badge)}">${escapeHtml(badge)}</span>`;
}

function updateCharacterNameLabel() {
  if (!dom.statOverviewName) return;
  const resolved = selectedClass ? resolveCharacterOption(selectedClass) || selectedClass : "Character Name";
  dom.statOverviewName.textContent = resolved;
  updateStatOverviewGlow();
}

function updateStatOverviewGlow() {
  const targets = [dom.statOverviewSection, dom.chaliceResultsShell].filter(Boolean);
  if (!targets.length) return;
  const token = selectedClass ? characterColors(selectedClass) : null;
  const backdrop = selectedClass ? characterBackdrop(selectedClass) : null;
  const portrait = selectedClass ? characterPortrait(selectedClass) : null;
  const border = token?.border || "rgba(255, 255, 255, 0.4)";
  const glow = token?.border || "rgba(255, 255, 255, 0.4)";
  targets.forEach(node => {
    node.style.setProperty("--stat-border-color", border);
    node.style.setProperty("--stat-glow-color", glow);
    node.style.setProperty("--stat-bg-url", backdrop || "none");
    node.style.setProperty("--stat-bg-opacity", backdrop ? "0.16" : "0");
  });

  if (dom.statOverviewPortrait) {
    dom.statOverviewPortrait.style.backgroundImage = portrait || "";
  }
}

/**
 * Toggle the Coming Soon blur treatments for both the stat overview overlay
 * and the full-view Coming Soon panel. Keep this wired so we can flip blurs
 * off for demos or screenshots without digging through styles.
 */
function setComingSoonBlur(enabled = true) {
  const value = enabled ? "on" : "off";
  if (dom.chaliceResultsShell) dom.chaliceResultsShell.setAttribute("data-coming-soon-blur", value);
}

function resetVitalsPlaceholders() {
  if (dom.statOverviewHP) dom.statOverviewHP.textContent = "-";
  if (dom.statOverviewFP) dom.statOverviewFP.textContent = "-";
  if (dom.statOverviewST) dom.statOverviewST.textContent = "-";
}

function ingestEffectStats(list) {
  effectStatsRows = Array.isArray(list) ? list : [];
  effectStatsByEffectId = new Map();
  for (const row of effectStatsRows) {
    const id = String(row?.EffectID ?? "").trim();
    if (!id) continue;
    if (!effectStatsByEffectId.has(id)) effectStatsByEffectId.set(id, []);
    effectStatsByEffectId.get(id).push(row);
  }
}

function statRowsForEffect(effectId) {
  if (!effectId) return [];
  return effectStatsByEffectId.get(String(effectId)) || [];
}

function maxStacksForEffect(effectId) {
  const rows = statRowsForEffect(effectId);
  let max = 1;
  for (const row of rows) {
    if (String(row?.Stackable ?? "0") !== "1") continue;
    const m = Number.parseInt(row?.MaxStacks ?? "0", 10);
    if (Number.isFinite(m) && m > max) max = m;
  }
  return max;
}

function stackCountForEffect(effectId) {
  const key = String(effectId || "").trim();
  const max = maxStacksForEffect(effectId);
  const current = conditionalEffectStacks.has(key) ? conditionalEffectStacks.get(key) : (max > 1 ? 1 : 1);
  return Math.min(Math.max(1, current), Math.max(1, max));
}

function setStackCountForEffect(effectId, count) {
  const key = String(effectId || "").trim();
  const max = maxStacksForEffect(effectId);
  const clamped = Math.min(Math.max(1, Number(count) || 1), Math.max(1, max));
  conditionalEffectStacks.set(key, clamped);
}

function isConditionalEffectEnabled(effectId) {
  const key = String(effectId || "").trim();
  if (!conditionalEffectState.has(key)) conditionalEffectState.set(key, true);
  return conditionalEffectState.get(key);
}

function setConditionalEffectEnabled(effectId, enabled) {
  const key = String(effectId || "").trim();
  conditionalEffectState.set(key, Boolean(enabled));
  if (enabled && !conditionalEffectStacks.has(key)) {
    setStackCountForEffect(key, 1);
  }
}

function pruneConditionalEffectState(activeEffectIds) {
  const allowed = new Set((activeEffectIds || []).map(id => String(id)));
  for (const key of conditionalEffectState.keys()) {
    if (!allowed.has(key)) conditionalEffectState.delete(key);
  }
  for (const key of conditionalEffectStacks.keys()) {
    if (!allowed.has(key)) conditionalEffectStacks.delete(key);
  }
}

function updateColorChipLabel() {
  if (!dom.relicColorChip) return;
  const selected = selectedColor || "Random";
  const resolved = selected === "Random" ? currentRandomColor : selected;
  const label = colorChipLabel(selected);

  dom.relicColorChip.setAttribute("data-color", selected);
  dom.relicColorChip.setAttribute("aria-label", label);
  dom.relicColorChip.setAttribute("title", label);
  const swatch = selected === "Random" ? RANDOM_SWATCH : (COLOR_SWATCH[resolved] || "#b9c2d0");
  dom.relicColorChip.style.setProperty("--chip-swatch", swatch);
  dom.relicColorChip.setAttribute("data-swatch", swatch);

  if (!dom.relicColorMenu) return;
  const buttons = dom.relicColorMenu.querySelectorAll("[data-color-option]");
  buttons.forEach(btn => {
    const isActive = btn.getAttribute("data-color-option") === selected;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
}

function openColorMenu() {
  if (!dom.relicColorControl || !dom.relicColorMenu || !dom.relicColorChip) return;
  dom.relicColorControl.classList.add("is-open");
  dom.relicColorMenu.hidden = false;
  dom.relicColorChip.setAttribute("aria-expanded", "true");
}

function closeColorMenu() {
  if (!dom.relicColorControl || !dom.relicColorMenu || !dom.relicColorChip) return;
  dom.relicColorControl.classList.remove("is-open");
  dom.relicColorMenu.hidden = true;
  dom.relicColorChip.setAttribute("aria-expanded", "false");
}

function toggleColorMenu() {
  if (!dom.relicColorControl) return;
  const isOpen = dom.relicColorControl.classList.contains("is-open");
  if (isOpen) {
    closeColorMenu();
  } else {
    openColorMenu();
  }
}

function handleColorMenuOutsideClick(evt) {
  if (!dom.relicColorControl) return;
  if (dom.relicColorControl.contains(evt.target)) return;
  closeColorMenu();
}

function colorOptionHtml(color) {
  return `
    <button type="button" class="relic-color-option" role="option" data-color-option="${color}" aria-selected="false" title="${color}">
      <span class="color-dot" aria-hidden="true"></span>
      <span class="sr-only">${color}</span>
    </button>
  `;
}

function installColorChipMenu() {
  if (!dom.relicColorControl || !dom.relicColorMenu || !dom.relicColorChip) return;

  dom.relicColorMenu.innerHTML = COLOR_CHOICES.map(colorOptionHtml).join("");
  dom.relicColorControl.hidden = false;
  dom.relicColorMenu.hidden = true;

  dom.relicColorChip.addEventListener("click", evt => {
    evt.stopPropagation();
    toggleColorMenu();
  });

  dom.relicColorMenu.addEventListener("click", evt => {
    const btn = evt.target.closest("[data-color-option]");
    if (!btn) return;
    const next = btn.getAttribute("data-color-option");
    if (!next) return;
    selectedColor = next;
    updateUI("color-change");
    closeColorMenu();
  });

  document.addEventListener("click", handleColorMenuOutsideClick);
  updateColorChipLabel();
}

function isChaliceMode() {
  return activeMode === MODES.CHALICE;
}

function sideInfo(side) {
  const key = side === "depth" ? "depth" : "standard";
  return {
    key,
    label: key === "depth" ? "Depth of Night" : "Standard",
    relicType: key === "depth" ? "Depth Of Night" : "Standard",
    slotPrefix: key === "depth" ? "D" : "S"
  };
}

function setChaliceStatus(text) {
  if (!dom.chaliceStatus) return;
  dom.chaliceStatus.textContent = text || "";
}

function updateDetailsToggleLabel(view) {
  const state = view ?? chaliceDetailsView;
  const rightLabel = state === DETAILS_VIEW.FULL
    ? "Collapse to details"
    : state === DETAILS_VIEW.PARTIAL
      ? "Expand details"
      : "Expand details";

  const rightExpanded = state !== DETAILS_VIEW.COLLAPSED;

  if (dom.chaliceResultsToggle) {
    dom.chaliceResultsToggle.dataset.detailsState = state;
    dom.chaliceResultsToggle.setAttribute("aria-pressed", rightExpanded ? "true" : "false");
    dom.chaliceResultsToggle.setAttribute("aria-expanded", rightExpanded ? "true" : "false");
    dom.chaliceResultsToggle.setAttribute("title", rightLabel);
    dom.chaliceResultsToggle.setAttribute("aria-label", rightLabel);
  }

  const collapseButtons = [dom.chaliceDetailsCollapseBtn, dom.chaliceDetailsCollapseBtnFull].filter(Boolean);
  collapseButtons.forEach(btn => {
    const showCollapse = state !== DETAILS_VIEW.COLLAPSED;
    btn.hidden = !showCollapse;
    btn.setAttribute("aria-hidden", showCollapse ? "false" : "true");
    btn.setAttribute("aria-expanded", showCollapse ? "true" : "false");
    btn.setAttribute("title", "Collapse details");
    btn.setAttribute("aria-label", "Collapse details");
  });
}

function applyChaliceDetailsView(view) {
  const normalized = Object.values(DETAILS_VIEW).includes(view) ? view : DETAILS_VIEW.PARTIAL;
  chaliceDetailsView = normalized;

  if (dom.chaliceLayout) dom.chaliceLayout.dataset.detailsState = normalized;
  if (dom.chaliceResultsShell) dom.chaliceResultsShell.dataset.detailsState = normalized;
  if (dom.chaliceResultsContent) dom.chaliceResultsContent.setAttribute("aria-hidden", normalized === DETAILS_VIEW.COLLAPSED ? "true" : "false");

  updateDetailsToggleLabel(normalized);
  renderChaliceStatOverview();
  renderChaliceAlerts(lastChaliceIssues);
  // Re-align alert icons when the view state changes so collapsed state picks up offsets
  scheduleChaliceAlertLayout();
}

function cycleChaliceDetailsView() {
  const next = chaliceDetailsView === DETAILS_VIEW.COLLAPSED
    ? DETAILS_VIEW.PARTIAL
    : chaliceDetailsView === DETAILS_VIEW.PARTIAL
      ? DETAILS_VIEW.FULL
      : DETAILS_VIEW.PARTIAL;
  applyChaliceDetailsView(next);
}

function expandChaliceDetailsToFull() {
  applyChaliceDetailsView(DETAILS_VIEW.FULL);
}

function syncModeUI() {
  const isChalice = isChaliceMode();

  const moveNode = (node, target) => {
    if (!node || !target) return;
    if (node.parentElement === target) return;
    target.appendChild(node);
  };

  if (dom.individualPanel) dom.individualPanel.hidden = isChalice;
  if (dom.chalicePanel) dom.chalicePanel.hidden = !isChalice;
  if (dom.utilityBar) dom.utilityBar.hidden = isChalice;

  const modeTabsSlot = isChalice ? dom.modeTabsChaliceSlot : dom.modeTabsHomeSlot;
  moveNode(dom.modeSwitchGroup, modeTabsSlot);
  if (dom.modeTabs) dom.modeTabs.classList.toggle("mode-tabs--attached", isChalice);
  if (dom.modeSwitchGroup) dom.modeSwitchGroup.classList.toggle("mode-switch-group--attached", isChalice);

  const relicTypeWrapper = dom.selType ? dom.selType.closest("label") : null;

  if (dom.modeBtnIndividual) {
    dom.modeBtnIndividual.classList.toggle("is-active", !isChalice);
    dom.modeBtnIndividual.setAttribute("aria-selected", (!isChalice).toString());
    dom.modeBtnIndividual.setAttribute("tabindex", !isChalice ? "0" : "-1");
  }
  if (dom.modeBtnChalice) {
    dom.modeBtnChalice.classList.toggle("is-active", isChalice);
    dom.modeBtnChalice.setAttribute("aria-selected", isChalice.toString());
    dom.modeBtnChalice.setAttribute("tabindex", isChalice ? "0" : "-1");
  }

  if (dom.selType) {
    dom.selType.disabled = isChalice;
    if (relicTypeWrapper) relicTypeWrapper.hidden = isChalice;
    if (dom.selType.parentElement) dom.selType.parentElement.classList.toggle("is-disabled", isChalice);
  }

  // Relocate class filter between utility bar (individual) and effect pool (chalice)
  const classSlot = isChalice ? dom.classFilterSlotChalice : dom.classFilterSlotIndividual;
  moveNode(dom.classFilterControl, classSlot);

  // Keep chalice picker inside the effect pool
  moveNode(dom.chalicePickerControl, dom.chalicePickerSlot);

  // Move Start Over into the effect pool in chalice mode, keep in utility bar otherwise
  const startOverSlot = isChalice ? dom.startOverSlotChalice : dom.startOverSlotIndividual;
  moveNode(dom.startOverBtn, startOverSlot);

  if (isChalice) {
    applyChaliceDetailsView(chaliceDetailsView);
  } else {
    if (dom.chaliceLayout) dom.chaliceLayout.removeAttribute("data-details-state");
    if (dom.chaliceResultsShell) dom.chaliceResultsShell.removeAttribute("data-details-state");
  }
}

function setMode(next) {
  const normalized = next === MODES.CHALICE ? MODES.CHALICE : MODES.INDIVIDUAL;
  if (normalized === activeMode) return;
  activeMode = normalized;
  syncModeUI();
  if (isChaliceMode()) {
    setChaliceStatus("");
    renderChaliceUI();
  }
}

function handleStartOver() {
  if (isChaliceMode()) {
    setShowIllegalActive(false);
    setAutoSortEnabled(true);
    resetClassFilter();
    resetChaliceSelections();
  } else {
    resetClassFilter();
    resetAll();
  }
}

function populateClassOptions() {
  if (!dom.selClass) return;
  const chars = Array.isArray(CHARACTERS) ? [...new Set(CHARACTERS)] : [];
  const options = [`<option value=""${!selectedClass ? " selected" : ""}>-- Class / All --</option>`,
    ...chars.map(c => {
      const v = c || "";
      const sel = normalizeLower(v) === normalizeLower(selectedClass) ? " selected" : "";
      return `<option value="${v}"${sel}>${v}</option>`;
    })
  ];
  dom.selClass.innerHTML = options.join("");
}

function resolveCharacterOption(normChar) {
  return (CHARACTERS || []).find(c => normalizeLower(c) === normalizeLower(normChar)) || "";
}

function setSelectedClass(next, triggerUI = true) {
  const normalized = (next ?? "").toString().trim();
  if (normalized === selectedClass) {
    if (dom.selClass) dom.selClass.value = normalized;
    return;
  }

  selectedClass = normalized;

  if (dom.selClass) {
    populateClassOptions();
    dom.selClass.value = normalized;
  }

  updateCharacterNameLabel();

  pruneChaliceSelectionsForClass();

  if (triggerUI) {
    renderChalicePickers();
    updateUI("class-change");
    renderChaliceUI();
  }
}

function pruneChaliceSelectionsForClass() {
  const pruneSide = (key) => {
    for (let i = 0; i < chaliceSelections[key].length; i++) {
      const id = chaliceSelections[key][i];
      if (!id) continue;
      const row = chaliceRow(id);
      if (!rowMatchesClass(row)) {
        chaliceSelections[key][i] = "";
        chaliceCats[key][i] = "";
        chaliceCurses[key][i] = "";
      }
      const curseId = chaliceCurses[key][i];
      if (curseId) {
        const curseRow = chaliceRow(curseId);
        if (!rowMatchesClass(curseRow)) chaliceCurses[key][i] = "";
      }
    }
  };
  pruneSide("standard");
  pruneSide("depth");
}

function filteredChalices() {
  if (!Array.isArray(chaliceData) || !chaliceData.length) return [];
  if (!selectedClass) return chaliceData.filter(entry => (entry?.chalicename || "").toString().trim());
  const target = normalizeLower(selectedClass);
  return chaliceData.filter(entry => normalizeLower(entry?.character || "") === target);
}

function normalizeLower(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function rowMatchesClass(row) {
  if (!selectedClass) return true;
  const target = normalizeLower(selectedClass);
  const charactersRaw = (row?.Characters ?? "").toString();
  const list = charactersRaw.split(",").map(s => normalizeLower(s)).filter(Boolean);

  if (!list.length) return true; // treat empty as ALL
  if (list.includes("all")) return true;
  return list.includes(target);
}

function singleCharacterForRow(row) {
  const charactersRaw = (row?.Characters ?? "").toString();
  const rawList = charactersRaw.split(",").map(s => s.trim()).filter(Boolean);
  if (!rawList.length) return null;
  const normalized = [...new Set(rawList.map(normalizeLower))].filter(ch => ch && ch !== "all");
  if (normalized.length !== 1) return null;
  const norm = normalized[0];
  const original = rawList.find(c => normalizeLower(c) === norm) || norm;
  return { normalized: norm, label: original };
}

function maybeAutoSetClassFromRow(row) {
  if (!row || isShowIllegalActive()) return;
  const info = singleCharacterForRow(row);
  if (!info) return;
  const resolved = resolveCharacterOption(info.normalized) || info.label;
  if (!resolved) return;
  setSelectedClass(resolved, true);
}

function filterByClass(list) {
  if (!selectedClass) return list;
  return (list || []).filter(rowMatchesClass);
}

function computeRollOrderIssue(a, b, c) {
  const original = [a, b, c];
  const picked = original.filter(Boolean);

  if (picked.length <= 1) {
    return {
      hasIssue: false,
      sorted: original,
      movedSlots: [false, false, false],
      moveDeltaBySlot: [0, 0, 0]
    };
  }

  const sortedPicked = [...picked].sort((x, y) => getRollValue(x) - getRollValue(y));

  const slotToPickedIndex = [-1, -1, -1];
  let k = 0;
  for (let i = 0; i < original.length; i++) {
    if (!original[i]) continue;
    slotToPickedIndex[i] = k;
    k++;
  }

  const idToSortedIndex = new Map(sortedPicked.map((r, idx) => [String(r.EffectID), idx]));

  const movedSlots = [false, false, false];
  const moveDeltaBySlot = [0, 0, 0];

  for (let i = 0; i < original.length; i++) {
    const row = original[i];
    if (!row) continue;

    const cur = slotToPickedIndex[i];
    const want = idToSortedIndex.get(String(row.EffectID));
    if (want == null || cur == null || cur < 0) continue;

    const delta = want - cur;
    moveDeltaBySlot[i] = delta;
    movedSlots[i] = delta !== 0;
  }

  const sortedSlots = original.slice();
  let j = 0;
  for (let i = 0; i < sortedSlots.length; i++) {
    if (!sortedSlots[i]) continue;
    sortedSlots[i] = sortedPicked[j];
    j++;
  }

  const hasIssue = movedSlots.some(Boolean);

  return {
    hasIssue,
    sorted: sortedSlots,
    movedSlots,
    moveDeltaBySlot
  };
}

function computePositionIssue(a, b, c) {
  const slots = [a, b, c];
  const badSlots = [];
  let sawEmpty = false;

  for (let i = 0; i < slots.length; i++) {
    const r = slots[i];
    if (!r) {
      sawEmpty = true;
      continue;
    }
    if (sawEmpty) badSlots.push(i);
  }

  return { hasIssue: badSlots.length > 0, badSlots };
}

function shouldAutoSort(reason, rollInfo, positionInfo, selectedCount) {
  if (!isAutoSortEnabled()) return false;
  if (reason === "auto-sort") return false;
  if (!rollInfo || !rollInfo.hasIssue) return false;
  if (!positionInfo || positionInfo.hasIssue) return false;
  if (!Number.isFinite(selectedCount) || selectedCount < 2) return false;

  // Only auto-sort on direct effect changes so unrelated UI updates do not reorder unexpectedly.
  return reason === "effect-change";
}

function selectionsCompatibleWithType(type) {
  const picked = [getSelectedRow(0), getSelectedRow(1), getSelectedRow(2)].filter(Boolean);
  if (!type) return true;
  return picked.every(r => baseFilteredByRelicType([r], type).length > 0);
}

function maybeAutoSetTypeFromEffect1(nextType) {
  if (!nextType) return;
  const current = dom.selType.value;
  if (current && current !== "All") return;
  if (!selectionsCompatibleWithType(nextType)) return;
  dom.selType.value = nextType;
}

function applyAutoSort() {
  const current = [getSelectedRow(0), getSelectedRow(1), getSelectedRow(2)];
  const roll = computeRollOrderIssue(current[0], current[1], current[2]);

  if (!roll.hasIssue || !roll.sorted) return;

  const entries = [0, 1, 2]
    .map(slotIdx => ({
      slotIdx,
      row: current[slotIdx],
      cat: selectedCats[slotIdx] || "",
      curse: curseBySlot[slotIdx],
      curseCat: curseCatBySlot[slotIdx] || ""
    }))
    .filter(e => !!e.row);

  const used = new Set();

  const nextEffects = ["", "", ""];
  const nextCats = ["", "", ""];
  const nextCurses = [null, null, null];
  const nextCurseCats = ["", "", ""];

  for (let i = 0; i < roll.sorted.length; i++) {
    const row = roll.sorted[i];
    if (!row) continue;

    const matchIdx = entries.findIndex((entry, idx) => {
      if (used.has(idx)) return false;
      return String(entry.row.EffectID) === String(row.EffectID);
    });

    const entry = matchIdx >= 0 ? entries[matchIdx] : null;
    if (matchIdx >= 0) used.add(matchIdx);

    nextEffects[i] = String(row.EffectID);
    nextCats[i] = entry ? entry.cat : "";
    nextCurses[i] = entry ? entry.curse : null;
    nextCurseCats[i] = entry ? entry.curseCat : "";
  }

  for (let i = 0; i < selectedEffects.length; i++) {
    selectedEffects[i] = nextEffects[i] || "";
    selectedCats[i] = nextCats[i] || "";
    curseBySlot[i] = nextCurses[i] || null;
    curseCatBySlot[i] = nextCurseCats[i] || "";
  }

  updateUI("auto-sort");
}

if (autoSortBtn) {
  autoSortBtn.addEventListener("click", applyAutoSort);
}

function pickRandomColor() {
  currentRandomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
}

function getRow(effectId) {
  if (!effectId) return null;
  return byId.get(String(effectId)) ?? null;
}

function getAnyRow(effectId) {
  if (!effectId) return null;
  return byIdAll.get(String(effectId)) ?? null;
}

function getSelectedId(slotIdx) {
  return selectedEffects[slotIdx] || "";
}

function setSelectedId(slotIdx, value) {
  selectedEffects[slotIdx] = value ? String(value) : "";
}

function getSelectedRow(slotIdx) {
  return getRow(getSelectedId(slotIdx));
}

function exclusiveRelicTypeFromSelections() {
  const picked = [getSelectedRow(0), getSelectedRow(1), getSelectedRow(2)];

  let hasStandard = false;
  let hasDepth = false;

  for (const row of picked) {
    const t = relicTypeForRow(row);
    if (t === "Standard") hasStandard = true;
    if (t === "Depth Of Night") hasDepth = true;
  }

  if (hasStandard && !hasDepth) return "Standard";
  if (hasDepth && !hasStandard) return "Depth Of Night";

  return null;
}

function weightColumnsFor(count) {
  if (count <= 1) return ["ChanceWeight_110"]; // single-slot uses 110 only
  if (count === 2) return ["ChanceWeight_210", "ChanceWeight_110"]; // double-slot uses 210 then 110
  return ["ChanceWeight_310", "ChanceWeight_210", "ChanceWeight_110"]; // triple-slot default
}

function weightForSlot(row, slotIdx, weightCols) {
  const cols = weightCols && weightCols.length ? weightCols : weightColumnsFor(3);
  const col = cols[Math.max(0, Math.min(slotIdx, cols.length - 1))];
  const raw = Number(row?.[col]);
  return Number.isFinite(raw) ? raw : 0;
}

function totalWeightForSlot(pool, slotIdx, weightCols) {
  return (pool || []).reduce((sum, r) => sum + weightForSlot(r, slotIdx, weightCols), 0);
}

function poolAfterPick(pool, pickedRow) {
  const cid = compatId(pickedRow);
  const pickedId = String(pickedRow?.EffectID || "");
  return (pool || []).filter(r => {
    if (!r) return false;
    if (String(r.EffectID) === pickedId) return false;
    if (!cid) return true;
    return compatId(r) !== cid;
  });
}

function permutations(list) {
  if (!Array.isArray(list) || list.length <= 1) return [list.slice()];
  const out = [];
  list.forEach((item, idx) => {
    const rest = [...list.slice(0, idx), ...list.slice(idx + 1)];
    permutations(rest).forEach(p => out.push([item, ...p]));
  });
  return out;
}

const DEPTH_EFFECT_SLOTS = {
  Small: ["ChanceWeight_2000000"],
  Medium: ["ChanceWeight_2000000", "ChanceWeight_2000000"],
  Large: ["ChanceWeight_2000000", "ChanceWeight_2000000", "ChanceWeight_2200000"]
};

const DEPTH_CURSE_COLUMN = "ChanceWeight_3000000";

const LARGE_CURSE_PRIORS = {
  0: 0.4,
  1: 0.3,
  2: 0.2,
  3: 0.1
};

function buildColumnStats(list, columns) {
  const totalWeightByColumn = {};
  const compatGroupWeightByColumn = {};
  const effectWeightByColumn = {};
  const compatOfEffect = new Map();

  for (const col of columns) {
    totalWeightByColumn[col] = 0;
    compatGroupWeightByColumn[col] = new Map();
    effectWeightByColumn[col] = new Map();
  }

  for (const row of list || []) {
    if (!row) continue;
    const id = String(row.EffectID ?? "");
    const cid = compatId(row);
    compatOfEffect.set(id, cid);

    for (const col of columns) {
      const w = Number(row?.[col]) || 0;
      if (w <= 0) continue;

      totalWeightByColumn[col] += w;
      effectWeightByColumn[col].set(id, w);

      if (cid) {
        const map = compatGroupWeightByColumn[col];
        map.set(cid, (map.get(cid) || 0) + w);
      }
    }
  }

  return { totalWeightByColumn, compatGroupWeightByColumn, effectWeightByColumn, compatOfEffect };
}

function denomForColumn(col, blockedCompat, stats) {
  const total = stats.totalWeightByColumn[col] || 0;
  const compatWeights = stats.compatGroupWeightByColumn[col] || new Map();
  let blocked = 0;
  if (blockedCompat && blockedCompat.size) {
    for (const cid of blockedCompat) {
      blocked += compatWeights.get(cid) || 0;
    }
  }
  return total - blocked;
}

function sumUnblockedCompat(col, blockedCompat, stats) {
  const compatWeights = stats.compatGroupWeightByColumn[col] || new Map();
  let sum = 0;
  compatWeights.forEach((w, cid) => {
    if (blockedCompat && blockedCompat.has(cid)) return;
    sum += w;
  });
  return sum;
}

function blockedKey(blockedCompat) {
  if (!blockedCompat || blockedCompat.size === 0) return "";
  return [...blockedCompat].sort().join("|");
}

function slotCombinations(slotCount, pickCount, start = 0, path = [], out = []) {
  if (path.length === pickCount) {
    out.push(path.slice());
    return out;
  }
  for (let i = start; i < slotCount; i++) {
    path.push(i);
    slotCombinations(slotCount, pickCount, i + 1, path, out);
    path.pop();
  }
  return out;
}

function generateAssignmentsForSlots(slotCount, requiredIds) {
  if (!requiredIds.length) return [Array(slotCount).fill(null)];

  const combos = slotCombinations(slotCount, requiredIds.length);
  const permutes = permutations(requiredIds);
  const out = [];
  const seen = new Set();

  combos.forEach(indices => {
    permutes.forEach(perm => {
      const slots = Array(slotCount).fill(null);
      indices.forEach((slotIdx, j) => {
        slots[slotIdx] = perm[j];
      });
      const key = slots.join("|");
      if (seen.has(key)) return;
      seen.add(key);
      out.push(slots);
    });
  });

  return out.length ? out : [Array(slotCount).fill(null)];
}

function probabilityMapForAssignment(slotCols, assignment, stats, blockedCompat = new Set(), idx = 0) {
  if (idx >= slotCols.length) {
    const map = new Map();
    map.set(blockedKey(blockedCompat), { probability: 1, blocked: new Set(blockedCompat) });
    return map;
  }

  const col = slotCols[idx];
  const denom = denomForColumn(col, blockedCompat, stats);
  if (!Number.isFinite(denom) || denom <= 0) return new Map();

  const targetId = assignment[idx];
  const out = new Map();

  if (targetId) {
    const weight = (stats.effectWeightByColumn[col] || new Map()).get(targetId) || 0;
    const cid = stats.compatOfEffect.get(targetId) || "";
    if (weight > 0 && (!cid || !blockedCompat.has(cid))) {
      const nextBlocked = new Set(blockedCompat);
      if (cid) nextBlocked.add(cid);
      const p = weight / denom;
      const child = probabilityMapForAssignment(slotCols, assignment, stats, nextBlocked, idx + 1);
      child.forEach(({ probability, blocked }) => {
        const key = blockedKey(blocked);
        const prev = out.get(key);
        const nextProb = p * probability;
        if (prev) {
          prev.probability += nextProb;
        } else {
          out.set(key, { probability: nextProb, blocked });
        }
      });
    }
    return out;
  }

  const compatWeights = stats.compatGroupWeightByColumn[col] || new Map();
  const sumCompat = sumUnblockedCompat(col, blockedCompat, stats);
  const noCompatWeight = denom - sumCompat;

  if (noCompatWeight > 0) {
    const p = noCompatWeight / denom;
    const child = probabilityMapForAssignment(slotCols, assignment, stats, new Set(blockedCompat), idx + 1);
    child.forEach(({ probability, blocked }) => {
      const key = blockedKey(blocked);
      const prev = out.get(key);
      const nextProb = p * probability;
      if (prev) {
        prev.probability += nextProb;
      } else {
        out.set(key, { probability: nextProb, blocked });
      }
    });
  }

  compatWeights.forEach((w, cid) => {
    if (blockedCompat.has(cid)) return;
    const p = w / denom;
    const nextBlocked = new Set(blockedCompat);
    nextBlocked.add(cid);
    const child = probabilityMapForAssignment(slotCols, assignment, stats, nextBlocked, idx + 1);
    child.forEach(({ probability, blocked }) => {
      const key = blockedKey(blocked);
      const prev = out.get(key);
      const nextProb = p * probability;
      if (prev) {
        prev.probability += nextProb;
      } else {
        out.set(key, { probability: nextProb, blocked });
      }
    });
  });

  return out;
}

function probabilityForCursePermutation(slotCols, permutationIds, blockedCompat, stats) {
  let p = 1;
  for (let i = 0; i < slotCols.length; i++) {
    const col = slotCols[i];
    const id = permutationIds[i];
    const denom = denomForColumn(col, blockedCompat, stats);
    if (!Number.isFinite(denom) || denom <= 0) return 0;

    const weight = (stats.effectWeightByColumn[col] || new Map()).get(id) || 0;
    const cid = stats.compatOfEffect.get(id) || "";
    if (!weight || (cid && blockedCompat.has(cid))) return 0;

    p *= weight / denom;
    if (cid) blockedCompat.add(cid);
  }
  return p;
}

function hasCompatConflict(entries) {
  const seen = new Set();
  for (const r of entries || []) {
    if (!r) continue;
    const cid = compatId(r);
    if (!cid) continue;
    if (seen.has(cid)) return true;
    seen.add(cid);
  }
  return false;
}

function depthTooltip(sizeSummaries, overallProbability, curseCount) {
  if (!sizeSummaries.length) return "No valid Depth of Night rolls for these picks.";

  const lines = [];
  if (Number.isFinite(overallProbability)) {
    lines.push(`Depth of Night • ${formatPercent(overallProbability * 100)}% • 1 in ${formatOneIn(overallProbability)}`);
  } else {
    lines.push("Depth of Night probabilities (conditional on size)");
  }

  if (curseCount > 0) lines.push(`Required curses: ${curseCount}`);

  sizeSummaries.forEach(s => {
    const totalPct = formatPercent(s.totalProbability * 100);
    const oneIn = s.totalProbability > 0 ? formatOneIn(s.totalProbability) : "Impossible";
    const effPct = formatPercent(s.effectsProbability * 100);
    const cursePct = formatPercent(s.cursesGivenEffects * 100);
    const priorText = s.cursePrior !== 1 ? ` • curse-count prior ${s.cursePrior}` : "";
    lines.push(`${s.size}: ${totalPct}% • 1 in ${oneIn}${priorText} (effects ${effPct}%, curses ${cursePct}%)`);
  });

  if (!Number.isFinite(overallProbability) && sizeSummaries.length > 1) {
    lines.push("Overall depends on relic size odds; multiply by your size distribution to combine.");
  }

  return lines.join("\n");
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(10);
}

function formatOneIn(probability) {
  if (!Number.isFinite(probability) || probability <= 0) return "Impossible";
  const denom = 1 / probability;
  const rounded = Math.max(1, Math.round(denom));
  return rounded.toLocaleString();
}

function computeRelicProbability(selectedRows, selectedType) {
  const typeRaw = (selectedType ?? "").toString().trim();
  const effectiveType = typeRaw && typeRaw !== "All" ? typeRaw : exclusiveRelicTypeFromSelections();
  const isStandardish = !effectiveType || effectiveType === "Standard" || effectiveType === "Both";
  const isDepth = effectiveType === "Depth Of Night";
  if (!isStandardish && !isDepth) return null;

  const picked = (selectedRows || []).filter(Boolean);
  if (!picked.length) return null;

  const hasDepth = picked.some(r => relicTypeForRow(r) === "Depth Of Night");

  if (isDepth || hasDepth) {
    return computeDepthRelicProbability(picked);
  }

  // For Standard probability, ignore class filtering entirely; only self/compat removals apply.
  const poolAllStandard = baseFilteredByRelicType(rows, "Standard");
  if (!poolAllStandard.length) return null;

  const weightCols = weightColumnsFor(picked.length);
  const perms = permutations(picked);

  const probability = perms.reduce((sum, order) => {
    let p = 1;
    let remaining = poolAllStandard.slice();

    for (let i = 0; i < order.length; i++) {
      const target = order[i];
      const w = weightForSlot(target, i, weightCols);
      const total = totalWeightForSlot(remaining, i, weightCols);

      if (!Number.isFinite(total) || total <= 0 || w <= 0) return sum; // impossible path
      p *= w / total;

      remaining = poolAfterPick(remaining, target);
    }

    return sum + p;
  }, 0);

  if (!Number.isFinite(probability) || probability <= 0) return { probability: 0, percentText: "0.000000", oneInText: "Impossible" };

  const percentText = formatPercent(probability * 100);
  const oneInText = formatOneIn(probability);

  return { probability, percentText, oneInText };
}

function computeDepthRelicProbability(selectedEffectRows) {
  const requiredEffects = (selectedEffectRows || []).filter(Boolean);
  const requiredEffectIds = requiredEffects.map(r => String(r.EffectID));

  const requiredCurses = (curseBySlot || [])
    .map(id => getAnyRow(id))
    .filter(Boolean);
  const requiredCurseIds = requiredCurses.map(r => String(r.EffectID));

  // Enforce that curse-required effects imply the same number of curses
  const requiredEffectCurseCount = requiredEffects.filter(r => String(r?.CurseRequired ?? "0") === "1").length;
  if (requiredCurseIds.length < requiredEffectCurseCount) {
    const tooltip = `Need at least ${requiredEffectCurseCount} curse${requiredEffectCurseCount === 1 ? "" : "s"} to satisfy curse-required effects.`;
    return { probability: 0, percentText: "0.000000", oneInText: "Impossible", tooltip };
  }

  if (!requiredEffects.length) return null;

    // Depth probability also ignores class filtering; only type/compat constraints apply.
    const allDepthEffects = baseFilteredByRelicType(rows, "Depth Of Night");
    const allDepthCurses = baseFilteredByRelicType(curses, "Depth Of Night");
  if (!allDepthEffects.length) return null;

  const effectsAllowed = requiredEffects.every(r => baseFilteredByRelicType([r], "Depth Of Night").length > 0);
  const cursesAllowed = requiredCurses.every(r => baseFilteredByRelicType([r], "Depth Of Night").length > 0);
  if (!effectsAllowed || !cursesAllowed) return null;

  if (hasCompatConflict([...requiredEffects, ...requiredCurses])) {
    const tooltip = "Selected effects or curses share a CompatibilityID, so this relic is impossible.";
    return { probability: 0, percentText: "0.000000", oneInText: "Impossible", tooltip };
  }

  const effectStats = buildColumnStats(allDepthEffects, ["ChanceWeight_2000000", "ChanceWeight_2200000"]);
  const curseStats = buildColumnStats(allDepthCurses, [DEPTH_CURSE_COLUMN]);

  const colForEffect = (() => {
    const map = new Map();
    for (const r of allDepthEffects) {
      const id = String(r.EffectID);
      const needsCurse = String(r?.CurseRequired ?? "0") === "1";
      map.set(id, needsCurse ? "ChanceWeight_2000000" : "ChanceWeight_2200000");
    }
    return (id) => map.get(String(id)) || "ChanceWeight_2000000";
  })();

  const allowedSizes = (() => {
    if (requiredEffectIds.length >= 3) return ["Large"];
    if (requiredEffectIds.length === 2) return ["Medium"];
    return ["Small"];
  })();

  const sizeSummaries = [];

  for (const size of allowedSizes) {
    const slots = DEPTH_EFFECT_SLOTS[size];
    if (!slots || requiredEffectIds.length > slots.length) continue;

    const effectAssignments = generateAssignmentsForSlots(slots.length, requiredEffectIds)
      .filter(assign => assign.every((id) => {
        if (!id) return true;
        const col = colForEffect(id);
        const w = (effectStats.effectWeightByColumn[col] || new Map()).get(id) || 0;
        return w > 0;
      }));

    const curseSlots = Array(requiredCurseIds.length).fill(DEPTH_CURSE_COLUMN);
    const cursePermutations = permutations(requiredCurseIds)
      .filter(ids => ids.every((id, idx) => {
        const col = curseSlots[idx];
        const w = (curseStats.effectWeightByColumn[col] || new Map()).get(id) || 0;
        return w > 0;
      }));

    if (!effectAssignments.length) continue;
    if (!cursePermutations.length && curseSlots.length > 0) continue;
    const cursePrior = size === "Large" ? (LARGE_CURSE_PRIORS[requiredCurseIds.length] ?? 0) : 1;
    if (cursePrior <= 0) continue;

    let effectsProbability = 0;
    let cursesJoint = 0;
    let totalJoint = 0;

    for (const assignment of effectAssignments) {
      const slotCols = assignment.map(id => colForEffect(id));
      const outcomeMap = probabilityMapForAssignment(slotCols, assignment, effectStats, new Set(), 0);

      let assignmentProb = 0;
      outcomeMap.forEach(v => {
        assignmentProb += v.probability;
      });
      effectsProbability += assignmentProb;

      outcomeMap.forEach(({ probability, blocked }) => {
        const blockedSet = new Set(blocked);
        if (!curseSlots.length) {
          totalJoint += probability;
          cursesJoint += probability;
          return;
        }

        for (const perm of cursePermutations) {
          const pCurse = probabilityForCursePermutation(curseSlots, perm, new Set(blockedSet), curseStats);
          if (pCurse <= 0) continue;
          const joint = probability * pCurse;
          totalJoint += joint;
          cursesJoint += joint;
        }
      });
    }

    const totalProbability = totalJoint * cursePrior;
    const cursesGivenEffects = effectsProbability > 0 ? (cursesJoint / effectsProbability) : 0;

    sizeSummaries.push({
      size,
      effectsProbability,
      cursesGivenEffects,
      cursePrior,
      totalProbability,
      effectAssignments: effectAssignments.length,
      curseAssignments: cursePermutations.length
    });
  }

  if (!sizeSummaries.length) {
    const tooltip = "No valid Depth of Night sizes can satisfy these effects/curses.";
    return { probability: 0, percentText: "0.000000", oneInText: "Impossible", tooltip };
  }

  const overallProbability = sizeSummaries.length >= 1 ? sizeSummaries[0].totalProbability : Number.NaN;
  const percentText = Number.isFinite(overallProbability) ? formatPercent(overallProbability * 100) : "";
  const oneInText = Number.isFinite(overallProbability) ? formatOneIn(overallProbability) : "";

  const tooltip = Number.isFinite(overallProbability)
    ? (overallProbability > 0 ? `${percentText}% chance • 1 in ${oneInText}` : "Depth of Night roll is impossible with the current picks.")
    : "Depth of Night roll is impossible with the current picks.";

  return { probability: overallProbability, percentText, oneInText, tooltip, sizeSummaries };
}

function setRelicProbability(probabilityResult) {
  if (!dom.relicProbability || !dom.relicProbabilityValue) return;

  const hasValue = probabilityResult && (Number.isFinite(probabilityResult.probability) || typeof probabilityResult.tooltip === "string");
  if (!hasValue) {
    dom.relicProbability.hidden = true;
    dom.relicProbability.removeAttribute("data-tooltip");
    dom.relicProbability.removeAttribute("aria-label");
    dom.relicProbability.removeAttribute("title");
    dom.relicProbabilityValue.textContent = "%";
    return;
  }

  const percentText = probabilityResult.percentText ?? (Number.isFinite(probabilityResult.probability) ? formatPercent(probabilityResult.probability * 100) : "");
  const oneInText = probabilityResult.oneInText ?? (Number.isFinite(probabilityResult.probability) ? formatOneIn(probabilityResult.probability) : "");
  const tooltip = probabilityResult.tooltip
    ? probabilityResult.tooltip
    : (percentText && oneInText ? `${percentText}% chance • 1 in ${oneInText}` : "Probability depends on relic size distribution.");

  dom.relicProbability.hidden = false;
  dom.relicProbabilityValue.textContent = "%";
  dom.relicProbability.setAttribute("data-tooltip", tooltip);
  dom.relicProbability.setAttribute("aria-label", tooltip);
  dom.relicProbability.setAttribute("title", "");
}

function effectiveRelicType(forFiltering = false) {
  // When showing illegal combinations, filtering should ignore relic type entirely
  if (forFiltering && isShowIllegalActive()) return "";
  return exclusiveRelicTypeFromSelections() || dom.selType.value;
}

function clearSelectionsIncompatibleWithType(nextType) {
  const type = (nextType ?? "").toString().trim();
  if (!type || type === "All") return false;
  let changed = false;
  for (let i = 0; i < selectedEffects.length; i++) {
    const row = getSelectedRow(i);
    if (!row) continue;
    const allowed = baseFilteredByRelicType([row], type).length > 0;
    if (!allowed) {
      setSelectedId(i, "");
      curseBySlot[i] = null;
      changed = true;
    }
  }
  return changed;
}

function relicTypeMismatchInfo(rows) {
  // Only relevant when illegal combinations are visible
  if (!isShowIllegalActive()) return { hasIssue: false, ids: new Set() };

  const selectedType = dom.selType.value;

  let hasStandard = false;
  let hasDepth = false;
  const idsStandard = new Set();
  const idsDepth = new Set();

  for (const row of rows.filter(Boolean)) {
    const t = relicTypeForRow(row);
    if (t === "Standard") {
      hasStandard = true;
      idsStandard.add(String(row.EffectID));
    }
    if (t === "Depth Of Night") {
      hasDepth = true;
      idsDepth.add(String(row.EffectID));
    }
  }

  const noIssue = { hasIssue: false, ids: new Set() };

  // Mixed exclusive effects are always a mismatch
  if (hasStandard && hasDepth) {
    return { hasIssue: true, ids: new Set([...idsStandard, ...idsDepth]) };
  }

  // Single-type selections conflicting with an explicit relic type
  if (selectedType === "Standard" && hasDepth) {
    return { hasIssue: true, ids: idsDepth };
  }

  if (selectedType === "Depth Of Night" && hasStandard) {
    return { hasIssue: true, ids: idsStandard };
  }

  return noIssue;
}

function getRollValue(row) {
  const val = Number(row?.RollOrder);
  if (!Number.isFinite(val)) return Number.POSITIVE_INFINITY;
  return val;
}

function applyHeaderValidityClasses(state, anySelected) {
  if (!resultsHeader) return;
  resultsHeader.classList.remove("is-valid", "is-invalid");
  if (!anySelected) return;
  if (state === "Valid") resultsHeader.classList.add("is-valid");
  if (state === "Invalid") resultsHeader.classList.add("is-invalid");
}

function setValidityBadge(state, anySelected) {
  if (!validityBadge) return;

  if (!anySelected) {
    validityBadge.hidden = true;
    validityBadge.classList.remove("is-valid", "is-invalid");
    applyHeaderValidityClasses(null, false);
    return;
  }

  validityBadge.hidden = false;
  validityBadge.textContent = state;
  validityBadge.classList.toggle("is-valid", state === "Valid");
  validityBadge.classList.toggle("is-invalid", state === "Invalid");
  applyHeaderValidityClasses(state, true);
}

function setDetailsEmpty() {
  if (!dom.detailsBody) return;
  dom.detailsBody.innerHTML = "";
}

let detailsPopoverRoot;
let detailsPopoverTitle;
let detailsPopoverBody;

function ensureDetailsPopoverDialog() {
  if (detailsPopoverRoot) return;

  const root = document.createElement("div");
  root.className = "details-modal";
  root.id = "detailsModal";
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");

  root.innerHTML = `
    <div class="details-modal__backdrop" data-close="backdrop"></div>
    <div class="details-modal__card" role="document">
      <header class="details-modal__header">
        <h4 class="details-modal__title" id="detailsPopTitle">Details</h4>
        <button class="details-modal__close" type="button" aria-label="Close">×</button>
      </header>
      <div class="details-modal__body" id="detailsPopBody"></div>
    </div>
  `;

  const closeBtn = root.querySelector(".details-modal__close");
  const backdrop = root.querySelector(".details-modal__backdrop");

  const close = () => closeDetailsPopover();
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);

  document.addEventListener("keydown", evt => {
    if (evt.key === "Escape" && root.classList.contains("is-open")) {
      closeDetailsPopover();
    }
  });

  document.body.appendChild(root);

  detailsPopoverRoot = root;
  detailsPopoverTitle = root.querySelector("#detailsPopTitle");
  detailsPopoverBody = root.querySelector("#detailsPopBody");
}

function openDetailsPopover(pop, kind = "") {
  ensureDetailsPopoverDialog();
  if (!detailsPopoverRoot) return;

  const titleEl = pop.querySelector(".popover-title");
  const bodyEl = pop.querySelector(".popover-body");

  detailsPopoverRoot.classList.remove("is-effect", "is-curse");
  const k = kind || pop.getAttribute("data-pop-kind") || "";
  if (k === "effect" || k === "curse") {
    detailsPopoverRoot.classList.add(`is-${k}`);
  }

  if (detailsPopoverTitle) detailsPopoverTitle.textContent = titleEl ? titleEl.textContent : "Details";
  if (detailsPopoverBody) detailsPopoverBody.innerHTML = bodyEl ? bodyEl.innerHTML : pop.innerHTML;

  // Attach copy handlers for any raw-data copy buttons in the injected content
  if (detailsPopoverBody) {
    const copyBtns = detailsPopoverBody.querySelectorAll(".effect-copy-btn[data-copy-raw]");
    copyBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-copy-raw") || "";
        if (!val) return;
        const success = () => showCopyStatus(btn, "Copied to Clipboard", false);
        const fail = () => showCopyStatus(btn, "Copy failed", true);

        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText(val).then(success).catch(() => {
            try {
              fallbackCopy(val);
              success();
            } catch (err) {
              fail();
            }
          });
        } else {
          try {
            fallbackCopy(val);
            success();
          } catch (err) {
            fail();
          }
        }
      });
    });
  }

  detailsPopoverRoot.classList.add("is-open");
  detailsPopoverRoot.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDetailsPopover() {
  if (!detailsPopoverRoot) return;
  detailsPopoverRoot.classList.remove("is-open");
  detailsPopoverRoot.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function showCopyStatus(btn, message, isError = false) {
  if (!btn || !btn.parentElement) return;
  let badge = btn.parentElement.querySelector(".effect-copy-status");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "effect-copy-status";
    btn.parentElement.appendChild(badge);
  }
  badge.textContent = message || "Copied";
  badge.classList.toggle("is-error", !!isError);
  badge.hidden = false;

  const key = "copyStatusTimeout";
  if (badge[key]) clearTimeout(badge[key]);
  badge[key] = setTimeout(() => {
    badge.hidden = true;
    badge[key] = null;
  }, 1500);
}

function formatRelicTypeLabel(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return { label: "Unknown", modifier: "placeholder" };
  if (v.includes("both")) return { label: "Both", modifier: "both" };
  if (v.includes("depth")) return { label: "Depth of Night", modifier: "depth" };
  if (v.includes("standard")) return { label: "Standard", modifier: "standard" };
  return { label: value, modifier: "placeholder" };
}

function chipsForRelicType(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v.includes("both")) {
    return [
      { label: "Standard", modifier: "standard" },
      { label: "Depth of Night", modifier: "depth" }
    ];
  }
  const single = formatRelicTypeLabel(value);
  return [single];
}

function selfStackingMeta(value) {
  const v = String(value ?? "").trim();
  if (v === "1") return { label: "Yes", modifier: "yes" };
  if (v === "0") return { label: "No", modifier: "no" };
  if (v === "2") return { label: "Unknown", modifier: "unknown" };
  return { label: "Unknown", modifier: "unknown" };
}

const ALL_CHARACTER_SET = new Set((CHARACTERS || []).map(c => c.toLowerCase()));

function parseCharactersList(value) {
  const raw = (value ?? "").toString();
  const names = raw.split(",").map(s => s.trim()).filter(Boolean);

  const normalized = names.map(n => n.toLowerCase());
  const hasAllToken = normalized.includes("all");

  // Normalize to canonical ordering where possible, preserve unknowns at the end
  const selected = new Set(normalized);

  const ordered = [];
  for (const canonical of CHARACTERS) {
    if (selected.has(canonical.toLowerCase())) ordered.push(canonical);
  }

  const extras = names.filter(n => !ALL_CHARACTER_SET.has(n.toLowerCase()));
  const fullList = [...ordered, ...extras];

  const isAll = hasAllToken || (ALL_CHARACTER_SET.size > 0 && ordered.length === ALL_CHARACTER_SET.size && extras.length === 0);
  const chipMeta = fullList.map(name => {
    const token = characterColors(name);
    return { name, slug: token.slug, colors: token };
  });

  return { list: fullList, isAll, chipMeta };
}

function buildEffectInfoPopover(row, rawText, kind = "effect") {
  const pop = document.createElement("div");
  pop.setAttribute("data-pop-kind", kind === "curse" ? "curse" : "effect");

  const title = document.createElement("div");
  title.className = "popover-title";
  title.textContent = "Effect Information";

  const body = document.createElement("div");
  body.className = "popover-body";

  if (!row) {
    body.innerHTML = `<p>Unable to load details for this entry.</p>`;
    pop.append(title, body);
    return pop;
  }

  const name = row.EffectDescription ?? `(Effect ${row.EffectID ?? "?"})`;
  const extendedDescription = row?.EffectExtendedDescription ?? "";
  const relicChips = chipsForRelicType(row.RelicType);
  const selfStacking = selfStackingMeta(row?.SelfStacking);
  const characters = parseCharactersList(row?.Characters);
  const entryKind = kind === "curse" ? "Curse" : "Effect";
  const rawValueFull = rawText && String(rawText).trim()
    ? String(rawText).trim()
    : `EffectID ${row.EffectID ?? "?"}`;

  // For effect popups, omit any curse-specific fragments from the raw data string
  const rawValue = (() => {
    if (kind === "curse") return rawValueFull;
    const parts = rawValueFull.split("•").map(s => s.trim()).filter(Boolean);
    const filtered = parts.filter(p => !/^curse/i.test(p));
    return filtered.join(" • ") || rawValueFull;
  })();

  const curseRequired = String(row?.CurseRequired ?? "0") === "1";
  const compatibility = row?.CompatibilityID ?? "";
  const rollOrder = row?.RollOrder ?? "";
  const relicTypeText = relicChips.map(chip => chip.label).join(" / ") || "Unknown";

  // TSV-style payload so Excel pastes into rows (Label | Value)
  const copyRows = [
    ["Entry Type", entryKind],
    ["Effect Name", name],
    ["Extended Description", extendedDescription],
    ["EffectID", row?.EffectID ?? ""],
    ["Relic Type", relicTypeText],
    ["Curse Required", curseRequired ? "Yes" : "No"],
    ["Self-Stacking", selfStacking.label],
    ["Characters", characters.list.join(", ") || "∅"],
    ["Compatibility", compatibility === "" ? "∅" : compatibility],
    ["Roll Order", rollOrder === "" ? "∅" : rollOrder],
    ["Raw", rawValue]
  ];

  const copyPayload = copyRows
    .filter(([_, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}\t${v}`)
    .join("\n");

  body.innerHTML = `
    <div class="effect-info-grid">
      <div class="effect-info-section">
        <div class="effect-info-label">Effect Name</div>
        <div class="effect-info-divider" aria-hidden="true"></div>
        <div class="effect-info-value">
          <span class="effect-info-name">${escapeHtml(name)}</span>
        </div>
      </div>

      <div class="effect-info-section">
        <div class="effect-info-label">Extended Description</div>
        <div class="effect-info-divider" aria-hidden="true"></div>
        <div class="effect-info-value">
          <span>${escapeHtml(extendedDescription || "—")}</span>
        </div>
      </div>

      <div class="effect-info-section">
        <div class="effect-info-label">Relic Type</div>
        <div class="effect-info-divider" aria-hidden="true"></div>
        <div class="effect-info-value">
          ${relicChips.map(chip => `
            <span class="effect-chip effect-chip--relic effect-chip--${chip.modifier || "placeholder"}">${escapeHtml(chip.label)}</span>
          `).join("")}
        </div>
      </div>

      <div class="effect-info-section">
        <div class="effect-info-label">Curse Required</div>
        <div class="effect-info-divider" aria-hidden="true"></div>
        <div class="effect-info-value">
          <span class="effect-chip effect-chip--curse-${curseRequired ? "yes" : "no"}">${curseRequired ? "Yes" : "No"}</span>
        </div>
      </div>

      <div class="effect-info-section">
        <div class="effect-info-label">Characters</div>
        <div class="effect-info-divider" aria-hidden="true"></div>
        <div class="effect-info-value">
          ${(() => {
            if (!characters.list.length) return `<span class="effect-chip effect-chip--placeholder">None Listed</span>`;
            if (characters.isAll) return `<span class="effect-chip effect-chip--character effect-chip--character-all">All Characters</span>`;
            return characters.chipMeta.map(({ name, slug }) => `
              <span class="effect-chip effect-chip--character effect-chip--character-${slug}">${escapeHtml(name)}</span>
            `).join("");
          })()}
        </div>
      </div>

      <div class="effect-info-section">
        <div class="effect-info-label">Self-Stacking</div>
        <div class="effect-info-divider" aria-hidden="true"></div>
        <div class="effect-info-value">
          <span class="effect-chip effect-chip--self-stack effect-chip--self-stack-${selfStacking.modifier}">${selfStacking.label}</span>
        </div>
      </div>

      <div class="effect-info-section">
        <div class="effect-info-label effect-info-label--with-action">
          <span>Raw Data</span>
          <button
            type="button"
            class="effect-copy-btn"
            aria-label="Copy raw data"
            title="Copy raw data"
            data-copy-raw="${escapeHtml(copyPayload)}"
          >
            <span class="effect-copy-icon" aria-hidden="true"></span>
          </button>
        </div>
        <div class="effect-info-divider" aria-hidden="true"></div>
        <div class="effect-info-value">
          <code class="effect-raw">${escapeHtml(rawValue)}</code>
        </div>
      </div>
    </div>
  `;

  pop.append(title, body);
  return pop;
}

function openInfoPopoverForButton(btn) {
  if (!btn) return;
  const effectId = btn.getAttribute("data-effect-id");
  if (!effectId) return;
  const kind = btn.getAttribute("data-info-kind") || "effect";
  const raw = btn.getAttribute("data-info-raw") || "";
  const row = getAnyRow(effectId);
  const pop = buildEffectInfoPopover(row, raw, kind);
  openDetailsPopover(pop, kind);
}

function installUtilityPopoverButtons() {
  const pairs = [
    [dom.instructionsBtn, dom.instructionsPopover],
    [dom.disclaimerBtn, dom.disclaimerPopover],
    [dom.instructionsBtnChalice, dom.instructionsPopover]
  ];

  pairs.forEach(([btn, pop]) => {
    if (!btn || !pop) return;
    btn.addEventListener("click", () => openDetailsPopover(pop));
  });
}

function installDetailsToggles() {
  if (!dom.detailsBody) return;
  const buttons = dom.detailsBody.querySelectorAll("[data-popover-toggle]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-popover-toggle");
      if (!id) return;
      const pop = dom.detailsBody.querySelector(`#${CSS.escape(id)}`);
      if (!pop) return;
      openDetailsPopover(pop);
    });
  });
}

function markLineReordered(html) {
  return html.replace("<li>", `<li class="reorder-changed">`);
}

function slotLabel(idx) {
  return idx === 0 ? "Effect 1" : idx === 1 ? "Effect 2" : "Effect 3";
}

let curseDialog;
let curseDialogTitle;
let effectDialog;
let effectDialogTitle;

function ensureCurseDialog() {
  if (curseDialog) return;

  const d = document.createElement("dialog");
  d.className = "curse-dialog";
  d.innerHTML = `
    <form method="dialog" class="curse-dialog__form">
      <header class="curse-dialog__header">
        <h4 class="curse-dialog__title" id="curseDialogTitle">Select a Curse</h4>
        <button type="button" class="curse-dialog__close" aria-label="Close">✕</button>
      </header>

      <div class="curse-dialog__body">
        <div class="curse-dialog__controls">
          <label class="curse-field">
            <span class="curse-field__label">Curse Category</span>
            <select id="curseCategorySelect">
              <option value="">All</option>
            </select>
          </label>

          <label class="curse-field">
            <span class="curse-field__label">Curse</span>
            <select id="curseEffectSelect">
              <option value="">Select a Curse…</option>
            </select>
          </label>
        </div>
      </div>

      <footer class="curse-dialog__footer">
        <button type="button" class="secondary" id="curseClearBtn">Clear Curse</button>
        <div class="curse-dialog__footer-right">
          <button type="button" class="secondary" id="curseCancelBtn">Cancel</button>
          <button type="submit" class="primary" id="curseSubmitBtn" disabled>Apply Curse</button>
        </div>
      </footer>
    </form>
  `;
  document.body.appendChild(d);

  curseDialog = d;
  curseDialogTitle = d.querySelector("#curseDialogTitle");

  const closeBtn = d.querySelector(".curse-dialog__close");
  const cancelBtn = d.querySelector("#curseCancelBtn");
  if (closeBtn) closeBtn.onclick = () => d.close("cancel");
  if (cancelBtn) cancelBtn.onclick = () => d.close("cancel");
}

function ensureEffectDialog() {
  if (effectDialog) return;

  const d = document.createElement("dialog");
  d.className = "effect-dialog";
  d.innerHTML = `
    <form method="dialog" class="effect-dialog__form">
      <header class="effect-dialog__header">
        <h4 class="effect-dialog__title" id="effectDialogTitle">Select an Effect</h4>
        <button type="button" class="effect-dialog__close" aria-label="Close">✕</button>
      </header>

      <div class="effect-dialog__body">
        <div class="effect-dialog__controls">
          <label class="effect-field">
            <span class="effect-field__label">Effect Category</span>
            <select id="effectCategorySelect">
              <option value="">All</option>
            </select>
          </label>

          <label class="effect-field">
            <span class="effect-field__label">Effect</span>
            <select id="effectSelect">
              <option value="">Select an Effect…</option>
            </select>
          </label>
        </div>
      </div>

      <footer class="effect-dialog__footer">
        <button type="button" class="secondary" id="effectClearBtn">Clear Slot</button>
        <div class="effect-dialog__footer-right">
          <button type="button" class="secondary" id="effectCancelBtn">Cancel</button>
          <button type="submit" class="primary" id="effectSubmitBtn" disabled>Apply Effect</button>
        </div>
      </footer>
    </form>
  `;
  document.body.appendChild(d);

  effectDialog = d;
  effectDialogTitle = d.querySelector("#effectDialogTitle");

  const closeBtn = d.querySelector(".effect-dialog__close");
  const cancelBtn = d.querySelector("#effectCancelBtn");
  if (closeBtn) closeBtn.onclick = () => d.close("cancel");
  if (cancelBtn) cancelBtn.onclick = () => d.close("cancel");
}

function computeBlockedCompatForCurse(slotIdx) {
  const blocked = new Set();

  const selections = [getSelectedRow(0), getSelectedRow(1), getSelectedRow(2)];
  for (const r of selections) {
    const cid = compatId(r);
    if (cid) blocked.add(String(cid));
  }

  for (let i = 0; i < curseBySlot.length; i++) {
    if (i === slotIdx) continue;
    const cRow = getAnyRow(curseBySlot[i]);
    const cid = compatId(cRow);
    if (cid) blocked.add(String(cid));
  }

  // Allow keeping the currently selected curse even if it would otherwise be blocked
  const current = getAnyRow(curseBySlot[slotIdx]);
  const currentCid = compatId(current);
  if (currentCid) blocked.delete(String(currentCid));

  return blocked;
}

function openCurseDialog(slotIdx) {
  ensureCurseDialog();
  if (!curseDialog) return;

  const catSel = curseDialog.querySelector("#curseCategorySelect");
  const effectSel = curseDialog.querySelector("#curseEffectSelect");
  const submitBtn = curseDialog.querySelector("#curseSubmitBtn");
  const clearBtn = curseDialog.querySelector("#curseClearBtn");

  if (!catSel || !effectSel || !submitBtn || !clearBtn) return;

  if (curseDialogTitle) curseDialogTitle.textContent = `Select a Curse for ${slotLabel(slotIdx)}`;

  const blockedCompat = computeBlockedCompatForCurse(slotIdx);
  const eligibleCurses = baseFilteredByRelicType(curses, effectiveRelicType(true))
    .filter(r => {
      const cid = compatId(r);
      if (!cid) return true;
      return !blockedCompat.has(String(cid));
    })
    .sort((x, y) => getRollValue(x) - getRollValue(y));

  const currentId = curseBySlot[slotIdx] ? String(curseBySlot[slotIdx]) : "";

  if (!curseCatBySlot[slotIdx] && currentId) {
    const curRow = getAnyRow(currentId);
    const curCat = curRow ? String(curRow.EffectCategory || "").trim() : "";
    curseCatBySlot[slotIdx] = curCat;
  }

  const cats = categoriesFor(eligibleCurses);
  catSel.innerHTML = `<option value="">All</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
  catSel.value = curseCatBySlot[slotIdx] || "";

  function renderEffectOptions() {
    const catVal = catSel.value || "";
    curseCatBySlot[slotIdx] = catVal;

    const filtered = applyCategory(eligibleCurses, catVal);

    if (filtered.length === 0) {
      effectSel.innerHTML = `<option value="">No curses available</option>`;
      effectSel.value = "";
      effectSel.disabled = true;
      submitBtn.disabled = true;
      return;
    }

    effectSel.disabled = false;
    effectSel.innerHTML =
      `<option value="">Select a Curse…</option>` +
      filtered.map(r => {
        const id = String(r.EffectID);
        const name = r.EffectDescription ?? `(Effect ${id})`;
        return `<option value="${id}">${name}</option>`;
      }).join("");

    if (currentId && [...effectSel.options].some(o => o.value === currentId)) {
      effectSel.value = currentId;
      submitBtn.disabled = false;
    } else {
      effectSel.value = "";
      submitBtn.disabled = true;
    }
  }

  renderEffectOptions();

  catSel.onchange = () => renderEffectOptions();
  effectSel.onchange = () => {
    submitBtn.disabled = !(effectSel.value && effectSel.value !== "");
  };

  clearBtn.onclick = () => {
    curseBySlot[slotIdx] = null;
    curseDialog.close("clear");
    updateUI("curse-change");
  };

  submitBtn.onclick = () => {
    const v = String(effectSel.value || "");
    if (!v) return;
    curseBySlot[slotIdx] = v;
    curseDialog.close("apply");
    updateUI("curse-change");
  };

  curseDialog.showModal();
}

function installCurseButtons() {
  const btns = document.querySelectorAll("[data-curse-slot]");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const slotIdx = Number.parseInt(btn.getAttribute("data-curse-slot") || "-1", 10);
      if (!Number.isFinite(slotIdx) || slotIdx < 0 || slotIdx > 2) return;
      if (btn.hasAttribute("disabled")) return;
      openCurseMenuForSlot(slotIdx, btn);
    });
  });

  const clearBtns = document.querySelectorAll("[data-curse-clear-slot]");
  clearBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const slotIdx = Number.parseInt(btn.getAttribute("data-curse-clear-slot") || "-1", 10);
      if (!Number.isFinite(slotIdx) || slotIdx < 0 || slotIdx > 2) return;
      curseBySlot[slotIdx] = null;
      updateUI("curse-change");
    });
  });
}

function computeEligibilityForSlot(slotIdx, showIllegalOverride = null) {
  const showIllegal = showIllegalOverride ?? isShowIllegalActive();

  if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx > 2) {
    return { eligible: [], filtered: [], categories: [], currentId: "" };
  }

  const type = effectiveRelicType(true);
  const base = filterByClass(baseFilteredByRelicType(rows, type));
  const selectedRows = [getSelectedRow(0), getSelectedRow(1), getSelectedRow(2)];

  const taken = new Set();
  const blocked = new Set();

  for (let i = 0; i < selectedEffects.length; i++) {
    if (i === slotIdx) continue;

    const id = selectedEffects[i];
    if (id) taken.add(String(id));

    const cid = compatId(selectedRows[i]);
    if (cid) blocked.add(cid);
  }

  const eligible = eligibleList(base, type, blocked, taken, showIllegal);
  const categorySource = eligible.length ? eligible : base;

  return {
    eligible,
    filtered: categorySource,
    pool: categorySource,
    categories: categoriesFor(categorySource),
    currentId: getSelectedId(slotIdx)
  };
}

function computeEffectDialogData(slotIdx, showIllegalOverride = null) {
  if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx > 2) {
    return { disabled: true, reason: "Invalid slot" };
  }

  const data = computeEligibilityForSlot(slotIdx, showIllegalOverride);

  return {
    disabled: false,
    categories: data.categories,
    eligible: data.eligible,
    filtered: data.filtered,
    currentId: data.currentId
  };
}

// Menu logic migrated to reliquary.menus.js

function openEffectDialog(slotIdx) {
  ensureEffectDialog();
  if (!effectDialog) return;

  const catSel = effectDialog.querySelector("#effectCategorySelect");
  const effectSel = effectDialog.querySelector("#effectSelect");
  const submitBtn = effectDialog.querySelector("#effectSubmitBtn");
  const clearBtn = effectDialog.querySelector("#effectClearBtn");

  if (!catSel || !effectSel || !submitBtn || !clearBtn) return;

  const data = computeEffectDialogData(slotIdx);
  if (data.disabled) return;

  if (effectDialogTitle) effectDialogTitle.textContent = `Select an Effect for ${slotLabel(slotIdx)}`;

  catSel.innerHTML = `<option value="">All</option>` + (data.categories || []).map(c => `<option value="${c}">${c}</option>`).join("");
  catSel.value = selectedCats[slotIdx] || "";

  function renderEffectOptions() {
    const catVal = catSel.value || "";
    selectedCats[slotIdx] = catVal;

    const filtered = applyCategory(data.filtered || [], catVal);

    if (!filtered.length) {
      effectSel.innerHTML = `<option value="">No effects available</option>`;
      effectSel.value = "";
      effectSel.disabled = true;
      submitBtn.disabled = true;
      return;
    }

    effectSel.disabled = false;
    effectSel.innerHTML = `<option value="">Select an Effect…</option>` + filtered.map(r => {
      const id = String(r.EffectID);
      const name = r.EffectDescription ?? `(Effect ${id})`;
      return `<option value="${id}">${name}</option>`;
    }).join("");

    const currentId = data.currentId || "";
    if (currentId && [...effectSel.options].some(o => o.value === currentId)) {
      effectSel.value = currentId;
      submitBtn.disabled = false;
    } else {
      effectSel.value = "";
      submitBtn.disabled = true;
    }
  }

  renderEffectOptions();

  catSel.onchange = () => renderEffectOptions();
  effectSel.onchange = () => {
    submitBtn.disabled = !(effectSel.value && effectSel.value !== "");
  };

  clearBtn.onclick = () => {
    setSelectedId(slotIdx, "");
    curseBySlot[slotIdx] = null;
    effectDialog.close("clear");
    updateUI("effect-change");
  };

  submitBtn.onclick = () => {
    const v = String(effectSel.value || "");
    if (!v) return;
    setSelectedId(slotIdx, v);
    curseBySlot[slotIdx] = null;

    const chosen = getRow(v);
    const nextType = autoRelicTypeFromEffect1(dom.selType.value, chosen);
    maybeAutoSetTypeFromEffect1(nextType);
    maybeAutoSetClassFromRow(chosen);

    effectDialog.close("apply");
    updateUI("effect-change");
  };

  effectDialog.showModal();
}

function installEffectButtons() {
  const btns = document.querySelectorAll("[data-effect-slot]");
  btns.forEach(btn => {
    btn.addEventListener("click", evt => {
      const slotIdx = Number.parseInt(btn.getAttribute("data-effect-slot") || "-1", 10);
      if (!Number.isFinite(slotIdx) || slotIdx < 0 || slotIdx > 2) return;
      if (btn.hasAttribute("disabled")) return;
      openEffectMenuForSlot(slotIdx, btn, evt);
    });
  });

  const clearBtns = document.querySelectorAll("[data-effect-clear-slot]");
  clearBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const slotIdx = Number.parseInt(btn.getAttribute("data-effect-clear-slot") || "-1", 10);
      if (!Number.isFinite(slotIdx) || slotIdx < 0 || slotIdx > 2) return;
      setSelectedId(slotIdx, "");
      curseBySlot[slotIdx] = null;
      updateUI("effect-change");
    });
  });
}

function installInfoButtons() {
  const infoBtns = document.querySelectorAll(".info-btn[data-effect-id]");
  infoBtns.forEach(btn => {
    btn.addEventListener("click", () => openInfoPopoverForButton(btn));
  });
}

function installRowCopyButtons() {
  const copyBtns = document.querySelectorAll("[data-copy-effect-id], [data-copy-curse-id]");

  copyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-copy-effect-id") || btn.getAttribute("data-copy-curse-id") || "";
      if (!val) return;

      const label = btn.hasAttribute("data-copy-curse-id") ? "CurseID" : "EffectID";
      const success = () => showCopyStatus(btn, `${label} copied`, false);
      const fail = () => showCopyStatus(btn, "Copy failed", true);

      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(val).then(success).catch(() => {
          try {
            fallbackCopy(val);
            success();
          } catch (err) {
            fail();
          }
        });
      } else {
        try {
          fallbackCopy(val);
          success();
        } catch (err) {
          fail();
        }
      }
    });
  });
}

function updateDetails(a, b, c) {
  if (!dom.detailsBody) return;

  const selected = [a, b, c].filter(Boolean);

  const blocks = [];

  if (!isAutoSortEnabled()) {
    blocks.push(`
      <div class="info-box is-warning" data-kind="auto-sort-off">
        <div class="info-line">
          <span>Auto-Sort is currently off;</span>
          <button type="button" class="term-link" data-popover-toggle="autoSortPopover">roll order won't auto-fix</button>
          <span>until you turn it back on.</span>
        </div>

        <div id="autoSortPopover" class="popover" hidden>
          <h4 class="popover-title">Auto-Sort</h4>
          <div class="popover-body">
            <p>Auto-Sort reorders your effects into correct roll order automatically when a valid ordering exists.</p>
            <p>You can turn it back on to keep roll order correct, or leave it off if you prefer to arrange manually. You can also tap the Auto-Sort action in the header when roll issues appear.</p>
          </div>
        </div>
      </div>
    `);
  }

  if (isShowIllegalActive()) {
    blocks.push(`
      <div class="info-box is-alert" data-kind="show-illegal-on">
        <div class="info-line">
          <span>Showing illegal combinations;</span>
          <button type="button" class="term-link" data-popover-toggle="illegalPopover">type filtering is ignored</button>
          <span>while this is on.</span>
        </div>

        <div id="illegalPopover" class="popover" hidden>
          <h4 class="popover-title">Illegal combinations</h4>
          <div class="popover-body">
            <p>When enabled, all effects are shown even if they violate compatibility or type rules. Roll order and validity checks may be invalid while this is on.</p>
            <p>Turn it off to filter to legal combinations again.</p>
          </div>
        </div>
      </div>
    `);
  }

  if (selected.length < 1) {
    dom.detailsBody.innerHTML = blocks.join("");
    installDetailsToggles();
    return;
  }

  const relicTypeIssue = relicTypeMismatchInfo([a, b, c]);

  const dupGroups = (selected.length >= 2) ? computeCompatDupGroups(selected) : [];
  const hasDup = dupGroups.length > 0;

  const missingCurseSlots = [];
  const orig = [a, b, c];
  for (let i = 0; i < orig.length; i++) {
    const r = orig[i];
    if (!r) continue;
    const req = String(r?.CurseRequired ?? "0") === "1";
    if (req && !curseBySlot[i]) missingCurseSlots.push(i);
  }

  const positionIssue = computePositionIssue(a, b, c);

  if (missingCurseSlots.length > 0) {
    const labels = missingCurseSlots.map(i => slotLabel(i)).join(", ");
    blocks.push(`
      <div class="info-box is-alert" data-kind="curse-required">
        <div class="info-line">
          <span>One or more of your effects requires a </span>
          <button type="button" class="term-link" data-popover-toggle="cursePopover">Curse</button>.
        </div>

        <div id="cursePopover" class="popover" hidden>
          <h4 class="popover-title">Curse Required</h4>
          <div class="popover-body">
            <p><em>On Depth of Night Relics only, certain effects cannot be rolled without an accompanying Curse.</em> Select a Curse for each effect that requires one before your relic can be finalized.</p>
            <p>Missing for: <strong>${labels}</strong>.</p>
          </div>
        </div>
      </div>
    `);
  }

  if (relicTypeIssue.hasIssue) {
    blocks.push(`
      <div class="info-box is-alert" data-kind="relic-type">
        <div class="info-line">
          Mismatched
          <button type="button" class="term-link" data-popover-toggle="relicTypePopover">Relic Types</button>.
        </div>

        <div class="popover" id="relicTypePopover" hidden>
          <div class="popover-title">Mismatched Relic Types</div>
          <div class="popover-body popover-body--spaced">
            <p>Certain effects can only appear on certain Relic Types.</p>
            <p>You cannot have a Standard relic effect on a Depth of Night relic, and vice versa.</p>
          </div>
        </div>
      </div>
    `);
  }

  if (positionIssue.hasIssue) {
    blocks.push(`
      <div class="info-box is-alert" data-kind="positioning">
        <div class="info-line">
          Improper effect
          <button type="button" class="term-link" data-popover-toggle="positionPopover">Positioning</button>.
        </div>

        <div class="popover" id="positionPopover" hidden>
          <div class="popover-title">Improper Effect Positioning</div>
          <div class="popover-body popover-body--spaced">
            <p>Please add effects starting at slot 1 and fill each next slot in order.</p>
          </div>
        </div>
      </div>
    `);
  }

  if (hasDup) {
    blocks.push(`
      <div class="info-box is-alert" data-kind="compat-dup">
        <div class="info-line">
          You have conflicting
          <button type="button" class="term-link" data-popover-toggle="compatPopover">
            Compatibility Groups
          </button>.
        </div>

        <div class="popover" id="compatPopover" hidden>
          <div class="popover-title">Compatibility Group</div>
          <div class="popover-body popover-body--spaced">
            <p>Relics cannot have more than one effect from the same Compatibility Group.</p>
            <p>Some effects share a group even if their names differ.</p>
          </div>
        </div>
      </div>
    `);
  }

  const roll = (selected.length >= 2) ? computeRollOrderIssue(a, b, c) : { hasIssue: false };
  const orderIssueVisible = roll.hasIssue && !positionIssue.hasIssue && selected.length >= 2 && !isAutoSortEnabled();

  if (orderIssueVisible) {
    blocks.push(`
      <div class="info-box is-alert" data-kind="rollorder">
        <div class="info-line">
          Your effects aren't in the correct 
          <button type="button" class="term-link" data-popover-toggle="orderPopover">Roll Order</button>.
        </div>

        <div class="popover" id="orderPopover" hidden>
          <div class="popover-title">Roll Order</div>
          <div class="popover-body popover-body--spaced">
            <p>Each effect has a Roll Order value; the relic must list effects in ascending order.</p>
          </div>
        </div>
      </div>
    `);
  }

  dom.detailsBody.innerHTML = blocks.join("");
  installDetailsToggles();

  if (orderIssueVisible && roll.sorted) {
    const list = dom.detailsBody.querySelector("#sortedChosenList");
    if (list) {
      let line1 = renderChosenLine("", roll.sorted[0], false);
      let line2 = renderChosenLine("", roll.sorted[1], false);
      let line3 = renderChosenLine("", roll.sorted[2], false);

      if (roll.movedSlots[0]) line1 = markLineReordered(line1);
      if (roll.movedSlots[1]) line2 = markLineReordered(line2);
      if (roll.movedSlots[2]) line3 = markLineReordered(line3);

      list.innerHTML = line1 + line2 + line3;
    }
  }
}

function openEffectMenuForSlot(slotIdx, anchorBtn) {
  const data = computeEffectDialogData(slotIdx);
  if (data.disabled) {
    if (dom.statusText && data.reason) dom.statusText.textContent = data.reason;
    return;
  }

  const preferredCat = selectedCats[slotIdx] && data.categories.includes(selectedCats[slotIdx])
    ? selectedCats[slotIdx]
    : "";

  openEffectMenu({
    slotIdx,
    anchorBtn,
    eligible: data.eligible || [],
    categories: data.categories || [],
    currentId: data.currentId || "",
    selectedCategory: preferredCat,
    onPick: (id, activeCategory) => {
      setSelectedId(slotIdx, id);
      selectedCats[slotIdx] = activeCategory || "";
      curseBySlot[slotIdx] = null;

      const chosen = getRow(id);
      const nextType = autoRelicTypeFromEffect1(dom.selType.value, chosen);
      maybeAutoSetTypeFromEffect1(nextType);
      maybeAutoSetClassFromRow(chosen);

      updateUI("effect-change");
    }
  });
}

function openCurseMenuForSlot(slotIdx, anchorBtn) {
  closeCurseMenu();

  const blockedCompat = computeBlockedCompatForCurse(slotIdx);
  const eligibleCurses = filterByClass(baseFilteredByRelicType(curses, effectiveRelicType(true)))
    .filter(r => {
      const cid = compatId(r);
      if (!cid) return true;
      return !blockedCompat.has(String(cid));
    })
    .sort((x, y) => getRollValue(x) - getRollValue(y));

  if (!eligibleCurses.length) return;

  const currentId = curseBySlot[slotIdx] ? String(curseBySlot[slotIdx]) : "";
  if (!curseCatBySlot[slotIdx] && currentId) {
    const curRow = getAnyRow(currentId);
    const curCat = curRow ? String(curRow.EffectCategory || "").trim() : "";
    curseCatBySlot[slotIdx] = curCat;
  }

  const categories = categoriesFor(eligibleCurses);

  openCurseMenu({
    slotIdx,
    anchorBtn,
    eligible: eligibleCurses,
    categories,
    currentId,
    selectedCategory: curseCatBySlot[slotIdx] || "",
    onPick: (id, activeCategory) => {
      curseBySlot[slotIdx] = id;
      curseCatBySlot[slotIdx] = activeCategory || "";
      updateUI("curse-change");
    }
  });
}

function updateUI(reason = "") {
  closeEffectMenu();
  closeCurseMenu();
  closeColorMenu();

  // regroup after UI changes that can alter validity/colors
  if (isChaliceMode()) {
    renderChaliceColors();
    applyChaliceGrouping();
  }

  if (selectedColor === "Random") {
    const modifierReasons = new Set([
      "type-change",
      "illegal-change",
      "cat-change",
      "effect-change",
      "init"
    ]);
    if (modifierReasons.has(reason)) pickRandomColor();
  }

  const showIllegal = isShowIllegalActive();

  let cleared = false;
  for (let i = selectedEffects.length - 1; i >= 0; i--) {
    const eligibility = computeEligibilityForSlot(i, showIllegal);
    const eligibleIds = new Set((eligibility.eligible || []).map(r => String(r.EffectID)));

    const id = selectedEffects[i];
    if (!id) continue;
    if (!eligibleIds.has(id)) {
      setSelectedId(i, "");
      curseBySlot[i] = null;
      cleared = true;
    }
  }

  if (cleared) {
    updateUI(reason);
    return;
  }

  const slotData = [0, 1, 2].map(idx => computeEligibilityForSlot(idx, showIllegal));

  const cSelections = [getSelectedRow(0), getSelectedRow(1), getSelectedRow(2)];
  const selectedCount = cSelections.filter(Boolean).length;
  const stage = Math.min(selectedCount, 3);

  setRelicImageForStage({
    relicImg: dom.relicImg,
    selectedType: effectiveRelicType(),
    selectedColor,
    randomColor: currentRandomColor,
    stage
  });

  updateColorChipLabel();

  const probabilityResult = computeRelicProbability(cSelections, dom.selType ? dom.selType.value : "");
  setRelicProbability(probabilityResult);

  const anySelected = cSelections.some(Boolean);
  const dupGroups = computeCompatDupGroups(cSelections.filter(Boolean));
  const hasCompatIssue = dupGroups.length > 0;

  const relicTypeIssue = relicTypeMismatchInfo(cSelections);
  const hasRelicTypeIssue = relicTypeIssue.hasIssue;

  const compatConflictIds = (() => {
    const m = new Map();
    for (const r of cSelections.filter(Boolean)) {
      const cid = compatId(r);
      if (!cid) continue;
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid).push(String(r.EffectID));
    }
    const out = new Set();
    for (const [, ids] of m.entries()) {
      if (ids.length > 1) ids.forEach(id => out.add(id));
    }
    return out;
  })();

  function badgeForRow(r) {
    if (!r) return null;
    if (hasRelicTypeIssue && relicTypeIssue.ids.has(String(r.EffectID))) return "Relic Type";
    return compatConflictIds.has(String(r.EffectID)) ? "Incompatible" : null;
  }

  const roll = computeRollOrderIssue(cSelections[0], cSelections[1], cSelections[2]);
  const positionIssue = computePositionIssue(cSelections[0], cSelections[1], cSelections[2]);
  const hasPositionIssue = positionIssue.hasIssue;

  // Only treat roll-order issues as actionable when the fill is sequential (no gaps) and at least two slots are filled.
  const hasOrderIssueRaw = roll.hasIssue;
  const orderIssueActive = hasOrderIssueRaw && !hasPositionIssue && selectedCount >= 2;
  const orderIssueVisible = orderIssueActive && !isAutoSortEnabled();
  const moveDeltaBySlot = orderIssueVisible ? (roll.moveDeltaBySlot || [0, 0, 0]) : [0, 0, 0];

  if (shouldAutoSort(reason, roll, positionIssue, selectedCount)) {
    applyAutoSort();
    return;
  }

  if (autoSortBtn) {
    const showAutoSort = orderIssueActive && !isAutoSortEnabled();
    autoSortBtn.hidden = !showAutoSort;
    autoSortBtn.disabled = !showAutoSort;
  }

  const hasCurseMissing = (() => {
    for (let i = 0; i < cSelections.length; i++) {
      const r = cSelections[i];
      if (!r) continue;
      const req = String(r?.CurseRequired ?? "0") === "1";
      if (req && !curseBySlot[i]) return true;
    }
    return false;
  })();

  const state = anySelected && (hasCompatIssue || hasRelicTypeIssue || orderIssueVisible || hasCurseMissing || hasPositionIssue) ? "Invalid" : "Valid";
  setValidityBadge(state, anySelected);

  const okBySlot = [false, false, false];

  for (let i = 0; i < cSelections.length; i++) {
    const row = cSelections[i];
    if (!row) continue;

    const compatBad = compatConflictIds.has(String(row.EffectID));
    const relicTypeBad = hasRelicTypeIssue && relicTypeIssue.ids.has(String(row.EffectID));
    const orderBad = orderIssueVisible && moveDeltaBySlot[i] !== 0;
    const curseReq = String(row?.CurseRequired ?? "0") === "1";
    const curseMissing = curseReq && !curseBySlot[i];
    const positionBad = hasPositionIssue && positionIssue.badSlots.includes(i);

    if (!compatBad && !relicTypeBad && !orderBad && !curseMissing && !positionBad) okBySlot[i] = true;
  }

  const effectButtonDisabled = [false, false, false];

  function renderSlot(idx, row, moveDelta, showOk, badge) {
    const effectBtnLabel = row ? "Change Effect" : "Select Effect";
    return renderChosenLine(slotLabel(idx), row, false, moveDelta, showOk, badge, {
      effectSlot: idx,
      effectButtonLabel: effectBtnLabel,
      effectButtonDisabled: effectButtonDisabled[idx],
      curseRequired: String(row?.CurseRequired ?? "0") === "1",
      curseRow: getAnyRow(curseBySlot[idx]),
      curseButtonLabel: curseBySlot[idx] ? "Change Curse" : "Select a Curse",
      curseSlot: idx
    });
  }

  updateDetails(cSelections[0], cSelections[1], cSelections[2]);

  dom.chosenList.innerHTML =
    renderSlot(0, cSelections[0], moveDeltaBySlot[0], okBySlot[0], badgeForRow(cSelections[0])) +
    renderSlot(1, cSelections[1], moveDeltaBySlot[1], okBySlot[1], badgeForRow(cSelections[1])) +
    renderSlot(2, cSelections[2], moveDeltaBySlot[2], okBySlot[2], badgeForRow(cSelections[2]));

  installEffectButtons();
  installCurseButtons();
  installInfoButtons();
  installRowCopyButtons();

  const firstEmptyIdx = cSelections.findIndex(r => !r);
  const activeIndex = firstEmptyIdx === -1 ? 0 : firstEmptyIdx + 1;
  const filteredForActiveSlot = firstEmptyIdx === -1
    ? []
    : applyCategory(slotData[firstEmptyIdx]?.filtered || [], selectedCats[firstEmptyIdx]);
  const availableCount = firstEmptyIdx === -1 ? 0 : filteredForActiveSlot.length;
  updateCounts(dom, activeIndex, availableCount);
}

// ---------------------- Chalice Builder ----------------------

function chaliceRow(effectId) {
  if (!effectId) return null;
  return getRow(effectId) || getAnyRow(effectId) || null;
}

function computeChaliceStackingIssues() {
  const counts = new Map();
  const slotsById = new Map();
  const ids = [...chaliceSelections.standard, ...chaliceSelections.depth].filter(Boolean);

  ["standard", "depth"].forEach(sideKey => {
    (chaliceSelections[sideKey] || []).forEach((id, slot) => {
      if (!id) return;
      const key = String(id);
      counts.set(key, (counts.get(key) || 0) + 1);
      const slots = slotsById.get(key) || [];
      slots.push({ side: sideKey, slot });
      slotsById.set(key, slots);
    });
  });

  const errors = [];
  const warnings = [];

  counts.forEach((count, id) => {
    if (count <= 1) return;
    const row = chaliceRow(id);
    const meta = selfStackingMeta(row?.SelfStacking);
    const name = row?.EffectDescription ?? `Effect ${id}`;
    const base = `${name} is selected ${count} times`;
    const slots = slotsById.get(id) || [];
    const idsInSlots = slots.map(s => String(chaliceSelections[s.side]?.[s.slot] || id));

    if (meta.modifier === "no") {
      errors.push({
        message: `${base}, but it does not self-stack.`,
        slots,
        ids: idsInSlots,
        code: "stacking-disallow"
      });
      return;
    }

    if (meta.modifier === "unknown") {
      warnings.push({
        message: `${base}, and stacking for this effect is unknown.`,
        slots,
        ids: idsInSlots,
        code: "stacking-unknown"
      });
    }
  });

  return { errors, warnings };
}

function unplacedIssuesForSide(result, meta) {
  const issues = [];
  const totalSelected = Number.parseInt(result?.selectedCount, 10) || 0;
  const unused = Array.isArray(result?.unused) ? result.unused : [];
  const combos = Array.isArray(result?.combos) ? result.combos : [];

  if (totalSelected !== 9 || !unused.length || combos.length >= 3) return issues;

  const slots = [];
  const ids = [];

  unused.forEach(entry => {
    const slotIdx = Number.parseInt(entry?.slotIdx, 10);
    if (Number.isInteger(slotIdx)) slots.push({ side: meta.key, slot: slotIdx });
    if (entry?.id) ids.push(String(entry.id));
  });

  issues.push({
    message: `${meta.label}: One or more effects could not be placed into a valid relic because of compatibility conflicts. Try removing or replacing one of the conflicting effects.`,
    slots,
    ids,
    code: "unplaced"
  });

  return issues;
}

function chaliceRollIssuesForSide(meta, options = {}) {
  const respectAutoSortGuard = options.respectAutoSortGuard !== false;
  // Only evaluate roll-order issues when the user has auto-sort disabled; otherwise roll moves are implied.
  if (respectAutoSortGuard && isAutoSortEnabled()) return { issues: [] };

  // Use the same combo selection used for grouping so roll-order checks stay scoped to actual groups.
  // Allow missing curses here because roll order is independent of curse selection.
  const result = generateCombosForSide(meta, { allowMissingCurse: true });
  const issues = [];

  for (const combo of result.combos) {
    if (!combo || !Array.isArray(combo.indices) || combo.indices.length !== 3) continue;
    const slotRows = Array.isArray(combo.slotRows) && combo.slotRows.length === 3
      ? combo.slotRows
      : combo.indices.map(idx => chaliceRow(chaliceSelections[meta.key][idx]));
    // Only evaluate grouped relics (three concrete effect rows).
    if (!slotRows.every(Boolean)) continue;
    const roll = computeRollOrderIssue(slotRows[0], slotRows[1], slotRows[2]);
    if (roll?.hasIssue) {
      issues.push({ meta, combo, roll });
    }
  }

  return { issues };
}

function applyChaliceRollOrder(meta, issue) {
  if (!issue || !issue.roll || !issue.combo) return false;
  const slots = [...issue.combo.indices].sort((a, b) => a - b);
  const effects = chaliceSelections[meta.key];
  const cats = chaliceCats[meta.key];
  const curses = chaliceCurses[meta.key];

  let changed = false;
  const entries = slots.map(idx => ({
    idx,
    effect: effects[idx] || "",
    cat: cats[idx] || "",
    curse: curses[idx] || ""
  }));

  const used = new Set();
  const sortedRows = issue.roll.sorted || [];

  for (let i = 0; i < slots.length; i++) {
    const row = sortedRows[i];
    const targetSlot = slots[i];
    if (!row) continue;

    const entry = entries.find(e => !used.has(e.idx) && e.effect === String(row.EffectID));
    if (entry) used.add(entry.idx);

    const nextEffect = String(row.EffectID);
    if (effects[targetSlot] !== nextEffect) {
      effects[targetSlot] = nextEffect;
      changed = true;
    }

    const nextCat = entry ? entry.cat : "";
    if (cats[targetSlot] !== nextCat) {
      cats[targetSlot] = nextCat;
      changed = true;
    }

    const nextCurse = entry ? entry.curse : "";
    if (curses[targetSlot] !== nextCurse) {
      curses[targetSlot] = nextCurse;
      changed = true;
    }
  }

  return changed;
}

function buildChaliceRollMoveMap(rollIssues) {
  const map = new Map();
  if (!Array.isArray(rollIssues)) return map;

  for (const issue of rollIssues) {
    const indices = issue?.combo?.indices || [];
    const deltas = issue?.roll?.moveDeltaBySlot || [];
    const sideKey = issue?.meta?.key || "standard";

    for (let i = 0; i < indices.length; i++) {
      const slotIdx = indices[i];
      if (!Number.isInteger(slotIdx)) continue;
      const delta = Number(deltas[i] || 0);
      const key = `${sideKey}:${slotIdx}`;
      if (map.has(key)) continue; // first issue wins; roll order should be unique per trio
      map.set(key, { delta, showOk: delta === 0 });
    }
  }

  return map;
}

function maybeAutoSortChalice(force = false) {
  function handleSide(meta) {
    const first = chaliceRollIssuesForSide(meta, { respectAutoSortGuard: false });
    const shouldSort = force || isAutoSortEnabled();
    let changed = false;

    if (shouldSort) {
      for (const issue of first.issues) {
        changed = applyChaliceRollOrder(meta, issue) || changed;
      }
    }

    if (changed) {
      const refreshed = chaliceRollIssuesForSide(meta);
      return { issues: refreshed.issues, changed };
    }

    return { issues: first.issues, changed: false };
  }

  const std = handleSide(sideInfo("standard"));
  const dep = handleSide(sideInfo("depth"));

  lastChaliceRollIssues = {
    standard: std.issues,
    depth: dep.issues
  };

  return std.changed || dep.changed;
}

function computeChaliceBlockedCompat(slotIdx) {
  const blocked = new Set();
  const effects = chaliceSelections.depth;
  const cursesSel = chaliceCurses.depth;

  for (let i = 0; i < effects.length; i++) {
    if (i === slotIdx) continue;
    const eff = chaliceRow(effects[i]);
    const cur = chaliceRow(cursesSel[i]);
    const effCid = compatId(eff);
    if (effCid) blocked.add(effCid);
    const curCid = compatId(cur);
    if (curCid) blocked.add(curCid);
  }

  // also block the effect in the slot itself
  const selfEff = chaliceRow(effects[slotIdx]);
  const selfCid = compatId(selfEff);
  if (selfCid) blocked.add(selfCid);

  return blocked;
}

function isRowAllowedForSide(row, sideMeta) {
  const t = relicTypeForRow(row);
  if (sideMeta.relicType === "Standard") return t === "Standard" || t === "Both";
  if (sideMeta.relicType === "Depth Of Night") return t === "Depth Of Night" || t === "Both";
  return true;
}

function chaliceEffectCount(sideKey, effectId) {
  if (!effectId) return 0;
  const key = sideKey === "depth" ? "depth" : "standard";
  return chaliceSelections[key].reduce((count, cur) => {
    return count + (cur === String(effectId) ? 1 : 0);
  }, 0);
}

function canUseEffectOnSide(sideKey, slotIdx, effectId) {
  if (!effectId) return true;
  const key = sideKey === "depth" ? "depth" : "standard";
  const current = chaliceSelections[key]?.[slotIdx] || "";
  const totalCount = chaliceEffectCount(key, effectId);
  const effectiveCount = current === String(effectId) ? totalCount - 1 : totalCount;
  return effectiveCount < 3;
}

function firstAvailableChaliceSlot(sideKey) {
  const meta = sideInfo(sideKey);
  const slots = Array.isArray(chaliceSelections[meta.key]) ? chaliceSelections[meta.key] : [];
  const emptyIdx = slots.findIndex(v => !v);
  return emptyIdx === -1 ? 0 : emptyIdx;
}

function chaliceEligiblePool(sideKey) {
  const meta = sideInfo(sideKey);
  if (!rows.length) return [];
  return filterByClass(baseFilteredByRelicType(rows, meta.relicType));
}

function categoryChip(label) {
  const theme = categoryColorFor(label || "Uncategorized");
  const bg = gradientFromTheme(theme);
  const base = theme?.base || "#2b2f38";
  const border = theme?.border || "rgba(255, 255, 255, 0.14)";
  const text = textColorFor(base);
  return `<span class="effect-chip effect-chip--category" style="background:${bg}; border-color:${border}; color:${text};">${escapeHtml(label || "Uncategorized")}</span>`;
}

function chaliceEffectChip(label, modifiers = [], style = "") {
  const classes = ["effect-chip", ...modifiers].filter(Boolean).join(" ");
  const styleAttr = style ? ` style="${style}"` : "";
  return `<span class="${classes}"${styleAttr}>${escapeHtml(label)}</span>`;
}

function chaliceAttrPills(row) {
  if (!row) return [];
  const pills = [];

  const characters = parseCharactersList(row?.Characters);
  if (characters.isAll || !characters.list.length) {
    pills.push(chaliceEffectChip("All Characters", ["effect-chip--character", "effect-chip--character-all"]));
  } else {
    characters.list.forEach(name => {
      const token = characterColors(name);
      pills.push(chaliceEffectChip(name, ["effect-chip--character", `effect-chip--character-${token.slug}`]));
    });
  }

  const categoryRaw = effectCategoryForRow(row);
  const categoryLabel = categoryRaw || "Uncategorized";
  pills.push(categoryChip(categoryLabel));

  const selfStack = selfStackingMeta(row?.SelfStacking);
  const selfMod = selfStack.modifier === "yes"
    ? "effect-chip--self-stack-yes"
    : selfStack.modifier === "no"
      ? "effect-chip--self-stack-no"
      : "effect-chip--self-stack-unknown";
  pills.push(chaliceEffectChip(`Self-Stacking: ${selfStack.label}`, ["effect-chip--self-stack", selfMod]));

  const rollOrderRaw = (row?.RollOrder ?? "").toString().trim();
  const rollOrderLabel = rollOrderRaw || "—";
  pills.push(chaliceEffectChip(`Roll Order: ${rollOrderLabel}`, ["effect-chip--meta", "effect-chip--rollorder"]));

  return pills;
}

function renderChaliceSlot(sideKey, idx) {
  const meta = sideInfo(sideKey);
  const effectId = chaliceSelections[meta.key][idx];
  const row = chaliceRow(effectId);
  const curseId = chaliceCurses[meta.key][idx];
  const curseRow = curseId ? chaliceRow(curseId) : null;
  const label = `Slot ${meta.slotPrefix}${idx + 1}`;
  const isEmpty = !row;

  if (isEmpty) {
    return `
      <li>
        <div class="chalice-slot chalice-slot--empty" data-side="${meta.key}" data-slot="${idx}">
          <div class="chalice-slot__grid chalice-slot__grid--single">
            <div class="chalice-slot__cell chalice-slot__cell--effect chalice-slot__cell--empty">
              <button
                type="button"
                class="chalice-slot__btn chalice-slot__btn--empty"
                data-ch-slot="${meta.key}:${idx}"
                aria-label="${label}: Select Effect"
              >Select Effect</button>
            </div>
          </div>
        </div>
      </li>
    `;
  }

  const name = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  // Chalice builder: no status icons; keep layout simple
  const effectIcon = "";
  const requiresCurse = meta.key === "depth" && String(row?.CurseRequired ?? "0") === "1";
  const curseName = curseRow ? (curseRow.EffectDescription ?? `(Curse ${curseRow.EffectID})`) : "";
  const curseMissing = requiresCurse && !curseRow;
  const hasCurse = requiresCurse && !!curseRow;
  const attrPills = chaliceAttrPills(row);
  const categoryLabel = effectCategoryForRow(row) || "Uncategorized";
  const categoryTheme = categoryColorFor(categoryLabel);
  const handleColor = categoryTheme?.base || "#ffffff";
  const hasAttrPills = attrPills.length > 0;
  const showAttrDivider = hasAttrPills;
  const totalCount = chaliceEffectCount(meta.key, effectId);
  const selfStack = selfStackingMeta(row?.SelfStacking);
  const dupDisabledByCount = totalCount >= 3;
  const dupDisabledBySelfStack = selfStack.modifier === "no";
  const dupDisabled = dupDisabledByCount || dupDisabledBySelfStack;
  const dupTitle = dupDisabledByCount
    ? `Effect already used three times on the ${meta.label} side`
    : dupDisabledBySelfStack
      ? "This effect does not self-stack"
      : "Copy effect to another slot";

  return `
    <li>
      <div class="chalice-slot" data-side="${meta.key}" data-slot="${idx}">
        <div class="chalice-slot__grid chalice-slot__grid--effect">
          <div
            class="chalice-slot__handle"
            style="--chalice-side-color: ${handleColor}"
            data-ch-slot-handle="${meta.key}:${idx}"
            draggable="true"
            aria-hidden="true"
          ></div>

          <div class="chalice-slot__header">
            ${effectIcon}
            <div class="chalice-slot__text">
              <div class="chalice-slot__title">${escapeHtml(name)}</div>
            </div>
            <div class="control-cluster chalice-slot__controls">
              <button
                type="button"
                class="icon-btn swap-btn"
                data-ch-slot="${meta.key}:${idx}"
                aria-label="Change ${label}"
                title="Change Effect"
              >⇄</button>
              <button type="button" class="icon-btn clear-btn" data-ch-clear="${meta.key}:${idx}" aria-label="Clear ${label}" title="Clear Effect">×</button>
              <button
                type="button"
                class="icon-btn copy-id-btn"
                aria-label="Copy EffectID ${row.EffectID}"
                title="EffectID ${row.EffectID}"
                data-copy-effect-id="${row.EffectID}"
              >
                <span class="effect-copy-icon" aria-hidden="true"></span>
              </button>
              <button
                type="button"
                class="icon-btn dup-btn${dupDisabled ? " is-disabled" : ""}"
                data-ch-duplicate="${meta.key}:${idx}"
                aria-label="Copy ${label} to another slot"
                title="${dupTitle}"
                ${dupDisabled ? "disabled" : ""}
              >+</button>
            </div>
          </div>

          <div class="chalice-slot__icons"></div>

          <div class="chalice-slot__issue-col">
            <div class="chalice-slot__issue-badges" data-ch-issue-badges></div>
          </div>

          ${hasAttrPills ? `
            <div class="chalice-slot__divider" aria-hidden="true"></div>
            <div class="chalice-slot__pills">${attrPills.join("")}</div>
          ` : ""}

          ${requiresCurse ? `
            <div class="chalice-slot__cell chalice-slot__curse-row ${curseMissing ? "is-missing" : ""}">
              ${hasCurse ? `<span class="chalice-slot__curse-name">${escapeHtml(curseName)}</span>` : `<span class="curse-required">Curse Required</span>`}
              ${hasCurse
                ? `<div class="control-cluster chalice-slot__controls chalice-slot__controls--curse">
                    <button type="button" class="icon-btn swap-btn" data-ch-curse="${meta.key}:${idx}" aria-label="Change Curse" title="Change Curse">⇄</button>
                    <button type="button" class="icon-btn clear-btn" data-ch-curse-clear="${meta.key}:${idx}" aria-label="Clear Curse" title="Clear Curse">×</button>
                    <button
                      type="button"
                      class="icon-btn copy-id-btn"
                      aria-label="Copy CurseID ${curseRow?.EffectID ?? ""}"
                      title="CurseID ${curseRow?.EffectID ?? ""}"
                      data-copy-curse-id="${curseRow?.EffectID ?? ""}"
                    >
                      <span class="effect-copy-icon" aria-hidden="true"></span>
                    </button>
                  </div>`
                : `<button type="button" class="curse-btn" data-ch-curse="${meta.key}:${idx}">Select a Curse</button>`}
            </div>
          ` : ""}

        </div>
      </div>
    </li>
  `;
}

function renderChaliceLists() {
  if (dom.chaliceStandardList) {
    dom.chaliceStandardList.innerHTML = chaliceSelections.standard.map((_, idx) => renderChaliceSlot("standard", idx)).join("");
  }
  if (dom.chaliceDepthList) {
    dom.chaliceDepthList.innerHTML = chaliceSelections.depth.map((_, idx) => renderChaliceSlot("depth", idx)).join("");
  }
  installChaliceSlotButtons();
  installRowCopyButtons();
}

function installChaliceSlotButtons() {
  const pickers = document.querySelectorAll("[data-ch-slot]");
  pickers.forEach(btn => {
    btn.addEventListener("click", evt => {
      const payload = btn.getAttribute("data-ch-slot") || "";
      const [sideRaw, idxRaw] = payload.split(":");
      const idx = Number.parseInt(idxRaw, 10);
      if (!Number.isInteger(idx) || idx < 0) return;
      openChaliceEffectMenu(sideRaw, idx, btn, evt);
    });
  });

  const clears = document.querySelectorAll("[data-ch-clear]");
  clears.forEach(btn => {
    btn.addEventListener("click", () => {
      const payload = btn.getAttribute("data-ch-clear") || "";
      const [sideRaw, idxRaw] = payload.split(":");
      const idx = Number.parseInt(idxRaw, 10);
      const side = sideRaw === "depth" ? "depth" : "standard";
      if (!Number.isInteger(idx) || idx < 0) return;
      chaliceSelections[side][idx] = "";
      chaliceCats[side][idx] = "";
      chaliceCurses[side][idx] = "";
      renderChaliceUI();
    });
  });

  const duplicates = document.querySelectorAll("[data-ch-duplicate]");
  duplicates.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.hasAttribute("disabled") || btn.classList.contains("is-disabled")) return;
      const payload = btn.getAttribute("data-ch-duplicate") || "";
      const [sideRaw, idxRaw] = payload.split(":");
      const idx = Number.parseInt(idxRaw, 10);
      const side = sideRaw === "depth" ? "depth" : "standard";
      if (!Number.isInteger(idx) || idx < 0) return;
      duplicateChaliceEffect(side, idx);
    });
  });

  const cursePickers = document.querySelectorAll("[data-ch-curse]");
  cursePickers.forEach(btn => {
    btn.addEventListener("click", () => {
      const payload = btn.getAttribute("data-ch-curse") || "";
      const [sideRaw, idxRaw] = payload.split(":");
      const idx = Number.parseInt(idxRaw, 10);
      const side = sideRaw === "depth" ? "depth" : "standard";
      if (!Number.isInteger(idx) || idx < 0) return;
      openChaliceCurseMenu(side, idx, btn);
    });
  });

  const curseClears = document.querySelectorAll("[data-ch-curse-clear]");
  curseClears.forEach(btn => {
    btn.addEventListener("click", () => {
      const payload = btn.getAttribute("data-ch-curse-clear") || "";
      const [sideRaw, idxRaw] = payload.split(":");
      const idx = Number.parseInt(idxRaw, 10);
      const side = sideRaw === "depth" ? "depth" : "standard";
      if (!Number.isInteger(idx) || idx < 0) return;
      chaliceCurses[side][idx] = "";
      renderChaliceUI();
    });
  });
}

function duplicateChaliceEffect(sideKey, fromIdx) {
  const meta = sideInfo(sideKey);
  const effects = chaliceSelections[meta.key];
  if (!Array.isArray(effects) || fromIdx < 0 || fromIdx >= effects.length) return;

  const effectId = effects[fromIdx];
  if (!effectId) {
    setChaliceStatus("Select an effect first to copy.");
    return;
  }

  const totalCount = chaliceEffectCount(meta.key, effectId);
  if (totalCount >= 3) {
    setChaliceStatus(`You can only use an effect up to three times on the ${meta.label} side.`);
    return;
  }

  const targetIdx = effects.findIndex((val, i) => !val && i !== fromIdx);
  if (targetIdx === -1) {
    setChaliceStatus(`No empty slots available on the ${meta.label} side.`);
    return;
  }

  effects[targetIdx] = effectId;
  chaliceCats[meta.key][targetIdx] = chaliceCats[meta.key][fromIdx] || "";
  chaliceCurses[meta.key][targetIdx] = "";
  setChaliceStatus("");
  renderChaliceUI();
}

function openChaliceEffectMenu(sideKey, slotIdx, anchorBtn) {
  closeEffectMenu();
  const meta = sideInfo(sideKey);
  const pool = chaliceEligiblePool(meta.key);
  const categories = categoriesFor(pool);
  const currentId = chaliceSelections[meta.key][slotIdx] || "";
  const selectedCat = chaliceCats[meta.key][slotIdx] || "";

  openEffectMenu({
    slotIdx,
    anchorBtn,
    eligible: pool,
    categories,
    currentId,
    selectedCategory: selectedCat,
    onPick: (id, activeCategory) => {
      if (!canUseEffectOnSide(meta.key, slotIdx, id)) {
        setChaliceStatus(`You can only use an effect up to three times on the ${meta.label} side.`);
        return;
      }
      chaliceSelections[meta.key][slotIdx] = id;
      chaliceCats[meta.key][slotIdx] = activeCategory || "";
      chaliceCurses[meta.key][slotIdx] = ""; // reset curse when effect changes
      setChaliceStatus("");
      maybeAutoSetClassFromRow(chaliceRow(id));
      renderChaliceUI();
    }
  });
}

function openChaliceCurseMenu(sideKey, slotIdx, anchorBtn) {
  if (sideKey !== "depth") return;
  const effectRow = chaliceRow(chaliceSelections.depth[slotIdx]);
  if (!effectRow) return;
  const requiresCurse = String(effectRow?.CurseRequired ?? "0") === "1";
  if (!requiresCurse) return;

  const blockedCompat = computeChaliceBlockedCompat(slotIdx);
  const eligibleCurses = filterByClass(baseFilteredByRelicType(curses, "Depth Of Night"))
    .filter(r => {
      const cid = compatId(r);
      if (!cid) return true;
      return !blockedCompat.has(String(cid));
    })
    .sort((x, y) => getRollValue(x) - getRollValue(y));

  const currentId = chaliceCurses.depth[slotIdx] || "";
  const categories = categoriesFor(eligibleCurses);

  openCurseMenu({
    slotIdx,
    anchorBtn,
    eligible: eligibleCurses,
    categories,
    currentId,
    selectedCategory: "",
    onPick: (id, activeCategory) => {
      chaliceCurses.depth[slotIdx] = id;
      renderChaliceUI();
    }
  });
}

function tally(ids) {
  const map = new Map();
  ids.forEach(id => {
    if (!id) return;
    const key = String(id);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function evaluateComboForSide(ids, meta) {
  const rowsCombo = ids.map(id => chaliceRow(id)).filter(Boolean);
  if (rowsCombo.length !== ids.length) return null;

  // Enforce relic type and duplicate EffectID rules
  const seenEffect = new Set();
  const seenCompat = new Set();
  for (const row of rowsCombo) {
    if (!isRowAllowedForSide(row, meta)) return null;
    const eid = String(row.EffectID);
    if (seenEffect.has(eid)) return null;
    seenEffect.add(eid);

    const cid = compatId(row);
    if (cid) {
      if (seenCompat.has(cid)) return null;
      seenCompat.add(cid);
    }
  }

  const needsCurse = rowsCombo.some(r => String(r?.CurseRequired ?? "0") === "1");
  const sorted = [...rowsCombo].sort((a, b) => getRollValue(a) - getRollValue(b));

  return {
    ids: ids.map(String),
    rows: sorted,
    needsCurse,
    valid: !needsCurse
  };
}

function hasCountsForCombo(combo, counts) {
  for (const id of combo.ids) {
    if ((counts.get(id) || 0) <= 0) return false;
  }
  return true;
}

function decrementCounts(counts, combo) {
  const next = new Map(counts);
  combo.ids.forEach(id => {
    next.set(id, (next.get(id) || 0) - 1);
  });
  return next;
}

function selectBestCombosSlots(combos) {
  let best = [];

  function dfs(startIdx, usedSlots, slate) {
    let advanced = false;
    for (let i = startIdx; i < combos.length; i++) {
      const combo = combos[i];
      if (combo.indices.some(idx => usedSlots.has(idx))) continue;
      advanced = true;
      const nextUsed = new Set(usedSlots);
      combo.indices.forEach(idx => nextUsed.add(idx));
      dfs(i + 1, nextUsed, [...slate, combo]);
    }
    if (!advanced && slate.length > best.length) {
      best = slate;
    }
  }

  dfs(0, new Set(), []);
  return best;
}

function selectBestCombos(validCombos, counts) {
  let best = [];

  function dfs(startIdx, countsLeft, slate) {
    let advanced = false;
    for (let i = startIdx; i < validCombos.length; i++) {
      const combo = validCombos[i];
      if (!hasCountsForCombo(combo, countsLeft)) continue;
      advanced = true;
      const nextCounts = decrementCounts(countsLeft, combo);
      dfs(i, nextCounts, [...slate, combo]);
    }
    if (!advanced && slate.length > best.length) {
      best = slate;
    }
  }

  dfs(0, counts, []);
  return best;
}

function computeLeftoverCounts(total, used) {
  const out = new Map(total);
  for (const [id, usedCount] of used.entries()) {
    out.set(id, Math.max(0, (out.get(id) || 0) - usedCount));
  }
  return out;
}

function countMapTotal(map) {
  let total = 0;
  for (const [, v] of map.entries()) total += Number(v || 0);
  return total;
}

function generateCombosForSide(meta, options = {}) {
  const allowMissingCurse = Boolean(options.allowMissingCurse);
  const slots = chaliceSelections[meta.key];
  const curseSlots = chaliceCurses[meta.key];
  const filledIdx = slots.map((id, idx) => ({ id, idx })).filter(x => x.id);

  const combos = [];
  const blocked = [];

  const reasonForSlot = (slotIdx) => {
    const effectRow = chaliceRow(slots[slotIdx]);
    const curseId = curseSlots[slotIdx];
    const curseRow = curseId ? chaliceRow(curseId) : null;

    if (!rowMatchesClass(effectRow)) return "Does not match the selected class.";
    if (!isRowAllowedForSide(effectRow, meta)) return "Not allowed on this relic type.";

    const needsCurse = String(effectRow?.CurseRequired ?? "0") === "1";
    if (needsCurse && !curseRow) return "Requires a curse but none is selected.";

    const cid = compatId(effectRow);
    if (cid) {
      const countCid = slots.reduce((acc, val) => {
        const r = val ? chaliceRow(val) : null;
        return acc + (compatId(r) === cid ? 1 : 0);
      }, 0);
      if (countCid > 1) return "Conflicts with another selected effect (compatibility ID clash).";
    }

    return "Cannot form a valid trio with the other selected effects on this side.";
  };

  for (let a = 0; a < filledIdx.length; a++) {
    for (let b = a + 1; b < filledIdx.length; b++) {
      for (let c = b + 1; c < filledIdx.length; c++) {
        const triple = [filledIdx[a], filledIdx[b], filledIdx[c]];
        const ids = triple.map(t => t.id);
        const rowsCombo = ids.map(id => chaliceRow(id));
        if (rowsCombo.some(r => !r)) continue;

        const needsCurse = rowsCombo.some(r => String(r?.CurseRequired ?? "0") === "1");

        // type/class check
        if (!rowsCombo.every(r => isRowAllowedForSide(r, meta) && rowMatchesClass(r))) continue;

        // Effect uniqueness and compatibility across effects + curses
        const seenEffect = new Set();
        const usedCompat = new Set();

        let invalid = false;
        for (const row of rowsCombo) {
          const eid = String(row.EffectID);
          if (seenEffect.has(eid)) { invalid = true; break; }
          seenEffect.add(eid);
          const cid = compatId(row);
          if (cid) {
            if (usedCompat.has(cid)) { invalid = true; break; }
            usedCompat.add(cid);
          }
        }
        if (invalid) continue;

        const cursesForCombo = [];
        const missingCurseSlots = [];
        if (meta.key === "depth") {
          for (const slot of triple) {
            const effectRow = chaliceRow(slot.id);
            const needsCurse = String(effectRow?.CurseRequired ?? "0") === "1";
            const curseId = curseSlots[slot.idx];
            const curseRow = curseId ? chaliceRow(curseId) : null;
            if (needsCurse && !curseRow) {
              if (!allowMissingCurse) {
                invalid = true;
                break;
              }
              missingCurseSlots.push(slot.idx);
              continue;
            }
            if (curseRow) {
              if (!rowMatchesClass(curseRow)) { invalid = true; break; }
              const ccid = compatId(curseRow);
              if (ccid && usedCompat.has(ccid)) { invalid = true; break; }
              usedCompat.add(ccid);
              cursesForCombo.push(curseRow);
            }
          }
        }

        if (invalid) continue;

        const sorted = [...rowsCombo].sort((x, y) => getRollValue(x) - getRollValue(y));
        combos.push({
          ids,
          indices: triple.map(t => t.idx),
          rows: sorted,
          curses: cursesForCombo,
          needsCurse,
          missingCurse: missingCurseSlots.length > 0,
          slotRows: triple.map(t => chaliceRow(t.id))
        });
      }
    }
  }

  const best = selectBestCombosSlots(combos);
  const usedSlots = new Set(best.flatMap(c => c.indices));
  const leftoverCount = slots.filter(Boolean).length - usedSlots.size;

  const unused = [];
  for (const { id, idx } of filledIdx) {
    if (usedSlots.has(idx)) continue;
    const row = chaliceRow(id);
    const name = row?.EffectDescription ?? `(Effect ${id})`;
    const reason = reasonForSlot(idx);
    unused.push({ id, name, reason, slotIdx: idx });
  }

  return {
    combos: best,
    blocked,
    unused,
    leftoverSlots: leftoverCount,
    selectedCount: filledIdx.length,
    uniqueCount: filledIdx.length
  };
}

function computeStatOverviewTotals(effectIds) {
  const totals = new Map();
  const ids = Array.isArray(effectIds) ? effectIds : [];

  for (const effectId of ids) {
    const rows = statRowsForEffect(effectId);
    if (!rows.length) continue;
    for (const row of rows) {
      const requiresCondition = String(row?.ConditionRequired ?? "0") === "1";
      if (requiresCondition && !isConditionalEffectEnabled(effectId)) continue;

      const group = row?.MetricGroup || "Other";
      const type = row?.MetricType || "Unknown";
      const unitRaw = String(row?.Unit || "pct").trim();
      const unit = unitRaw === "%" ? "pct" : (unitRaw === "#" ? "flat" : unitRaw.toLowerCase());
      const key = `${group}||${type}`;
      const valueNum = Number.parseFloat(row?.Value ?? "0");
      const stacks = String(row?.Stackable ?? "0") === "1" ? stackCountForEffect(effectId) : 1;
      const value = Number.isFinite(valueNum) ? valueNum * stacks : 0;

      if (!totals.has(key)) {
        totals.set(key, {
          group,
          type,
          unit,
          multiplier: 1,
          flat: 0,
          count: 0
        });
      }

      const entry = totals.get(key);
      entry.count += 1;
      if (unit === "pct") {
        const factor = 1 + value / 100;
        entry.multiplier *= factor;
      } else {
        entry.flat += value;
      }
    }
  }

  totals.forEach(entry => {
    entry.percentChange = entry.unit === "pct" ? (entry.multiplier - 1) * 100 : 0;
  });

  return totals;
}

function selectedChaliceEffectIds() {
  return [...chaliceSelections.standard, ...chaliceSelections.depth].filter(Boolean);
}

function statValueText(entry) {
  if (entry.unit === "pct") {
    if (isZeroish(entry.percentChange)) return "-";
    return formatSigned(entry.percentChange, "%");
  }
  if (isZeroish(entry.flat)) return "-";
  return formatSignedInt(entry.flat);
}

function updateVitalsFromTotals(totals) {
  const hp = totals.get("MaxStat||HP");
  const fp = totals.get("MaxStat||FP");
  const st = totals.get("MaxStat||ST") || totals.get("MaxStat||Stamina");

  if (dom.statOverviewHP) dom.statOverviewHP.textContent = hp ? statValueText(hp) : "-";
  if (dom.statOverviewFP) dom.statOverviewFP.textContent = fp ? statValueText(fp) : "-";
  if (dom.statOverviewST) dom.statOverviewST.textContent = st ? statValueText(st) : "-";
}

function statMultiplierText(entry) {
  if (entry.unit !== "pct") return "";
  return `${twoDecimal(entry.multiplier)}x`;
}

function findStatTotal(item, totals, usedKeys) {
  const candidates = [item.type, ...(item.altTypes || [])];
  for (const type of candidates) {
    const key = `${item.group}||${type}`;
    if (totals.has(key)) {
      usedKeys.add(key);
      return totals.get(key);
    }
  }
  return {
    group: item.group,
    type: item.type,
    unit: item.unit || "pct",
    multiplier: 1,
    flat: 0,
    percentChange: 0
  };
}

function statBoxHtml(item, totals, usedKeys) {
  const total = findStatTotal(item, totals, usedKeys);
  const isPositive = total.unit === "pct" ? total.percentChange > 0 : total.flat > 0;
  const isNegative = total.unit === "pct" ? total.percentChange < 0 : total.flat < 0;
  const trend = isPositive ? "is-positive" : isNegative ? "is-negative" : "";
  const valueText = statValueText(total);
  const icon = statIconHtml(item.group, item.type);
  const title = `${item.label}: ${valueText}`;

  return `
    <article class="stat-box ${trend}" aria-label="${escapeHtml(title)}">
      ${icon}
      <div class="stat-box__value">${valueText}</div>
    </article>
  `;
}

function renderStatGrid(target, items, totals, usedKeys) {
  if (!target) return;
  const count = Array.isArray(items) ? items.length : 0;
  target.style.setProperty("--stat-count", count || 1);
  target.innerHTML = items.map(item => statBoxHtml(item, totals, usedKeys)).join("");
}

function renderOtherEffects(totals, usedKeys) {
  if (!dom.statOverviewOther || !dom.statOverviewOtherSection) return;
  const rows = [];
  totals.forEach((entry, key) => {
    if (usedKeys.has(key)) return;
    if (entry.group === "MaxStat") return;
    const text = `${entry.group}: ${entry.type}`;
    rows.push({ text, value: statValueText(entry), unit: entry.unit });
  });

  rows.sort((a, b) => a.text.localeCompare(b.text));
  dom.statOverviewOtherSection.hidden = rows.length === 0;
  dom.statOverviewOther.innerHTML = rows
    .map(r => `<li><span class="stat-list__name">${escapeHtml(r.text)}</span><span class="stat-list__value">${escapeHtml(r.value)}</span></li>`)
    .join("");
}

function formatConditionalSummary(rows) {
  const parts = [];
  for (const row of rows) {
    const unitRaw = String(row?.Unit || "pct").trim();
    const unit = unitRaw === "%" ? "pct" : (unitRaw === "#" ? "flat" : unitRaw.toLowerCase());
    const valNum = Number.parseFloat(row?.Value ?? "0");
    const val = Number.isFinite(valNum) ? valNum : 0;
    const text = unit === "pct" ? formatSigned(val, "%") : formatSignedInt(val);
    const label = row?.MetricType || "Stat";
    parts.push(`${label} ${text}`);
    if (parts.length >= 3) break;
  }
  if (rows.length > parts.length) parts.push("…");
  return parts.join(", ");
}

function renderConditionalExtras(target, list) {
  if (!target) return;
  if (!list.length) {
    target.innerHTML = '<div class="stat-overview__placeholder" aria-hidden="true">Additional Effects</div>';
    return;
  }

  target.innerHTML = `
    <ul class="stat-overview__extras-list">
      ${list.map(item => `
        <li class="stat-extra">
          <label class="stat-extra__label">
            <span class="stat-extra__name">${escapeHtml(item.name)}</span>
            <span class="stat-extra__toggle-wrap">
              <input
                type="checkbox"
                class="stat-extra__toggle"
                data-conditional-effect="${escapeHtml(item.id)}"
                ${item.enabled ? "checked" : ""}
              >
              <span class="stat-extra__fakebox" aria-hidden="true"></span>
            </span>
          </label>
          ${item.stackable ? `
            <div class="stat-extra__stacker" data-stack-effect="${escapeHtml(item.id)}">
              <button type="button" class="stat-extra__stack-btn" data-stack-dec aria-label="Decrease stacks">-</button>
              <span class="stat-extra__stack-count" title="Max ${item.maxStacks}" aria-label="Stacks">${item.stacks}</span>
              <button type="button" class="stat-extra__stack-btn" data-stack-inc aria-label="Increase stacks">+</button>
            </div>
          ` : ""}
        </li>
      `).join("")}
    </ul>
  `;

  const toggles = target.querySelectorAll("[data-conditional-effect]");
  toggles.forEach(toggle => {
    toggle.addEventListener("change", evt => {
      const id = evt.target.getAttribute("data-conditional-effect") || "";
      setConditionalEffectEnabled(id, evt.target.checked);
      renderChaliceStatOverview();
    });
  });

  const stackers = target.querySelectorAll("[data-stack-effect]");
  stackers.forEach(stacker => {
    const id = stacker.getAttribute("data-stack-effect") || "";
    const dec = stacker.querySelector("[data-stack-dec]");
    const inc = stacker.querySelector("[data-stack-inc]");
    const label = stacker.querySelector(".stat-extra__stack-count");
    const updateLabel = () => {
      const max = maxStacksForEffect(id);
      const val = stackCountForEffect(id);
      if (label) {
        label.textContent = `${val}`;
        label.setAttribute("title", `Max ${max}`);
        label.setAttribute("aria-label", `Stacks ${val} of max ${max}`);
      }
    };
    if (dec) dec.addEventListener("click", () => {
      const current = stackCountForEffect(id);
      setStackCountForEffect(id, current - 1);
      renderChaliceStatOverview();
      updateLabel();
    });
    if (inc) inc.addEventListener("click", () => {
      const current = stackCountForEffect(id);
      setStackCountForEffect(id, current + 1);
      renderChaliceStatOverview();
      updateLabel();
    });
    updateLabel();
  });
}

function renderConditionalEffectLists(effectIds) {
  const buckets = {
    attributes: [],
    attack: [],
    defense: [],
    utility: []
  };

  const sectionForGroup = (group) => {
    if (group === "Attributes") return "attributes";
    if (group === "Attack") return "attack";
    if (group === "Negation") return "defense";
    return "utility";
  };

  const ids = Array.isArray(effectIds) ? effectIds : [];
  const seen = new Set();

  for (const effectId of ids) {
    const key = String(effectId || "");
    if (seen.has(key)) continue;
    const rows = statRowsForEffect(effectId).filter(r => String(r?.ConditionRequired ?? "0") === "1");
    if (!rows.length) continue;
    seen.add(key);

    const effectMeta = byId.get(key);
    const stackable = rows.some(r => String(r?.Stackable ?? "0") === "1");
    const maxStacks = maxStacksForEffect(key);
    const stacks = stackable ? stackCountForEffect(key) : 1;

    const sectionKey = sectionForGroup(rows[0]?.MetricGroup || "");
    const entry = {
      id: key,
      name: effectMeta?.EffectDescription || rows[0]?.EffectName || `Effect ${key}`,
      summary: formatConditionalSummary(rows),
      enabled: isConditionalEffectEnabled(effectId),
      stackable,
      maxStacks,
      stacks
    };

    buckets[sectionKey].push(entry);
  }

  renderConditionalExtras(dom.statOverviewAttributesExtras, buckets.attributes);
  renderConditionalExtras(dom.statOverviewAttackExtras, buckets.attack);
  renderConditionalExtras(dom.statOverviewDefenseExtras, buckets.defense);
  renderConditionalExtras(dom.statOverviewUtilityExtras, buckets.utility);
}

function renderChaliceStatOverview() {
  // In State 3 we still show the stat overview; keep takeover note hidden.
  if (dom.statOverviewSection) dom.statOverviewSection.hidden = false;
  if (dom.chaliceResultsTakeoverNote) dom.chaliceResultsTakeoverNote.hidden = true;

  resetVitalsPlaceholders();

  const ids = selectedChaliceEffectIds();
  pruneConditionalEffectState(ids);
  renderConditionalEffectLists(ids);
  const totals = computeStatOverviewTotals(ids);
  const usedKeys = new Set();

  updateVitalsFromTotals(totals);

  renderStatGrid(dom.statOverviewAttributes, STAT_LAYOUT.attributes, totals, usedKeys);
  renderStatGrid(dom.statOverviewAttack, STAT_LAYOUT.attack, totals, usedKeys);
  renderStatGrid(dom.statOverviewDefense, STAT_LAYOUT.defense, totals, usedKeys);
  renderOtherEffects(totals, usedKeys);
}

function updateChaliceStatusFromResults(standard, depth) {
  if (dom.chaliceStatus) {
    const stdUnused = standard.unused?.length || 0;
    const depUnused = depth.unused?.length || 0;
    if (stdUnused || depUnused) {
      const parts = [];
      if (stdUnused) parts.push(`${stdUnused} unused on Standard side`);
      if (depUnused) parts.push(`${depUnused} unused on Depth side`);
      dom.chaliceStatus.textContent = parts.join(" | ");
    }
  }

  const blockedCount = (standard.blocked?.length || 0) + (depth.blocked?.length || 0);
  const statusParts = [];

  statusParts.push(`Standard: ${standard.combos.length} built${standard.leftoverSlots ? `, ${standard.leftoverSlots} slots unused` : ""}`);
  statusParts.push(`Depth: ${depth.combos.length} built${depth.leftoverSlots ? `, ${depth.leftoverSlots} slots unused` : ""}`);
  if (blockedCount) statusParts.push(`${blockedCount} combos need a curse and were skipped.`);
  const statusText = statusParts.join(" | ");
  setChaliceStatus(statusText);
}

function buildChaliceIssueAssignments(issues) {
  const perSlot = new Map();
  const rail = { errors: [], warnings: [] };
  const counters = { error: 0, warning: 0 };

  const process = (arr, severity) => {
    const list = Array.isArray(arr) ? arr : [];
    list.forEach(item => {
      const isObj = typeof item === "object" && item !== null;
      const message = isObj ? (item.message || String(item)) : String(item);
      const slots = isObj && Array.isArray(item.slots) ? item.slots : [];
      const code = isObj ? (item.code || "") : "";
      const badge = { num: ++counters[severity], message, severity, code };

      if (severity === "error") {
        rail.errors.push(badge);
      } else {
        rail.warnings.push(badge);
      }

      slots.forEach(slot => {
        const side = slot?.side || "standard";
        const idx = Number.parseInt(slot?.slot, 10);
        if (!Number.isInteger(idx) || idx < 0) return;
        const key = `${side}:${idx}`;
        if (!perSlot.has(key)) perSlot.set(key, { errors: [], warnings: [] });
        const bucket = severity === "error" ? perSlot.get(key).errors : perSlot.get(key).warnings;
        bucket.push(badge);
      });
    });
  };

  process(issues?.errors, "error");
  process(issues?.warnings, "warning");

  return { rail, perSlot };
}

function chaliceBadgeKey(_scope, severity, badge, _side = "", _slotIdx = null) {
  const numPart = Number.isFinite(badge?.num) ? `num:${badge.num}` : "";
  const codePart = badge?.code ? `code:${badge.code}` : "";
  const messagePart = badge?.message ? `msg:${badge.message}` : "";
  // Use a shared key per severity/num so linked badges pulse/clear together across rail + slots
  return ["badge", severity, numPart || codePart || messagePart].filter(Boolean).join(":");
}

function isChaliceBadgeSeen(key) {
  return key ? seenChaliceBadges.has(key) : false;
}

function markChaliceBadgeSeen(key, el) {
  if (!key) return;
  if (!seenChaliceBadges.has(key)) {
    seenChaliceBadges.add(key);
  }
  // Clear pulse on the triggering badge and any matching badges rendered elsewhere
  const targets = el ? [el, ...document.querySelectorAll(`[data-badge-key="${CSS.escape(key)}"]`)] : [];
  targets.forEach(node => node.classList.remove("chalice-badge--pulse"));
}

function installChaliceBadgeSeenHandlers(root) {
  if (!root) return;
  root.querySelectorAll("[data-badge-key]").forEach(el => {
    const key = el.getAttribute("data-badge-key") || "";
    if (!key) return;
    if (isChaliceBadgeSeen(key)) {
      el.classList.remove("chalice-badge--pulse");
      return;
    }
    const stopPulse = () => markChaliceBadgeSeen(key, el);
    el.addEventListener("pointerenter", stopPulse, { passive: true });
    el.addEventListener("focus", stopPulse, { passive: true });
  });
}

function renderChaliceAlertCounts(counts) {
  const warnRoot = document.getElementById("chaliceAlertCountsWarning");
  const errRoot = document.getElementById("chaliceAlertCountsError");

  const renderList = (root, severity, badges) => {
    if (!root) return;
    const active = Array.isArray(badges) && badges.length > 0;
    root.hidden = !active;
    root.setAttribute("aria-hidden", active ? "false" : "true");
    if (!active) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = `<ol class="chalice-alert-counts__list">${badges
      .map(b => {
        const badgeKey = chaliceBadgeKey("rail", severity, b);
        const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
        return `<li><span class="chalice-alert-counts__badge is-${severity}${pulseClass}" data-badge-key="${escapeHtml(badgeKey)}" data-tooltip="${escapeHtml(b.message)}" aria-label="${escapeHtml(b.message)}">${b.num}</span></li>`;
      })
      .join("")}</ol>`;
    installChaliceBadgeSeenHandlers(root);
  };

  renderList(warnRoot, "warning", counts?.warnings || []);
  renderList(errRoot, "error", counts?.errors || []);
}

function renderIllegalErrorBadge(assignments) {
  const badgeEl = dom.illegalErrorBadge;
  if (!badgeEl) return;

  const errors = assignments?.rail?.errors || [];
  const badge = errors.find(b => b?.code === "show-illegal-on");
  const shouldShow = !!badge && showIllegalActive;

  if (!shouldShow) {
    badgeEl.hidden = true;
    badgeEl.setAttribute("aria-hidden", "true");
    badgeEl.textContent = "";
    badgeEl.removeAttribute("data-tooltip");
    badgeEl.removeAttribute("aria-label");
    return;
  }

  const badgeKey = chaliceBadgeKey("rail", "error", badge);
  const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
  const message = badge.message || "Showing illegal combinations; type filtering is ignored.";
  badgeEl.textContent = String(badge.num);
  badgeEl.setAttribute("data-badge-key", badgeKey);
  badgeEl.hidden = false;
  badgeEl.setAttribute("aria-hidden", "false");
  badgeEl.setAttribute("data-tooltip", message);
  badgeEl.setAttribute("aria-label", message);
  badgeEl.classList.toggle("chalice-badge--pulse", !!pulseClass.trim());
  installChaliceBadgeSeenHandlers(badgeEl.parentElement || badgeEl);
}

function renderAutoSortWarningBadge(assignments) {
  const badgeEl = dom.autoSortWarningBadge;
  if (!badgeEl) return;

  const warnings = assignments?.rail?.warnings || [];
  const badge = warnings.find(b => b?.code === "auto-sort-off");
  const shouldShow = !!badge && !isAutoSortEnabled();

  if (!shouldShow) {
    badgeEl.hidden = true;
    badgeEl.setAttribute("aria-hidden", "true");
    badgeEl.textContent = "";
    badgeEl.removeAttribute("data-tooltip");
    badgeEl.removeAttribute("aria-label");
    return;
  }

  const badgeKey = chaliceBadgeKey("rail", "warning", badge);
  const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
  const message = badge.message || "Auto-Sort is off. Effects will not be auto-reordered until you turn it back on.";
  badgeEl.textContent = String(badge.num);
  badgeEl.setAttribute("data-badge-key", badgeKey);
  badgeEl.hidden = false;
  badgeEl.setAttribute("aria-hidden", "false");
  badgeEl.setAttribute("data-tooltip", message);
  badgeEl.setAttribute("aria-label", message);
  badgeEl.classList.toggle("chalice-badge--pulse", !!pulseClass.trim());
  installChaliceBadgeSeenHandlers(badgeEl.parentElement || badgeEl);
}

function validSlotSetFromCombos(standard, depth) {
  const valid = new Set();

  const collect = (result, sideKey) => {
    const combos = Array.isArray(result?.combos) ? result.combos : [];
    combos.forEach(combo => {
      const indices = Array.isArray(combo?.indices) ? combo.indices : [];
      indices.forEach(idx => {
        if (Number.isInteger(idx) && idx >= 0) valid.add(`${sideKey}:${idx}`);
      });
    });
  };

  collect(standard, "standard");
  collect(depth, "depth");
  return valid;
}

function renderValidCheck() {
  return `
    <span class="chalice-slot__valid-check" aria-label="Valid effect" title="Valid effect">
      <span class="check-box" aria-hidden="true"></span>
    </span>
  `;
}

function updateChaliceSlotIssues(assignments = lastChaliceIssueAssignments, validSlots = new Set(), rollMoves = new Map()) {
  const perSlot = assignments?.perSlot && typeof assignments.perSlot.get === "function"
    ? assignments.perSlot
    : new Map();

  document.querySelectorAll(".chalice-slot").forEach(slot => {
    slot.classList.remove("chalice-slot--warning", "chalice-slot--error", "chalice-slot--valid");
    const badgeTarget = slot.querySelector("[data-ch-issue-badges]");
    if (badgeTarget) badgeTarget.innerHTML = "";

    const side = slot.getAttribute("data-side") || "standard";
    const idx = Number.parseInt(slot.getAttribute("data-slot"), 10);
    const key = Number.isInteger(idx) ? `${side}:${idx}` : null;
    const entry = key && perSlot.has(key) ? (perSlot.get(key) || { errors: [], warnings: [] }) : { errors: [], warnings: [] };
    const rollMove = key && rollMoves instanceof Map ? rollMoves.get(key) : null;
    const hasRollIndicator = !!rollMove && !isAutoSortEnabled();
    const hasErrors = Array.isArray(entry.errors) && entry.errors.length > 0;
    const hasWarnings = Array.isArray(entry.warnings) && entry.warnings.length > 0;
    const slotHasEffect = !slot.classList.contains("chalice-slot--empty");
    const isValid = slotHasEffect && !hasErrors && !hasWarnings && key && validSlots instanceof Set && validSlots.has(key);

    if (hasErrors) slot.classList.add("chalice-slot--error");
    else if (hasWarnings) slot.classList.add("chalice-slot--warning");
    else if (isValid) slot.classList.add("chalice-slot--valid");

    if (!badgeTarget) return;
    const badges = [];
    const tooltipParts = [];
    if (hasErrors) {
      entry.errors.forEach(b => {
        if (hasRollIndicator && b?.code === "roll-order") return; // replace roll-order badge with arrows
        const badgeKey = chaliceBadgeKey("slot", "error", b, side, idx);
        const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
        badges.push(`<span class="chalice-slot__issue-badge is-error${pulseClass}" data-badge-key="${escapeHtml(badgeKey)}" data-tooltip="${escapeHtml(b.message)}" aria-label="${escapeHtml(b.message)}">${b.num}</span>`);
        tooltipParts.push(b.message || "");
      });
    }
    if (hasWarnings) {
      entry.warnings.forEach(b => {
        if (hasRollIndicator && b?.code === "roll-order") return;
        const badgeKey = chaliceBadgeKey("slot", "warning", b, side, idx);
        const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
        badges.push(`<span class="chalice-slot__issue-badge is-warning${pulseClass}" data-badge-key="${escapeHtml(badgeKey)}" data-tooltip="${escapeHtml(b.message)}" aria-label="${escapeHtml(b.message)}">${b.num}</span>`);
        tooltipParts.push(b.message || "");
      });
    }

    if (hasRollIndicator) {
      badges.push(moveIndicatorHtml(rollMove.delta, rollMove.showOk));
    }

    if (!badges.length && isValid) badges.push(renderValidCheck());
    badgeTarget.innerHTML = badges.join("");
  installChaliceBadgeSeenHandlers(badgeTarget);

    // Mirror the first tooltip onto the issue column so hovering the icon column also reveals the message,
    // but don't attach it when roll-order arrows are present; those should not trigger the tooltip.
    const tooltipText = tooltipParts.join(" | ").trim();
    if (tooltipText && !hasRollIndicator) {
      badgeTarget.setAttribute("data-tooltip", tooltipText);
      badgeTarget.setAttribute("aria-label", tooltipText);
    } else {
      badgeTarget.removeAttribute("data-tooltip");
      badgeTarget.removeAttribute("aria-label");
    }
  });
}

function renderChaliceAlerts(issues, assignments = lastChaliceIssueAssignments) {
  // Cache latest issues so view changes can re-run alignment without recomputing
  lastChaliceIssues = issues || { errors: [], warnings: [] };
  if (!assignments) assignments = buildChaliceIssueAssignments(issues);
  lastChaliceIssueAssignments = assignments;

  const layout = dom.chaliceLayout;
  const iconStack = dom.chaliceAlertIconStack;
  const iconError = dom.chaliceAlertIconError;
  const iconWarning = dom.chaliceAlertIconWarning;
  const panelWarn = dom.chaliceAlertPanelWarning;
  const panelWarnTitle = dom.chaliceAlertPanelTitleWarning;
  const listWarn = dom.chaliceAlertListWarning;
  const panelErr = dom.chaliceAlertPanelError;
  const panelErrTitle = dom.chaliceAlertPanelTitleError;
  const listErr = dom.chaliceAlertListError;

  if (!panelWarn || !panelErr || !listWarn || !listErr) return;

  const errors = Array.isArray(issues?.errors) ? issues.errors : [];
  const warnings = Array.isArray(issues?.warnings) ? issues.warnings : [];
  const msgText = (entry) => (typeof entry === "object" && entry !== null ? entry.message || String(entry) : String(entry));

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasAny = hasErrors || hasWarnings;

  if (!hasAny) {
    if (layout) layout.classList.remove("has-chalice-alerts");
    panelWarn.hidden = true;
    panelWarn.setAttribute("aria-hidden", "true");
    listWarn.innerHTML = "";
    panelErr.hidden = true;
    panelErr.setAttribute("aria-hidden", "true");
    listErr.innerHTML = "";
    if (iconStack) {
      iconStack.hidden = false;
      iconStack.setAttribute("aria-hidden", "false");
    }
    if (iconError) {
      iconError.hidden = true;
      iconError.removeAttribute("src");
    }
    if (iconWarning) {
      iconWarning.hidden = true;
      iconWarning.removeAttribute("src");
    }
    renderChaliceAlertCounts({ errors: [], warnings: [] });
    positionChaliceAlertCounts();
    return;
  }

  if (layout) layout.classList.add("has-chalice-alerts");
  const showErrorIcon = hasErrors;
  const showWarningIcon = hasWarnings;

  if (iconStack) {
    iconStack.hidden = false;
    iconStack.setAttribute("aria-hidden", "false");
  }

  if (iconError) {
    if (showErrorIcon) {
      iconError.src = alertIconUrl("error");
      iconError.alt = "Errors present";
      iconError.hidden = false;
    } else {
      iconError.hidden = true;
      iconError.removeAttribute("src");
    }
  }

  if (iconWarning) {
    if (showWarningIcon) {
      iconWarning.src = alertIconUrl("warning");
      iconWarning.alt = "Warnings present";
      iconWarning.hidden = false;
    } else {
      iconWarning.hidden = true;
      iconWarning.removeAttribute("src");
    }
  }

  // warnings panel
  if (hasWarnings) {
    const warningMsg = warnings
      .map(entry => `<li class="chalice-alert__item chalice-alert__item--warning">${escapeHtml(msgText(entry))}</li>`)
      .join("");
    listWarn.innerHTML = warningMsg;
    panelWarn.hidden = false;
    panelWarn.setAttribute("aria-hidden", "false");
    if (panelWarnTitle) {
      panelWarnTitle.textContent = warnings.length > 1 ? "Warnings detected" : "Warning detected";
    }
  } else {
    listWarn.innerHTML = "";
    panelWarn.hidden = true;
    panelWarn.setAttribute("aria-hidden", "true");
  }

  // errors panel
  if (hasErrors) {
    const errorMsg = errors
      .map(entry => `<li class="chalice-alert__item chalice-alert__item--error">${escapeHtml(msgText(entry))}</li>`)
      .join("");
    listErr.innerHTML = errorMsg;
    panelErr.hidden = false;
    panelErr.setAttribute("aria-hidden", "false");
    if (panelErrTitle) {
      panelErrTitle.textContent = errors.length > 1 ? "Errors detected" : "Error detected";
    }
  } else {
    listErr.innerHTML = "";
    panelErr.hidden = true;
    panelErr.setAttribute("aria-hidden", "true");
  }

  renderChaliceAlertCounts(assignments?.rail || { errors: [], warnings: [] });
  scheduleChaliceAlertLayout();
}

function positionChaliceAlertIcons() {
  const rail = dom.chaliceAlertIconStack;
  if (!rail || rail.hidden) return;

  const details = dom.chaliceDetails;
  const isCollapsed = details?.dataset?.detailsState === "collapsed";

  const warnIcon = dom.chaliceAlertIconWarning;
  const errIcon = dom.chaliceAlertIconError;

  if (isCollapsed) {
    positionCollapsedAlertIcons(warnIcon, errIcon, rail);
    return;
  }

  const warnHeader = dom.chaliceAlertPanelWarning?.querySelector(".chalice-alert-panel__header");
  const errHeader = dom.chaliceAlertPanelError?.querySelector(".chalice-alert-panel__header");

  const railRect = rail.getBoundingClientRect();
  if (!railRect || !railRect.height) return;

  const placeIcon = (iconEl, headerEl, key) => {
    if (!iconEl || iconEl.hidden || !headerEl) {
      if (iconEl) iconEl.style.top = "";
      lastChaliceIconOffsets[key] = null;
      return;
    }
    const headerRect = headerEl.getBoundingClientRect();
    const iconHeight = iconEl.getBoundingClientRect().height || 0;
    const targetCenter = headerRect.top + headerRect.height * 0.5;
    const offset = targetCenter - railRect.top - iconHeight * 0.5 - 4;
    const clamped = Math.max(0, offset);
    iconEl.style.top = `${clamped}px`;
    lastChaliceIconOffsets[key] = clamped;
  };

  placeIcon(warnIcon, warnHeader, "warning");
  placeIcon(errIcon, errHeader, "error");
}

function positionCollapsedAlertIcons(warnIcon, errIcon, rail) {
  // Flex layout + CSS padding-top handles positioning; clear inline tops
  if (rail) rail.style.paddingTop = "";
  [warnIcon, errIcon].forEach(icon => {
    if (icon) icon.style.top = "";
  });
}

function positionChaliceAlertCounts() {
  const rail = dom.chaliceAlertIconStack;
  const warnRoot = document.getElementById("chaliceAlertCountsWarning");
  const errRoot = document.getElementById("chaliceAlertCountsError");
  const warnList = dom.chaliceAlertListWarning;
  const errList = dom.chaliceAlertListError;
  const detailsState = dom.chaliceResultsShell?.dataset?.detailsState || dom.chaliceLayout?.dataset?.detailsState || "";
  const isCollapsed = detailsState === "collapsed";

  const resetRoot = (root) => {
    if (!root) return;
    root.style.position = "";
    root.style.top = "";
    root.style.left = "";
    root.style.transform = "";
    root.style.height = "";
    const ol = root.querySelector("ol");
    if (ol) {
      ol.style.position = "";
      Array.from(ol.children).forEach(li => {
        li.style.position = "";
        li.style.top = "";
        li.style.left = "";
        li.style.transform = "";
      });
    }
  };

  if (!rail || rail.hidden || isCollapsed) {
    resetRoot(warnRoot);
    resetRoot(errRoot);
    return;
  }

  const railRect = rail.getBoundingClientRect();
  if (!railRect || !railRect.height) {
    resetRoot(warnRoot);
    resetRoot(errRoot);
    return;
  }

  const placeCounts = (root, listEl) => {
    if (!root || root.hidden) {
      resetRoot(root);
      return;
    }
    const ol = root.querySelector("ol");
    if (!ol || !listEl) {
      resetRoot(root);
      return;
    }
    const items = Array.from(listEl.querySelectorAll(".chalice-alert__item"));
    if (!items.length) {
      resetRoot(root);
      return;
    }

    const badgeItems = Array.from(ol.children);
    const firstRect = items[0].getBoundingClientRect();
    const badgeHeight = badgeItems[0]?.getBoundingClientRect()?.height || 0;
    const baseTop = Math.max(0, firstRect.top - railRect.top);

    root.style.position = "absolute";
    root.style.left = "50%";
    root.style.transform = "translateX(-50%)";
    root.style.top = `${baseTop}px`;

    ol.style.position = "relative";

    let maxOffset = 0;
    badgeItems.forEach((li, idx) => {
      const target = items[idx];
      if (!target) return;
      const targetRect = target.getBoundingClientRect();
      const offset = targetRect.top - firstRect.top;
      maxOffset = Math.max(maxOffset, offset);
      li.style.position = "absolute";
      li.style.left = "50%";
      li.style.transform = "translateX(-50%)";
      li.style.top = `${offset}px`;
    });

    const totalHeight = maxOffset + badgeHeight;
    if (totalHeight > 0) root.style.height = `${totalHeight}px`;
  };

  placeCounts(warnRoot, warnList);
  placeCounts(errRoot, errList);
}

function scheduleChaliceAlertLayout() {
  // Immediate pass for already-stable layouts
  positionChaliceAlertIcons();
  positionChaliceAlertCounts();

  // Next frame handles freshly-updated DOM
  requestAnimationFrame(() => {
    positionChaliceAlertIcons();
    positionChaliceAlertCounts();
  });

  // One more frame catches CSS transitions triggered by details state changes
  requestAnimationFrame(() => {
    positionChaliceAlertIcons();
    positionChaliceAlertCounts();
  });
}

function installChaliceAlertLayoutListeners() {
  const targets = [dom.chaliceDetails, dom.chaliceResultsShell, dom.chaliceLayout].filter(Boolean);
  const events = ["transitionend", "animationend"]; // re-run after CSS-driven layout shifts

  targets.forEach(target => {
    events.forEach(evt => {
      target.addEventListener(evt, e => {
        const prop = e?.propertyName || "";
        if (prop && !/height|width|top|bottom|left|right|margin|padding|transform|gap/i.test(prop)) return;
        scheduleChaliceAlertLayout();
      });
    });
  });

  // ResizeObserver catches content-driven height changes (e.g., alert text wrapping)
  const observed = [dom.chaliceAlertListWarning, dom.chaliceAlertListError].filter(Boolean);
  if (observed.length && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => scheduleChaliceAlertLayout());
    observed.forEach(el => ro.observe(el));
  }
}

function renderChaliceResults() {
  const standardMeta = sideInfo("standard");
  const depthMeta = sideInfo("depth");
  const standard = generateCombosForSide(standardMeta);
  const depth = generateCombosForSide(depthMeta);

  // Roll-order UI affordances — recompute live so we don't rely on stale cache
  const rollIssuesStandard = isAutoSortEnabled() ? [] : chaliceRollIssuesForSide(standardMeta).issues;
  const rollIssuesDepth = isAutoSortEnabled() ? [] : chaliceRollIssuesForSide(depthMeta).issues;
  const rollIssues = [...(rollIssuesStandard || []), ...(rollIssuesDepth || [])];
  const hasRollIssue = rollIssues.length > 0;
  const rollMoves = hasRollIssue && !isAutoSortEnabled() ? buildChaliceRollMoveMap(rollIssues) : new Map();
  lastChaliceRollIssues = { standard: rollIssuesStandard, depth: rollIssuesDepth };

  // Debug hook: surface current roll-order state for console inspection
  if (typeof window !== "undefined") {
    window.__chaliceRollDebug = {
      autoSortEnabled: isAutoSortEnabled(),
      rollIssues,
      rollMoves: Array.from(rollMoves.entries())
    };
  }

  if (dom.chaliceAutoSortBtn) {
    const showAutoSort = hasRollIssue && !isAutoSortEnabled();
    dom.chaliceAutoSortBtn.hidden = !showAutoSort;
    dom.chaliceAutoSortBtn.disabled = !showAutoSort;
  }

  updateChaliceStatusFromResults(standard, depth);
  renderChaliceStatOverview();
  const stackingIssues = computeChaliceStackingIssues();
  const unplacedIssues = [
    ...unplacedIssuesForSide(standard, standardMeta),
    ...unplacedIssuesForSide(depth, depthMeta)
  ];
  if (unplacedIssues.length) stackingIssues.errors.push(...unplacedIssues);

  if (!isAutoSortEnabled()) {
    stackingIssues.warnings.unshift({
      message: "Auto-Sort is off. Effects will not be auto-reordered until you turn it back on.",
      code: "auto-sort-off"
    });
  }

  if (showIllegalActive) {
    stackingIssues.errors.unshift({
      message: "Showing illegal combinations; type filtering is ignored.",
      code: "show-illegal-on"
    });
  }

  if (hasRollIssue && !isAutoSortEnabled()) {
    const sidesWithIssues = [];
    if (lastChaliceRollIssues.standard?.length) sidesWithIssues.push("Standard");
    if (lastChaliceRollIssues.depth?.length) sidesWithIssues.push("Depth of Night");
    const sideText = sidesWithIssues.join(" / ") || "This side";
    const rollIssueSlots = rollIssues.flatMap(issue => {
      const indices = issue?.combo?.indices || [];
      const sideKey = issue?.meta?.key || "standard";
      return indices.map(idx => ({ side: sideKey, slot: idx }));
    });
    const rollIssueIds = rollIssueSlots.map(s => String(chaliceSelections[s.side]?.[s.slot] || ""));
    stackingIssues.errors.push({
      message: `${sideText} effects are out of roll order. Enable Auto-Sort or use the Auto-Sort button.`,
      slots: rollIssueSlots,
      ids: rollIssueIds,
      code: "roll-order"
    });
  }

  const validSlots = validSlotSetFromCombos(standard, depth);
  lastChaliceIssueAssignments = buildChaliceIssueAssignments(stackingIssues);
  renderChaliceAlerts(stackingIssues, lastChaliceIssueAssignments);
  renderIllegalErrorBadge(lastChaliceIssueAssignments);
  renderAutoSortWarningBadge(lastChaliceIssueAssignments);
  updateChaliceSlotIssues(lastChaliceIssueAssignments, validSlots, rollMoves);
}

function updateChaliceCounts() {
  const std = chaliceSelections.standard.filter(Boolean).length;
  const dep = chaliceSelections.depth.filter(Boolean).length;
  if (dom.chaliceStandardCount) dom.chaliceStandardCount.textContent = `${std} / 9`;
  if (dom.chaliceDepthCount) dom.chaliceDepthCount.textContent = `${dep} / 9`;
  if (dom.chaliceFilterTotals) dom.chaliceFilterTotals.textContent = `${std} / 9 Standard • ${dep} / 9 Depth`;
}

function openQuickChalicePicker(sideKey, anchorBtn) {
  const idx = firstAvailableChaliceSlot(sideKey);
  openChaliceEffectMenu(sideKey, idx, anchorBtn);
}

function renderChaliceUI() {
  maybeAutoSortChalice();
  renderChaliceLists();
  updateChaliceCounts();
  renderChaliceColors();
  renderChaliceResults();
  applyChaliceGrouping();
}

function resetChaliceSelections() {
  chaliceSelections.standard.fill("");
  chaliceSelections.depth.fill("");
  chaliceCats.standard.fill("");
  chaliceCats.depth.fill("");
  chaliceCurses.standard.fill("");
  chaliceCurses.depth.fill("");
  conditionalEffectState.clear();
  selectedChaliceId = "";
  setChaliceStatus("");
  renderChalicePickers();
  renderChaliceUI();
}

function getSelectedChalice() {
  if (selectedChaliceId === "") return null;
  const list = filteredChalices();
  return list.find(c => String(c.chaliceID) === String(selectedChaliceId)) || list[0] || null;
}

function colorChip(color) {
  const swatch = COLOR_SWATCH[color] || "#4a4f59";
  return `<span class="chalice-color-chip" data-color="${color}" style="--chip-color:${swatch}" title="${color}">${color}</span>`;
}

function renderChaliceColors() {
  if (!dom.chaliceStandardColors || !dom.chaliceDepthColors) return;
  const entry = getSelectedChalice();
  const isAllChalices = !entry && selectedChaliceId === "";
  const fallbackDots = isAllChalices ? ["#ffffff", "#ffffff", "#ffffff"] : [];
  const stdColors = entry ? [entry.standard1, entry.standard2, entry.standard3].filter(Boolean) : fallbackDots;
  const depthColors = entry ? [entry.depth1, entry.depth2, entry.depth3].filter(Boolean) : fallbackDots;

  const toSwatch = (color) => {
    if (color == null) return "#ffffff";
    const raw = COLOR_SWATCH[color] || color;
    return normalizeChaliceColor(raw);
  };

  const dotHtml = (list) => list.map(color => {
    const swatch = toSwatch(color);
    return `<span class="chalice-color-dot" data-color="${swatch}" style="background:${swatch};"></span>`;
  }).join("");

  const stdSwatches = stdColors.map(toSwatch);
  const depthSwatches = depthColors.map(toSwatch);

  chaliceColorListCache.standard = stdSwatches;
  chaliceColorListCache.depth = depthSwatches;

  chaliceColorCache.standard = stdSwatches.length ? stdSwatches[0] : "#ffffff";
  chaliceColorCache.depth = depthSwatches.length ? depthSwatches[0] : "#ffffff";

  setChaliceSideColorVar(sideInfo("standard"), chaliceColorCache.standard);
  setChaliceSideColorVar(sideInfo("depth"), chaliceColorCache.depth);

  applyChaliceGrouping();

  dom.chaliceStandardColors.innerHTML = dotHtml(stdColors);
  dom.chaliceDepthColors.innerHTML = dotHtml(depthColors);
}

function chaliceSideColor(meta, index = 0) {
  const list = chaliceColorListCache[meta.key] || [];
  if (list.length) return list[index % list.length] || list[0];
  return chaliceColorCache[meta.key] || "#ffffff";
}

function comboKeyFromIndices(indices) {
  const sorted = [...indices].sort((a, b) => a - b);
  return sorted.join("-");
}

function orderedCombosWithSaved(meta, combos) {
  const list = Array.isArray(combos) ? [...combos] : [];
  if (!list.length) return list;

  const saved = Array.isArray(chaliceGroupOrder[meta.key]) ? chaliceGroupOrder[meta.key] : [];
  if (!saved.length) return list;

  const byKey = new Map();
  list.forEach(combo => {
    const key = comboKeyFromIndices(combo.indices || []);
    if (!byKey.has(key)) byKey.set(key, combo);
  });

  const ordered = [];
  saved.forEach(key => {
    if (byKey.has(key)) {
      ordered.push(byKey.get(key));
      byKey.delete(key);
    }
  });

  // Append any new combos that weren't in the saved order
  byKey.forEach(combo => ordered.push(combo));
  return ordered;
}

function setSavedGroupOrder(meta, combos) {
  const keys = (Array.isArray(combos) ? combos : []).map(c => comboKeyFromIndices(c.indices || []));
  chaliceGroupOrder[meta.key] = keys;
}

function snapshotComboData(meta, indices) {
  return {
    effects: indices.map(i => chaliceSelections[meta.key][i] || ""),
    cats: indices.map(i => chaliceCats[meta.key][i] || ""),
    curses: indices.map(i => chaliceCurses[meta.key][i] || "")
  };
}

function writeComboData(meta, indices, data) {
  indices.forEach((slotIdx, offset) => {
    chaliceSelections[meta.key][slotIdx] = data.effects[offset] || "";
    chaliceCats[meta.key][slotIdx] = data.cats[offset] || "";
    chaliceCurses[meta.key][slotIdx] = data.curses[offset] || "";
  });
}

function reorderChaliceGroupsData(meta, keyOrder) {
  const result = generateCombosForSide(meta, { allowMissingCurse: true });
  const comboByKey = new Map();
  (result.combos || []).forEach(combo => {
    const key = comboKeyFromIndices(combo.indices || []);
    comboByKey.set(key, combo.indices || []);
  });

  const buckets = [...comboByKey.entries()]
    .map(([key, indices]) => ({ key, indices, min: Math.min(...indices) }))
    .sort((a, b) => a.min - b.min);

  if (!buckets.length) return;

  // Normalize target order: start with requested, then append any missing keys in original bucket order
  const requested = Array.isArray(keyOrder) ? keyOrder.filter(k => comboByKey.has(k)) : [];
  const normalized = [...requested];
  buckets.forEach(bucket => {
    if (!normalized.includes(bucket.key)) normalized.push(bucket.key);
  });
  normalized.length = buckets.length;

  // Snapshot source data per key
  const dataByKey = new Map();
  buckets.forEach(bucket => {
    dataByKey.set(bucket.key, snapshotComboData(meta, bucket.indices));
  });

  // Write data into buckets following normalized order; colors stay on their buckets
  buckets.forEach((bucket, idx) => {
    const sourceKey = normalized[idx];
    const payload = dataByKey.get(sourceKey);
    if (payload) writeComboData(meta, bucket.indices, payload);
  });
}

function clearChaliceEffectDragState() {
  chaliceEffectDrag.side = "";
  chaliceEffectDrag.slot = -1;
}

function swapChaliceSlotData(meta, a, b) {
  const arrays = [chaliceSelections[meta.key], chaliceCats[meta.key], chaliceCurses[meta.key]];
  arrays.forEach(arr => {
    [arr[a], arr[b]] = [arr[b], arr[a]];
  });
}

function canSwapChaliceEffects(meta, sourceIdx, targetIdx) {
  if (sourceIdx === targetIdx) return false;
  const effects = chaliceSelections[meta.key];
  if (!Array.isArray(effects)) return false;
  const max = effects.length;
  if (![sourceIdx, targetIdx].every(i => Number.isInteger(i) && i >= 0 && i < max)) return false;

  const rowSource = chaliceRow(effects[sourceIdx]);
  const rowTarget = chaliceRow(effects[targetIdx]);
  const sourceCompat = compatId(rowSource);
  const targetCompat = compatId(rowTarget);
  const sourceCat = effectCategoryForRow(rowSource) || "";
  const targetCat = effectCategoryForRow(rowTarget) || "";

  const before = generateCombosForSide(meta);
  const targetCombo = Array.isArray(before?.combos)
    ? before.combos.find(c => (c.indices || []).includes(targetIdx))
    : null;
  const sourceCombo = Array.isArray(before?.combos)
    ? before.combos.find(c => (c.indices || []).includes(sourceIdx))
    : null;

  // Case: source is in a trio, target is not in that trio (or any trio)
  if (sourceCombo && !targetCombo) {
    const comboCompats = new Set((sourceCombo.slotRows || []).map(r => compatId(r)).filter(Boolean));

    const sharesCompat = sourceCompat && targetCompat && sourceCompat === targetCompat;
    const sharesCategory = sourceCat && targetCat && sourceCat === targetCat;
    const targetIsOutsideCompat = !targetCompat || !comboCompats.has(targetCompat);

    if (sharesCompat || sharesCategory || targetIsOutsideCompat) {
      return true;
    }

    return false;
  }

  // If the target slot is in a trio, enforce compatibility-based rules.
  if (targetCombo) {
    const comboCompats = new Set((targetCombo.slotRows || []).map(r => compatId(r)).filter(Boolean));

    if (sourceCompat && comboCompats.has(sourceCompat)) {
      // Source shares a compat with the trio: only allow swap with the matching compat member.
      return targetCompat === sourceCompat;
    }

    // Source has no compat overlap with the trio: allow the swap.
    return true;
  }

  // No trio involved: allow swap.
  return true;
}

function performChaliceSwap(meta, sourceIdx, targetIdx) {
  if (!canSwapChaliceEffects(meta, sourceIdx, targetIdx)) return false;
  swapChaliceSlotData(meta, sourceIdx, targetIdx);
  return true;
}

function flashChaliceSwapError(slotEl) {
  if (!slotEl) return;
  slotEl.classList.remove("chalice-slot--swap-error");
  // Force reflow to restart animation
  void slotEl.offsetWidth; // eslint-disable-line no-unused-expressions
  slotEl.classList.add("chalice-slot--swap-error");
}

const chaliceGroupDrag = {
  side: "",
  key: ""
};

function clearChaliceGroupDragState() {
  chaliceGroupDrag.side = "";
  chaliceGroupDrag.key = "";
}

function installChaliceGroupDrag(listEl, meta) {
  if (!listEl) return;
  const groups = Array.from(listEl.querySelectorAll(".chalice-slot-group"));
  const enableDrag = groups.length >= 2;

  groups.forEach(group => {
    if (!enableDrag) {
      group.removeAttribute("draggable");
      return;
    }

    group.setAttribute("draggable", "true");
    group.dataset.side = meta.key;

    group.addEventListener("dragstart", evt => {
      const key = group.dataset.chGroupKey || "";
      if (!key || !evt.dataTransfer) return;
      chaliceGroupDrag.side = meta.key;
      chaliceGroupDrag.key = key;
      group.classList.add("is-dragging");
      evt.dataTransfer.effectAllowed = "move";
      evt.dataTransfer.setData("text/plain", key);
    });

    group.addEventListener("dragend", () => {
      group.classList.remove("is-dragging");
      groups.forEach(g => {
        g.classList.remove("is-dragover");
      });
      clearChaliceGroupDragState();
    });

    group.addEventListener("dragover", evt => {
      if (!chaliceGroupDrag.key || chaliceGroupDrag.side !== meta.key) return;
      evt.preventDefault();
      evt.dataTransfer.dropEffect = "move";
      groups.forEach(g => {
        g.classList.remove("is-dragover");
      });
      group.classList.add("is-dragover");
    });

    group.addEventListener("dragleave", () => {
      group.classList.remove("is-dragover");
    });

    group.addEventListener("drop", evt => {
      if (!chaliceGroupDrag.key || chaliceGroupDrag.side !== meta.key) return;
      evt.preventDefault();
      const targetKey = group.dataset.chGroupKey || "";
      if (!targetKey || targetKey === chaliceGroupDrag.key) return;

      const current = Array.isArray(chaliceGroupOrder[meta.key]) ? [...chaliceGroupOrder[meta.key]] : [];
      const cleaned = current.filter(k => k);
      if (!cleaned.length) {
        const liveKeys = groups.map(g => g.dataset.chGroupKey || "").filter(Boolean);
        cleaned.push(...liveKeys);
      }

      const sourceIdx = cleaned.indexOf(chaliceGroupDrag.key);
      const targetIdx = cleaned.indexOf(targetKey);
      if (sourceIdx === -1 || targetIdx === -1) return;

      const next = [...cleaned];
      [next[sourceIdx], next[targetIdx]] = [next[targetIdx], next[sourceIdx]];

      chaliceGroupOrder[meta.key] = next;
      reorderChaliceGroupsData(meta, next);
      clearChaliceGroupDragState();
      applyChaliceGrouping();
    });
  });
}

function installChaliceEffectDrag(listEl, meta) {
  if (!listEl) return;
  const slots = Array.from(listEl.querySelectorAll(".chalice-slot"));
  const handles = Array.from(listEl.querySelectorAll("[data-ch-slot-handle]"));

  const clearOverStates = () => {
    slots.forEach(s => s.classList.remove("is-dragover"));
  };

  handles.forEach(handle => {
    const slotEl = handle.closest(".chalice-slot");
    const slotIdx = Number(slotEl?.getAttribute("data-slot"));
    if (!slotEl || !Number.isInteger(slotIdx)) return;

    handle.addEventListener("dragstart", evt => {
      evt.stopPropagation();
      if (!evt.dataTransfer) return;
      chaliceEffectDrag.side = meta.key;
      chaliceEffectDrag.slot = slotIdx;
      slotEl.classList.add("is-dragging");
      evt.dataTransfer.effectAllowed = "move";
      evt.dataTransfer.setData("text/plain", `${meta.key}:${slotIdx}`);
    });

    handle.addEventListener("dragend", evt => {
      evt.stopPropagation();
      slotEl.classList.remove("is-dragging");
      clearOverStates();
      clearChaliceEffectDragState();
    });
  });

  slots.forEach(slot => {
    const targetIdx = Number(slot.getAttribute("data-slot"));
    if (!Number.isInteger(targetIdx)) return;

    slot.addEventListener("dragover", evt => {
      if (!evt.dataTransfer) return;
      if (!chaliceEffectDrag.side || chaliceEffectDrag.side !== meta.key) return;
      evt.preventDefault();
      evt.stopPropagation();
      evt.dataTransfer.dropEffect = "move";
      clearOverStates();
      slot.classList.add("is-dragover");
    });

    slot.addEventListener("dragleave", evt => {
      evt.stopPropagation();
      slot.classList.remove("is-dragover");
    });

    slot.addEventListener("drop", evt => {
      if (!evt.dataTransfer) return;
      if (!chaliceEffectDrag.side || chaliceEffectDrag.side !== meta.key) return;
      evt.preventDefault();
      evt.stopPropagation();
      clearOverStates();

      const sourceIdx = chaliceEffectDrag.slot;
      const destIdx = targetIdx;
      if (!Number.isInteger(sourceIdx) || !Number.isInteger(destIdx)) {
        clearChaliceEffectDragState();
        return;
      }

      const autoSortWasEnabled = isAutoSortEnabled();
      const beforeEffects = Array.isArray(chaliceSelections[meta.key]) ? [...chaliceSelections[meta.key]] : [];
      const beforeCats = Array.isArray(chaliceCats[meta.key]) ? [...chaliceCats[meta.key]] : [];
      const beforeCurses = Array.isArray(chaliceCurses[meta.key]) ? [...chaliceCurses[meta.key]] : [];

      const logSwap = (label, payload) => {
        // Lightweight tracing to debug auto-sort toggling on refused swaps
        try {
          console.log(`[chalice-swap] ${label}`, payload);
        } catch (e) {
          /* noop */
        }
      };

      logSwap("drop", { side: meta.key, sourceIdx, destIdx, autoSortWasEnabled, beforeEffects });

      if (performChaliceSwap(meta, sourceIdx, destIdx)) {
        logSwap("swap-accepted", { afterSwap: chaliceSelections[meta.key] });

        // Disable auto-sort immediately on a successful swap so render won't reorder it away
        setAutoSortEnabled(false);
        renderChaliceUI();

        const afterEffects = Array.isArray(chaliceSelections[meta.key]) ? chaliceSelections[meta.key] : [];
        const swapped = beforeEffects.some((val, i) => val !== afterEffects[i]);

        logSwap("post-render", { afterEffects, swapped, autoSortNow: isAutoSortEnabled() });

        if (!swapped) {
          // Swap was effectively rejected downstream; restore state and auto-sort, show error
          chaliceSelections[meta.key] = beforeEffects;
          chaliceCats[meta.key] = beforeCats;
          chaliceCurses[meta.key] = beforeCurses;
          setAutoSortEnabled(autoSortWasEnabled);
          const sourceSlot = listEl.querySelector(`.chalice-slot[data-slot="${sourceIdx}"]`);
          flashChaliceSwapError(sourceSlot);
          flashChaliceSwapError(slot);
          renderChaliceUI();
          logSwap("swap-reverted", { restored: chaliceSelections[meta.key], autoSortRestored: isAutoSortEnabled() });
        }

        clearChaliceEffectDragState();
      } else {
        setAutoSortEnabled(autoSortWasEnabled);
        const sourceSlot = listEl.querySelector(`.chalice-slot[data-slot="${sourceIdx}"]`);
        flashChaliceSwapError(sourceSlot);
        flashChaliceSwapError(slot);
        clearChaliceEffectDragState();
        logSwap("swap-refused", { reason: "canSwap returned false", autoSortRestored: isAutoSortEnabled() });
      }
    });
  });
}

function applyChaliceGroupingForSide(meta) {
  const listEl = meta.key === "depth" ? dom.chaliceDepthList : dom.chaliceStandardList;
  if (!listEl) return;

  // Unwrap previous groupings so we start from a clean list
  const priorGroups = Array.from(listEl.querySelectorAll(".chalice-slot-group"));
  priorGroups.forEach(group => {
    const inner = group.querySelector(".chalice-slot-group__list");
    if (inner) {
      Array.from(inner.children).forEach(li => {
        listEl.insertBefore(li, group);
      });
    }
    group.remove();
  });

  const result = generateCombosForSide(meta);
  if (!result.combos.length) {
    installChaliceEffectDrag(listEl, meta);
    return;
  }

  const orderedCombos = orderedCombosWithSaved(meta, result.combos);
  setSavedGroupOrder(meta, orderedCombos);
  const hasMultipleCombos = orderedCombos.length >= 2;

  const slotLiByIdx = new Map();
  listEl.querySelectorAll(".chalice-slot").forEach(slot => {
    const idx = Number(slot.getAttribute("data-slot"));
    if (Number.isInteger(idx)) slotLiByIdx.set(idx, slot.closest("li"));
  });

  // Reorder list items to match desired group order so content moves between color buckets
  const orderedLis = [];
  const usedIdx = new Set();
  orderedCombos.forEach(combo => {
    const indices = [...(combo.indices || [])].sort((a, b) => a - b);
    const members = indices.map(i => slotLiByIdx.get(i)).filter(Boolean);
    if (members.length !== indices.length) return;
    members.forEach(m => {
      orderedLis.push(m);
      usedIdx.add(Number(m.querySelector(".chalice-slot")?.getAttribute("data-slot")));
    });
  });

  // Append any remaining slots that were not part of combos
  slotLiByIdx.forEach((li, idx) => {
    if (!usedIdx.has(idx)) orderedLis.push(li);
  });

  if (orderedLis.length) {
    listEl.innerHTML = "";
    orderedLis.forEach(li => listEl.appendChild(li));
  }

  const used = new Set();

  orderedCombos.forEach((combo, comboIdx) => {
    const indices = [...combo.indices].sort((a, b) => a - b);
    const members = indices.map(i => slotLiByIdx.get(i)).filter(Boolean);
    if (members.length !== indices.length) return;
    if (members.some(node => used.has(node))) return;

    const groupLi = document.createElement("li");
    groupLi.className = "chalice-slot-group";
    const groupKey = comboKeyFromIndices(combo.indices || []);
    groupLi.dataset.chGroupKey = groupKey;
    groupLi.dataset.side = meta.key;

    if (hasMultipleCombos) {
      const handle = document.createElement("div");
      handle.className = "chalice-slot-group__handle";
      handle.setAttribute("aria-hidden", "true");
      groupLi.appendChild(handle);
    }

    const innerList = document.createElement("ol");
    innerList.className = "chalice-slot-group__list";
    groupLi.appendChild(innerList);

    const insertBeforeNode = members[0];
    listEl.insertBefore(groupLi, insertBeforeNode);

    members.forEach(node => {
      used.add(node);
      innerList.appendChild(node);
    });
  });

  // Apply positional colors after grouping so colors stay with slots, not with the moved trio content
  const groups = Array.from(listEl.querySelectorAll(".chalice-slot-group"));
  groups.forEach((group, idx) => {
    const color = chaliceSideColor(meta, idx) || "#ffffff";
    group.style.setProperty("--chalice-group-color", color);
    group.style.borderColor = color;
    const handleDot = textColorFor(color);
    group.style.setProperty("--chalice-handle-dot-color", handleDot);
  });

  installChaliceGroupDrag(listEl, meta);
  installChaliceEffectDrag(listEl, meta);
}

function applyChaliceGrouping() {
  applyChaliceGroupingForSide(sideInfo("standard"));
  applyChaliceGroupingForSide(sideInfo("depth"));
}

function renderChalicePickers() {
  if (dom.chaliceSelect) {
    const list = filteredChalices();
    const optionsHtml = [
      `<option value="">-- Chalice / All --</option>`,
      ...list.map(c => `<option value="${c.chaliceID}">${c.chalicename}</option>`)
    ].join("");
    dom.chaliceSelect.innerHTML = optionsHtml;
    if (!selectedChaliceId && selectedChaliceId !== "") selectedChaliceId = "";
    const hasCurrent = selectedChaliceId === "" || list.some(c => String(c.chaliceID) === String(selectedChaliceId));
    if (!hasCurrent) selectedChaliceId = list.length ? list[0].chaliceID : "";
    dom.chaliceSelect.value = selectedChaliceId;
  }

  renderChaliceColors();
}

function indexChaliceData(list) {
  chalicesByCharacter = new Map();
  for (const entry of list || []) {
    const char = (entry?.character || "").toString().trim();
    if (!char) continue;
    if (!chalicesByCharacter.has(char)) chalicesByCharacter.set(char, []);
    chalicesByCharacter.get(char).push(entry);
  }

  for (const [, arr] of chalicesByCharacter.entries()) {
    arr.sort((a, b) => String(a?.chalicename || "").localeCompare(String(b?.chalicename || "")));
  }

  const initialList = filteredChalices();
  if (selectedChaliceId == null) selectedChaliceId = "";
}

// Meta visibility toggle removed; info is now provided via hover tooltips on the info icon.

function resetAllPreserveIllegal(desiredIllegal) {
  dom.selType.value = "";
  if (dom.selClass) dom.selClass.value = "";
  selectedColor = "Random";

  selectedClass = "";
  updateCharacterNameLabel();
  resetVitalsPlaceholders();

  setShowIllegalActive(Boolean(desiredIllegal));

  for (let i = 0; i < selectedEffects.length; i++) setSelectedId(i, "");
  for (let i = 0; i < selectedCats.length; i++) selectedCats[i] = "";
  for (let i = 0; i < curseBySlot.length; i++) curseBySlot[i] = null;
  conditionalEffectState.clear();

  pickRandomColor();
  updateUI("illegal-change");
}

function resetClassFilter() {
  selectedClass = "";
  if (dom.selClass) {
    dom.selClass.value = "";
    populateClassOptions();
  }
  updateCharacterNameLabel();
  resetVitalsPlaceholders();
}

function resetAll() {
  dom.selType.value = "";
  if (dom.selClass) dom.selClass.value = "";
  selectedColor = "Random";

  setShowIllegalActive(false);

  selectedClass = "";
  updateCharacterNameLabel();
  resetVitalsPlaceholders();

  for (let i = 0; i < selectedEffects.length; i++) setSelectedId(i, "");
  for (let i = 0; i < selectedCats.length; i++) selectedCats[i] = "";
  for (let i = 0; i < curseBySlot.length; i++) curseBySlot[i] = null;
  conditionalEffectState.clear();

  pickRandomColor();
  updateUI("reset");
}

async function load() {
  const [relicRes, chaliceRes, effectStatsRes] = await Promise.all([
    fetch(DATA_URL, { cache: "no-store" }),
    fetch(CHALICE_DATA_URL, { cache: "no-store" }).catch(() => null),
    fetch(EFFECT_STATS_URL, { cache: "no-store" }).catch(() => null)
  ]);

  if (!relicRes.ok) throw new Error(`Failed to load ${DATA_URL} (${relicRes.status})`);

  rowsAll = await relicRes.json();
  byIdAll = new Map(rowsAll.map(r => [String(r.EffectID), r]));
  curses = rowsAll.filter(r => String(r?.Curse ?? "0") === "1");
  rows = rowsAll.filter(r => String(r?.Curse ?? "0") !== "1");
  byId = new Map(rows.map(r => [String(r.EffectID), r]));
  pickRandomColor();

  if (chaliceRes && chaliceRes.ok) {
    try {
      chaliceData = await chaliceRes.json();
      indexChaliceData(chaliceData);
      renderChalicePickers();
    } catch (err) {
      console.warn("Failed to parse chalice data", err);
    }
  } else {
    console.warn("Chalice data not loaded; builder will be empty.");
  }

  if (effectStatsRes && effectStatsRes.ok) {
    try {
      const statsJson = await effectStatsRes.json();
      ingestEffectStats(statsJson);
    } catch (err) {
      console.warn("Failed to parse effect stats", err);
    }
  } else {
    console.warn("Effect stats not loaded; Stat Overview will be empty.");
  }

  dom.relicImg.src = relicDefaultPath(visualRelicType(dom.selType.value));
  installRelicImgFallback(dom.relicImg, () => effectiveRelicType());

  installColorChipMenu();
  installUtilityPopoverButtons();

  // Default illegal toggle is off
  setShowIllegalActive(false);
  // Default auto-sort is on
  setAutoSortEnabled(true);

  if (dom.modeBtnIndividual) dom.modeBtnIndividual.addEventListener("click", () => setMode(MODES.INDIVIDUAL));
  if (dom.modeBtnChalice) dom.modeBtnChalice.addEventListener("click", () => setMode(MODES.CHALICE));

  dom.selType.addEventListener("change", () => {
    clearSelectionsIncompatibleWithType(dom.selType.value);
    updateUI("type-change");
  });
  if (dom.selClass) {
    populateClassOptions();
    updateCharacterNameLabel();
    dom.selClass.addEventListener("change", evt => {
      setSelectedClass(evt.target.value || "", true);
    });
  }
  const illegalButtons = showIllegalButtons();
  if (illegalButtons.length) {
    illegalButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const next = !isShowIllegalActive();
        setShowIllegalActive(next);
        resetAllPreserveIllegal(next);
        if (typeof isChaliceMode === "function" && isChaliceMode()) {
          renderChaliceUI();
        }
      });
    });
  }
  const autoSortToggles = autoSortButtons();
  if (autoSortToggles.length) {
    autoSortToggles.forEach(btn => {
      btn.addEventListener("click", handleAutoSortToggle);
    });
  }
  if (dom.startOverBtn) dom.startOverBtn.addEventListener("click", handleStartOver);

  if (dom.chaliceCharacter) {
    dom.chaliceCharacter.addEventListener("change", evt => {
      selectedCharacter = evt.target.value || "";
      renderChalicePickers();
      renderChaliceUI();
    });
  }

  if (dom.chaliceSelect) {
    dom.chaliceSelect.addEventListener("change", evt => {
      selectedChaliceId = evt.target.value || "";
      renderChaliceUI();
    });
  }

  if (dom.chaliceAddStandard) {
    dom.chaliceAddStandard.addEventListener("click", () => openQuickChalicePicker("standard", dom.chaliceAddStandard));
  }

  if (dom.chaliceAddDepth) {
    dom.chaliceAddDepth.addEventListener("click", () => openQuickChalicePicker("depth", dom.chaliceAddDepth));
  }

  if (dom.chaliceAutoSortBtn) {
    dom.chaliceAutoSortBtn.addEventListener("click", () => {
      maybeAutoSortChalice(true);
      renderChaliceUI();
    });
  }

  if (dom.chaliceDetailsCollapseBtn) {
    dom.chaliceDetailsCollapseBtn.addEventListener("click", () => applyChaliceDetailsView(DETAILS_VIEW.COLLAPSED));
  }

  if (dom.chaliceDetailsCollapseBtnFull) {
    dom.chaliceDetailsCollapseBtnFull.addEventListener("click", () => applyChaliceDetailsView(DETAILS_VIEW.PARTIAL));
  }

  if (dom.chaliceResultsToggle) {
    dom.chaliceResultsToggle.addEventListener("click", () => cycleChaliceDetailsView());
  }

  installChaliceAlertLayoutListeners();

  // Keep coming-soon blur opt-in togglable for internal use (default on)
  setComingSoonBlur(true);

  renderChaliceUI();
  applyChaliceDetailsView(chaliceDetailsView);
  syncModeUI();
  updateUI("init");
}

load().catch(err => {
  console.error(err);
  if (dom.detailsBody) {
    dom.detailsBody.innerHTML = `
      <div class="info-box is-alert">
        <div class="info-line">Error loading data.</div>
        <div class="popover" style="display:block; margin-top:0.55rem;">
          <div class="popover-title">Error</div>
          <div class="popover-body">
            <p><code>${String(err.message || err)}</code></p>
          </div>
        </div>
      </div>
    `;
  }
  dom.relicImg.src = "";
});
