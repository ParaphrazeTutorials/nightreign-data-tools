import { CHALICE_DATA_URL, DATA_URL, relicDefaultPath, visualRelicType } from "./reliquary.assets.js";
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
  computeCompatDupGroups
} from "./reliquary.logic.js";
import {
  renderChosenLine,
  updateCounts,
  setRelicImageForStage,
  installRelicImgFallback
} from "./reliquary.ui.js";
import { getDom } from "./reliquary.dom.js";
import { gradientFromTheme, buildCategoryThemes } from "../scripts/ui/theme.js";
import { applyPaletteCssVars, COLOR_SWATCHES, RANDOM_SWATCH, CHARACTERS, characterColors } from "../scripts/ui/palette.js";
import { openEffectMenu, closeEffectMenu, openCurseMenu, closeCurseMenu } from "./reliquary.menus.js";

const dom = getDom();

applyPaletteCssVars();

const resultsEl = document.getElementById("results");
const resultsHeader = document.querySelector("#results .panel-header");
const validityBadge = document.getElementById("relicValidity");
const autoSortBtn = document.getElementById("autoSortBtn");

const MODES = { INDIVIDUAL: "individual", CHALICE: "chalice" };
let activeMode = MODES.INDIVIDUAL;

let rows = [];
let byId = new Map();
let rowsAll = [];
let byIdAll = new Map();
let curses = [];
let selectedClass = "";

let chaliceData = [];
let chalicesByCharacter = new Map();
let selectedChaliceId = "";

const chaliceSelections = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};

const chaliceCurses = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};

const chaliceCats = {
  standard: Array(9).fill(""),
  depth: Array(9).fill("")
};

const selectedEffects = ["", "", ""];
const selectedCats = ["", "", ""];
const curseBySlot = [null, null, null];
const curseCatBySlot = ["", "", ""];

let currentRandomColor = "Red";
let selectedColor = "Random";
const COLOR_CHOICES = ["Random", ...COLORS];

function isShowIllegalActive() {
  return !!(dom.showIllegalBtn && dom.showIllegalBtn.classList.contains("is-active"));
}

function setShowIllegalActive(active) {
  if (!dom.showIllegalBtn) return;
  dom.showIllegalBtn.classList.toggle("is-active", !!active);
  dom.showIllegalBtn.setAttribute("aria-pressed", String(!!active));

  if (dom.illegalPill) {
    dom.illegalPill.hidden = !active;
    dom.illegalPill.classList.toggle("is-active", !!active);
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

function colorChipLabel(value) {
  const v = value || "Random";
  if (v === "Random") return `Color: Random (${currentRandomColor})`;
  return `Color: ${v}`;
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

function syncModeUI() {
  const isChalice = isChaliceMode();

  if (dom.individualPanel) dom.individualPanel.hidden = isChalice;
  if (dom.chalicePanel) dom.chalicePanel.hidden = !isChalice;

  if (dom.modeBtnIndividual) dom.modeBtnIndividual.classList.toggle("is-active", !isChalice);
  if (dom.modeBtnChalice) dom.modeBtnChalice.classList.toggle("is-active", isChalice);

  if (dom.selType) {
    dom.selType.disabled = isChalice;
    if (dom.selType.parentElement) dom.selType.parentElement.classList.toggle("is-disabled", isChalice);
  }

  if (dom.showIllegalBtn) dom.showIllegalBtn.hidden = isChalice;
  if (dom.illegalPill) dom.illegalPill.hidden = isChalice || !isShowIllegalActive();
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

function effectiveRelicType(forFiltering = false) {
  // When showing illegal combinations, filtering should ignore relic type entirely
  if (forFiltering && isShowIllegalActive()) return "";
  return exclusiveRelicTypeFromSelections() || dom.selType.value;
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
            fallbackCopy(val);
            success();
          });
        } else {
          fallbackCopy(val);
          success();
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

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (err) {
    console.warn("Copy failed", err);
  }
  document.body.removeChild(ta);
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

  // Normalize to canonical ordering where possible, preserve unknowns at the end
  const normalized = names.map(n => n.toLowerCase());
  const selected = new Set(normalized);

  const ordered = [];
  for (const canonical of CHARACTERS) {
    if (selected.has(canonical.toLowerCase())) ordered.push(canonical);
  }

  const extras = names.filter(n => !ALL_CHARACTER_SET.has(n.toLowerCase()));
  const fullList = [...ordered, ...extras];

  const isAll = ALL_CHARACTER_SET.size > 0 && ordered.length === ALL_CHARACTER_SET.size && extras.length === 0;
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
    [dom.disclaimerBtn, dom.disclaimerPopover]
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
  if (selected.length < 1) {
    dom.detailsBody.innerHTML = "";
    return;
  }

  const blocks = [];

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
  if (roll.hasIssue) {
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

  if (roll.hasIssue && roll.sorted) {
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
  const hasOrderIssue = roll.hasIssue;
  const moveDeltaBySlot = roll.moveDeltaBySlot || [0, 0, 0];
  const positionIssue = computePositionIssue(cSelections[0], cSelections[1], cSelections[2]);
  const hasPositionIssue = positionIssue.hasIssue;

  if (autoSortBtn) {
    const showAutoSort = hasOrderIssue && selectedCount >= 2;
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

  const state = anySelected && (hasCompatIssue || hasRelicTypeIssue || hasOrderIssue || hasCurseMissing || hasPositionIssue) ? "Invalid" : "Valid";
  setValidityBadge(state, anySelected);

  const okBySlot = [false, false, false];

  for (let i = 0; i < cSelections.length; i++) {
    const row = cSelections[i];
    if (!row) continue;

    const compatBad = compatConflictIds.has(String(row.EffectID));
    const relicTypeBad = hasRelicTypeIssue && relicTypeIssue.ids.has(String(row.EffectID));
    const orderBad = hasOrderIssue && moveDeltaBySlot[i] !== 0;
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

  if (anySelected) {
    updateDetails(cSelections[0], cSelections[1], cSelections[2]);
  } else {
    setDetailsEmpty();
  }

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

function chaliceEffectCount(sideKey, effectId, ignoreSlotIdx = -1) {
  if (!effectId) return 0;
  const key = sideKey === "depth" ? "depth" : "standard";
  return chaliceSelections[key].reduce((count, cur, idx) => {
    if (idx === ignoreSlotIdx) return count;
    return count + (cur === String(effectId) ? 1 : 0);
  }, 0);
}

function canUseEffectOnSide(sideKey, slotIdx, effectId) {
  if (!effectId) return true;
  const count = chaliceEffectCount(sideKey, effectId, slotIdx);
  return count < 3;
}

function chaliceEligiblePool(sideKey) {
  const meta = sideInfo(sideKey);
  if (!rows.length) return [];
  return filterByClass(baseFilteredByRelicType(rows, meta.relicType));
}

function renderChaliceSlot(sideKey, idx) {
  const meta = sideInfo(sideKey);
  const effectId = chaliceSelections[meta.key][idx];
  const row = chaliceRow(effectId);
  const curseId = chaliceCurses[meta.key][idx];
  const curseRow = curseId ? chaliceRow(curseId) : null;
  const label = `Slot ${idx + 1}:`;
  const isEmpty = !row;

  if (isEmpty) {
    return `
      <li>
        <div class="chalice-slot chalice-slot--empty" data-side="${meta.key}" data-slot="${idx}">
          <div class="chalice-slot__top">
            <span class="chalice-slot__label">${label}</span>
            <div class="chalice-slot__actions">
              <button
                type="button"
                class="chalice-slot__btn chalice-slot__btn--empty"
                data-ch-slot="${meta.key}:${idx}"
                aria-label="Slot ${idx + 1}: Select Effect"
              >Select Effect</button>
            </div>
          </div>
        </div>
      </li>
    `;
  }

  const name = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  const cid = compatId(row) || "∅";
  const roll = row.RollOrder == null || String(row.RollOrder).trim() === "" ? "∅" : row.RollOrder;
  const metaLine = `CID ${cid} · Roll ${roll}`;
  const btnLabel = "Change";
  const requiresCurse = meta.key === "depth" && String(row?.CurseRequired ?? "0") === "1";
  const curseLabel = curseRow ? (curseRow.EffectDescription ?? `(Curse ${curseRow.EffectID})`) : "Select Curse";
  const curseMissing = requiresCurse && !curseRow;

  return `
    <li>
      <div class="chalice-slot" data-side="${meta.key}" data-slot="${idx}">
        <div class="chalice-slot__top">
          <span class="chalice-slot__label">${label}</span>
          <div class="chalice-slot__actions">
            <button type="button" class="chalice-slot__btn" data-ch-slot="${meta.key}:${idx}">${btnLabel}</button>
            ${row ? `<button type="button" class="icon-btn clear-btn" data-ch-clear="${meta.key}:${idx}" aria-label="Clear ${label}">×</button>` : ""}
          </div>
        </div>
        <div class="chalice-slot__body">
          <div class="chalice-slot__title">${escapeHtml(name)}</div>
          <div class="chalice-slot__meta">${metaLine}</div>
          ${requiresCurse ? `
            <div class="chalice-slot__curse ${curseMissing ? "is-missing" : ""}">
              <span class="chalice-slot__curse-label">Curse</span>
              <button type="button" class="chalice-slot__btn chalice-slot__btn--ghost" data-ch-curse="${meta.key}:${idx}">${escapeHtml(curseLabel)}</button>
              ${curseMissing ? `<span class="chalice-slot__curse-warning">Required</span>` : ""}
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

function generateCombosForSide(meta) {
  const slots = chaliceSelections[meta.key];
  const curseSlots = chaliceCurses[meta.key];
  const filledIdx = slots.map((id, idx) => ({ id, idx })).filter(x => x.id);

  const combos = [];
  const blocked = [];

  for (let a = 0; a < filledIdx.length; a++) {
    for (let b = a + 1; b < filledIdx.length; b++) {
      for (let c = b + 1; c < filledIdx.length; c++) {
        const triple = [filledIdx[a], filledIdx[b], filledIdx[c]];
        const ids = triple.map(t => t.id);
        const rowsCombo = ids.map(id => chaliceRow(id));
        if (rowsCombo.some(r => !r)) continue;

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
        if (meta.key === "depth") {
          for (const slot of triple) {
            const effectRow = chaliceRow(slot.id);
            const needsCurse = String(effectRow?.CurseRequired ?? "0") === "1";
            const curseId = curseSlots[slot.idx];
            const curseRow = curseId ? chaliceRow(curseId) : null;
            if (needsCurse && !curseRow) {
              invalid = true;
              break;
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
          curses: cursesForCombo
        });
      }
    }
  }

  const best = selectBestCombosSlots(combos);
  const usedSlots = new Set(best.flatMap(c => c.indices));
  const leftoverCount = slots.filter(Boolean).length - usedSlots.size;

  return {
    combos: best,
    blocked,
    leftoverSlots: leftoverCount,
    selectedCount: filledIdx.length,
    uniqueCount: filledIdx.length
  };
}

function relicCardHtml(combo, idx, sideLabel) {
  return `
    <div class="chalice-card">
      <div class="chalice-card__title-row">
        <span class="chalice-card__title">${sideLabel} Relic ${idx + 1}</span>
        <span class="chalice-card__meta">Roll order ready</span>
      </div>
      <ol class="chalice-card__effects">
        ${combo.rows.map(row => {
          const name = row.EffectDescription ?? `(Effect ${row.EffectID})`;
          const cid = compatId(row) || "∅";
          const roll = row.RollOrder == null || String(row.RollOrder).trim() === "" ? "∅" : row.RollOrder;
          const typeLabel = formatRelicTypeLabel(row.RelicType).label;
          return `
            <li>
              <div class="chalice-card__effect">
                <div class="chalice-card__effect-name">${escapeHtml(name)}</div>
                <div class="chalice-card__effect-meta">CID ${cid} · Roll ${roll} · ${escapeHtml(typeLabel)}</div>
              </div>
            </li>
          `;
        }).join("")}
      </ol>
    </div>
  `;
}

function renderResultList(targetEl, result, sideLabel) {
  if (!targetEl) return;
  if (!result.combos.length) {
    targetEl.innerHTML = `<div class="chalice-empty">No valid ${sideLabel.toLowerCase()} relics yet.</div>`;
    return;
  }
  targetEl.innerHTML = result.combos.map((combo, idx) => relicCardHtml(combo, idx, sideLabel)).join("");
}

function renderChaliceResults() {
  const standard = generateCombosForSide(sideInfo("standard"));
  const depth = generateCombosForSide(sideInfo("depth"));

  renderResultList(dom.chaliceResultsStandard, standard, "Standard");
  renderResultList(dom.chaliceResultsDepth, depth, "Depth of Night");

  const blockedCount = (standard.blocked?.length || 0) + (depth.blocked?.length || 0);
  const statusParts = [];

  statusParts.push(`Standard: ${standard.combos.length} built${standard.leftoverSlots ? `, ${standard.leftoverSlots} slots unused` : ""}`);
  statusParts.push(`Depth: ${depth.combos.length} built${depth.leftoverSlots ? `, ${depth.leftoverSlots} slots unused` : ""}`);
  if (blockedCount) statusParts.push(`${blockedCount} combos need a curse and were skipped.`);

  setChaliceStatus(statusParts.join(" | "));
}

function updateChaliceCounts() {
  const std = chaliceSelections.standard.filter(Boolean).length;
  const dep = chaliceSelections.depth.filter(Boolean).length;
  if (dom.chaliceStandardCount) dom.chaliceStandardCount.textContent = `${std} / 9 selected`;
  if (dom.chaliceDepthCount) dom.chaliceDepthCount.textContent = `${dep} / 9 selected`;
}

function renderChaliceUI() {
  renderChaliceLists();
  updateChaliceCounts();
  renderChaliceResults();
  renderChaliceColors();
}

function resetChaliceSelections() {
  chaliceSelections.standard.fill("");
  chaliceSelections.depth.fill("");
  chaliceCats.standard.fill("");
  chaliceCats.depth.fill("");
  chaliceCurses.standard.fill("");
  chaliceCurses.depth.fill("");
  selectedChaliceId = "";
  setChaliceStatus("");
  renderChalicePickers();
  renderChaliceUI();
}

function getSelectedChalice() {
  const list = filteredChalices();
  return list.find(c => String(c.chaliceID) === String(selectedChaliceId)) || list[0] || null;
}

function colorChip(color) {
  const swatch = COLOR_SWATCH[color] || "#4a4f59";
  return `<span class="chalice-color-chip" data-color="${color}" style="--chip-color:${swatch}" title="${color}">${color}</span>`;
}

function renderChaliceColors() {
  if (!dom.chaliceColors || !dom.chaliceStandardColors || !dom.chaliceDepthColors) return;
  const entry = getSelectedChalice();
  if (!entry) {
    dom.chaliceColors.hidden = true;
    dom.chaliceStandardColors.innerHTML = "";
    dom.chaliceDepthColors.innerHTML = "";
    return;
  }

  const stdColors = [entry.standard1, entry.standard2, entry.standard3].filter(Boolean);
  const depthColors = [entry.depth1, entry.depth2, entry.depth3].filter(Boolean);

  dom.chaliceStandardColors.innerHTML = stdColors.map(colorChip).join("");
  dom.chaliceDepthColors.innerHTML = depthColors.map(colorChip).join("");
  dom.chaliceColors.hidden = false;
}

function renderChalicePickers() {
  if (dom.chaliceSelect) {
    const list = filteredChalices();
    dom.chaliceSelect.innerHTML = list.map(c => `<option value="${c.chaliceID}">${c.chalicename}</option>`).join("");
    if (!selectedChaliceId && list.length) selectedChaliceId = list[0].chaliceID;
    const hasCurrent = list.some(c => String(c.chaliceID) === String(selectedChaliceId));
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
  selectedChaliceId = selectedChaliceId || (initialList[0]?.chaliceID || "");
}

// Meta visibility toggle removed; info is now provided via hover tooltips on the info icon.

function resetAllPreserveIllegal(desiredIllegal) {
  dom.selType.value = "";
  if (dom.selClass) dom.selClass.value = "";
  selectedColor = "Random";

  selectedClass = "";

  setShowIllegalActive(Boolean(desiredIllegal));

  for (let i = 0; i < selectedEffects.length; i++) setSelectedId(i, "");
  for (let i = 0; i < selectedCats.length; i++) selectedCats[i] = "";
  for (let i = 0; i < curseBySlot.length; i++) curseBySlot[i] = null;

  pickRandomColor();
  updateUI("illegal-change");
}

function resetClassFilter() {
  selectedClass = "";
  if (dom.selClass) {
    dom.selClass.value = "";
    populateClassOptions();
  }
}

function resetAll() {
  dom.selType.value = "";
  if (dom.selClass) dom.selClass.value = "";
  selectedColor = "Random";

  setShowIllegalActive(false);

  selectedClass = "";

  for (let i = 0; i < selectedEffects.length; i++) setSelectedId(i, "");
  for (let i = 0; i < selectedCats.length; i++) selectedCats[i] = "";
  for (let i = 0; i < curseBySlot.length; i++) curseBySlot[i] = null;

  pickRandomColor();
  updateUI("reset");
}

async function load() {
  const [relicRes, chaliceRes] = await Promise.all([
    fetch(DATA_URL, { cache: "no-store" }),
    fetch(CHALICE_DATA_URL, { cache: "no-store" }).catch(() => null)
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

  dom.relicImg.src = relicDefaultPath(visualRelicType(dom.selType.value));
  installRelicImgFallback(dom.relicImg, () => effectiveRelicType());

  installColorChipMenu();
  installUtilityPopoverButtons();

  // Default illegal toggle is off
  setShowIllegalActive(false);

  if (dom.modeBtnIndividual) dom.modeBtnIndividual.addEventListener("click", () => setMode(MODES.INDIVIDUAL));
  if (dom.modeBtnChalice) dom.modeBtnChalice.addEventListener("click", () => setMode(MODES.CHALICE));

  dom.selType.addEventListener("change", () => updateUI("type-change"));
  if (dom.selClass) {
    populateClassOptions();
    dom.selClass.addEventListener("change", evt => {
      selectedClass = evt.target.value || "";
      populateClassOptions();
      pruneChaliceSelectionsForClass();
      renderChalicePickers();
      updateUI("class-change");
      renderChaliceUI();
    });
  }
  if (dom.showIllegalBtn) {
    dom.showIllegalBtn.addEventListener("click", () => {
      const next = !isShowIllegalActive();
      setShowIllegalActive(next);
      resetAllPreserveIllegal(next);
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
      renderChaliceColors();
    });
  }

  renderChaliceUI();
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
