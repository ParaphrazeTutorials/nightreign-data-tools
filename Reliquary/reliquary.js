import { DATA_URL, relicDefaultPath, visualRelicType } from "./reliquary.assets.js";
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
  SEQ_CATEGORY_BASES,
  ALL_THEME,
  baseFromSequence,
  textColorFor
} from "./reliquary.logic.js";
import {
  renderChosenLine,
  updateCounts,
  setRelicImageForStage,
  installRelicImgFallback
} from "./reliquary.ui.js";
import { getDom } from "./reliquary.dom.js";

const dom = getDom();

const resultsEl = document.getElementById("results");
const resultsHeader = document.querySelector("#results .panel-header");
const validityBadge = document.getElementById("relicValidity");
const autoSortBtn = document.getElementById("autoSortBtn");

let rows = [];
let byId = new Map();
let rowsAll = [];
let byIdAll = new Map();
let curses = [];

const selectedEffects = ["", "", ""];
const selectedCats = ["", "", ""];
const curseBySlot = [null, null, null];
const curseCatBySlot = ["", "", ""];

let currentRandomColor = "Red";
const COLOR_CHOICES = ["Random", ...COLORS];

const COLOR_SWATCH = {
  Red: "#e25b5b",
  Blue: "#5ba6f5",
  Yellow: "#f5c74c",
  Green: "#48b36a"
};
const RANDOM_SWATCH = "linear-gradient(135deg, #c94b4b, #3b82f6, #f2c94c, #2fa44a)";

const defaultCategoryTheme = categoryColorFor("");

function colorChipLabel(value) {
  const v = value || "Random";
  if (v === "Random") return `Color: Random (${currentRandomColor})`;
  return `Color: ${v}`;
}

function updateColorChipLabel() {
  if (!dom.relicColorChip) return;
  const selected = dom.selColor ? (dom.selColor.value || "Random") : "Random";
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
  if (!dom.relicColorControl || !dom.relicColorMenu || !dom.relicColorChip || !dom.selColor) return;

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
    dom.selColor.value = next;
    updateUI("color-change");
    closeColorMenu();
  });

  document.addEventListener("click", handleColorMenuOutsideClick);
  updateColorChipLabel();
}

function computeCompatDupGroups(rows) {
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
  const others = [getSelectedRow(1), getSelectedRow(2)].filter(Boolean);
  return others.every(r => baseFilteredByRelicType([r], type).length > 0);
}

function maybeAutoSetTypeFromEffect1(nextType) {
  if (!nextType) return;
  if (dom.selType.value !== "All") return;
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

function gradientFromTheme(theme) {
  if (!theme) return "rgba(40, 40, 44, 0.85)";
  const shades = theme.shades || [];
  if (shades.length >= 3) {
    return `linear-gradient(135deg, ${shades[0]} 0%, ${shades[1]} 50%, ${shades[2]} 100%)`;
  }
  return theme.base || "rgba(40, 40, 44, 0.85)";
}

function buildCategoryThemes(catList) {
  const map = new Map();
  const seq = SEQ_CATEGORY_BASES;
  let seqIdx = 0;

  const uncategorizedTheme = categoryColorFor("Uncategorized");

  map.set("__default", defaultCategoryTheme);
  map.set("__all", ALL_THEME);
  map.set("Uncategorized", uncategorizedTheme);

  (catList || []).forEach(cat => {
    if (map.has(cat)) return;

    const isCurse = /curse/i.test(cat);
    if (isCurse) {
      map.set(cat, categoryColorFor(cat));
      return;
    }

    const base = baseFromSequence(seqIdx);
    seqIdx += 1;
    map.set(cat, themeFromBase(base));
  });

  return map;
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

function openDetailsPopover(pop) {
  ensureDetailsPopoverDialog();
  if (!detailsPopoverRoot) return;

  const titleEl = pop.querySelector(".popover-title");
  const bodyEl = pop.querySelector(".popover-body");

  if (detailsPopoverTitle) detailsPopoverTitle.textContent = titleEl ? titleEl.textContent : "Details";
  if (detailsPopoverBody) detailsPopoverBody.innerHTML = bodyEl ? bodyEl.innerHTML : pop.innerHTML;

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
let effectMenu;
let effectMenuSlot = null;
let effectMenuAnchorBtn = null;
let effectMenuFlyout = null;
let curseMenu;
let curseMenuSlot = null;
let curseMenuAnchorBtn = null;

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

function closeCurseMenu() {
  if (curseMenu) curseMenu.remove();
  curseMenu = null;
  curseMenuSlot = null;
  curseMenuAnchorBtn = null;

  document.removeEventListener("keydown", handleCurseMenuKeydown, true);
  document.removeEventListener("pointerdown", handleCurseMenuPointerDown, true);
}

function handleCurseMenuKeydown(evt) {
  if (evt.key === "Escape") closeCurseMenu();
}

function handleCurseMenuPointerDown(evt) {
  if (!curseMenu) return;
  const target = evt.target;
  if (curseMenu.contains(target)) return;
  if (curseMenuAnchorBtn && curseMenuAnchorBtn.contains(target)) return;
  closeCurseMenu();
}

function openCurseMenu(slotIdx, anchorBtn) {
  closeCurseMenu();
  closeEffectMenu();

  const blockedCompat = computeBlockedCompatForCurse(slotIdx);
  const eligibleCurses = baseFilteredByRelicType(curses, dom.selType.value)
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
  const catOptions = ["__all", ...categories];
  const hasUncategorized = eligibleCurses.some(r => !effectCategoryForRow(r));
  if (hasUncategorized && !catOptions.includes("Uncategorized")) catOptions.push("Uncategorized");

  let activeCategory = (curseCatBySlot[slotIdx] && catOptions.includes(curseCatBySlot[slotIdx]))
    ? curseCatBySlot[slotIdx]
    : (catOptions[0] || "__all");
  let searchTerm = "";

  const cursePalette = ["#4b2f70", "#6a3fa3", "#8d5fd3"]; // three distinct purples
  const categoryThemes = (() => {
    const map = new Map();
    const baseTheme = themeFromBase("#7a4bc6");
    map.set("__default", baseTheme);
    map.set("__all", baseTheme);
    map.set("Uncategorized", baseTheme);

    catOptions.forEach((cat, idx) => {
      if (map.has(cat)) return;
      const base = cursePalette[idx % cursePalette.length];
      map.set(cat, themeFromBase(base));
    });

    return map;
  })();

  curseMenuSlot = slotIdx;
  curseMenuAnchorBtn = anchorBtn;

  curseMenu = document.createElement("div");
  curseMenu.className = "effect-menu effect-menu--wide";
  curseMenu.setAttribute("role", "dialog");
  curseMenu.innerHTML = `
    <div class="effect-menu__search-bar effect-menu__search-bar--shared">
      <input type="search" class="effect-menu__search-input" placeholder="Search curses..." aria-label="Search curses" data-curse-search="shared" />
    </div>
    <div class="effect-menu__layout">
      <div class="effect-menu__column effect-menu__column--cats" aria-label="Curse categories"></div>
      <div class="effect-menu__column effect-menu__column--effects">
        <div class="effect-menu__effects"></div>
      </div>
    </div>
  `;

  document.body.appendChild(curseMenu);

  const catsEl = curseMenu.querySelector(".effect-menu__column--cats");
  const effectsListEl = curseMenu.querySelector(".effect-menu__effects");
  const searchInputs = [...curseMenu.querySelectorAll("[data-curse-search]")];

  if (!catsEl || !effectsListEl) {
    closeCurseMenu();
    return;
  }

  const computeCounts = (list) => {
    const m = new Map();
    for (const r of list) {
      const c = effectCategoryForRow(r) || "Uncategorized";
      m.set(c, (m.get(c) || 0) + 1);
    }
    return m;
  };

  let filteredEligible = eligibleCurses.slice();
  let countsByCat = computeCounts(filteredEligible);

  const filterEligible = () => {
    const term = (searchTerm || "").trim().toLowerCase();
    if (!term) return eligibleCurses;
    return eligibleCurses.filter(r => {
      const name = (r.EffectDescription || "").toString().toLowerCase();
      const id = String(r.EffectID || "").toLowerCase();
      const cat = effectCategoryForRow(r).toLowerCase();
      return name.includes(term) || id.includes(term) || cat.includes(term);
    });
  };

  const renderEffectList = () => {
    renderEffectMenuEffects(effectsListEl, filteredEligible, activeCategory, currentId, (id) => {
      curseBySlot[slotIdx] = id;
      curseCatBySlot[slotIdx] = (activeCategory === "__all" || activeCategory === "Uncategorized") ? "" : activeCategory;
      closeCurseMenu();
      updateUI("curse-change");
    }, categoryThemes);
  };

  const renderCategories = () => {
    const visibleCats = catOptions.filter(cat => {
      if (cat === "__all") return true;
      return (countsByCat.get(cat) || 0) > 0;
    });

    if (!visibleCats.includes(activeCategory)) {
      activeCategory = visibleCats[0] || "__all";
    }

    catsEl.innerHTML = visibleCats.map(cat => {
      const label = cat === "__all" ? "All" : cat;
      const count = cat === "__all" ? filteredEligible.length : (countsByCat.get(cat) || 0);
      const isActive = cat === activeCategory;
      const theme = categoryThemes.get(cat) || categoryThemes.get("__default");
      const rowBg = gradientFromTheme(theme);
      const borderColor = theme?.border || "rgba(120, 30, 30, 0.8)";
      const textColor = textColorFor(theme?.base || rowBg || "#2b2f38");
      return `
        <button type="button" class="effect-menu__cat ${isActive ? "is-active" : ""}" data-cat="${cat}" style="background:${rowBg}; border-color:${borderColor}; color:${textColor};">
          <span class="effect-menu__cat-label">${label}</span>
          <span class="effect-menu__cat-count">${count}</span>
        </button>
      `;
    }).join("");

    catsEl.querySelectorAll(".effect-menu__cat").forEach(btn => {
      const catValue = btn.getAttribute("data-cat") || "__all";
      btn.addEventListener("mouseenter", () => setActiveCategory(catValue, false));
      btn.addEventListener("click", () => setActiveCategory(catValue, true));
      btn.addEventListener("focus", () => setActiveCategory(catValue, true));
    });
  };

  const setActiveCategory = (catValue, commit = false) => {
    activeCategory = catValue;
    if (commit) {
      curseCatBySlot[slotIdx] = (catValue === "__all" || catValue === "Uncategorized") ? "" : catValue;
    }

    renderCategories();
    renderEffectList();
  };

  const renderAll = () => {
    filteredEligible = filterEligible();
    countsByCat = computeCounts(filteredEligible);
    renderCategories();
    renderEffectList();
  };

  const syncSearchInputs = (value, sourceEl = null) => {
    searchInputs.forEach(inp => {
      if (inp === sourceEl) return;
      inp.value = value;
    });
  };

  const handleSearchChange = (evt) => {
    const value = evt.target.value || "";
    searchTerm = value;
    syncSearchInputs(value, evt.target);
    renderAll();
  };

  searchInputs.forEach(inp => {
    inp.addEventListener("input", handleSearchChange);
  });

  renderAll();

  positionEffectMenu(curseMenu, anchorBtn.getBoundingClientRect());

  requestAnimationFrame(() => {
    const primarySearch = curseMenu.querySelector("[data-curse-search]");
    if (primarySearch) {
      primarySearch.focus();
      primarySearch.select();
    }
  });

  document.addEventListener("keydown", handleCurseMenuKeydown, true);
  document.addEventListener("pointerdown", handleCurseMenuPointerDown, true);
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
  const eligibleCurses = baseFilteredByRelicType(curses, dom.selType.value)
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
      openCurseMenu(slotIdx, btn);
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
  const showIllegal = showIllegalOverride ?? !!dom.showIllegalEl.checked;

  if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx > 2) {
    return { eligible: [], filtered: [], categories: [], currentId: "" };
  }

  const type = dom.selType.value;
  const base = baseFilteredByRelicType(rows, type);
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

  const eligible = eligibleList(rows, type, blocked, taken, showIllegal);
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

function closeEffectMenu() {
  if (effectMenu) effectMenu.remove();
  if (effectMenuFlyout) effectMenuFlyout.remove();

  effectMenu = null;
  effectMenuSlot = null;
  effectMenuAnchorBtn = null;
  effectMenuFlyout = null;

  document.removeEventListener("keydown", handleEffectMenuKeydown, true);
  document.removeEventListener("pointerdown", handleEffectMenuPointerDown, true);
}

function handleEffectMenuKeydown(evt) {
  if (evt.key === "Escape") closeEffectMenu();
}

function handleEffectMenuPointerDown(evt) {
  if (!effectMenu) return;
  const target = evt.target;
  if (effectMenu.contains(target)) return;
  if (effectMenuFlyout && effectMenuFlyout.contains(target)) return;
  if (effectMenuAnchorBtn && effectMenuAnchorBtn.contains(target)) return;
  closeEffectMenu();
}

function effectCategoryForRow(row) {
  return (row?.EffectCategory ?? "").toString().trim();
}

function renderEffectMenuEffects(container, list, activeCategory, currentId, onPick, categoryThemes) {
  const allList = (() => {
    if (activeCategory === "__all") return list;
    if (activeCategory === "Uncategorized") {
      return list.filter(r => !effectCategoryForRow(r));
    }
    return list.filter(r => effectCategoryForRow(r) === activeCategory);
  })();

  if (!allList.length) {
    container.innerHTML = `
      <div class="effect-menu__empty">No effects available in this category.</div>
    `;
    return;
  }

  container.innerHTML = allList.map((r, idx) => {
    const id = String(r.EffectID);
    const title = r.EffectDescription ?? `(Effect ${id})`;
    const cid = compatId(r) || "-";
    const roll = r?.RollOrder != null && String(r.RollOrder).trim() !== "" ? String(r.RollOrder) : "-";
    const requiresCurse = String(r?.CurseRequired ?? "0") === "1";
    const isCurrent = currentId && currentId === id;
    const catName = effectCategoryForRow(r) || "Uncategorized";
    const theme = categoryThemes?.get(catName) || categoryThemes?.get("__default") || defaultCategoryTheme;
    const rowBg = theme?.base || "rgba(40, 40, 44, 0.85)";
    const borderColor = theme?.border || "rgba(120, 30, 30, 0.8)";
    const textColor = textColorFor(rowBg);

    const curseIcon = requiresCurse ? `
      <svg class="curse-indicator" viewBox="0 0 20 20" width="28" height="28" aria-label="Curse required" role="img">
        <defs>
          <radialGradient id="curseBadge" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="#e9ddff" stop-opacity="0.98"/>
            <stop offset="70%" stop-color="#b271ff" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#7a3fe6" stop-opacity="0.95"/>
          </radialGradient>
        </defs>
        <circle cx="10" cy="10" r="9" fill="url(#curseBadge)" stroke="#5219b3" stroke-width="0.9"/>
        <text x="10" y="13" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="800" fill="#ffffff">C</text>
      </svg>
    ` : "";

    return `
      <button type="button" class="effect-menu__effect ${isCurrent ? "is-current" : ""}" data-effect-id="${id}" style="background:${rowBg}; border-color:${borderColor}; color:${textColor};">
        <span class="effect-menu__effect-main">
          <span class="effect-menu__effect-title">${title}</span>
          <span class="effect-menu__effect-meta">CID ${cid} | Roll ${roll}</span>
          <span class="effect-menu__effect-tags">
            ${requiresCurse ? `<span class="effect-menu__tag">Curse Required</span>` : ""}
            ${isCurrent ? `<span class="effect-menu__tag effect-menu__tag--check">Selected</span>` : ""}
          </span>
        </span>
        ${requiresCurse ? `<span class="effect-menu__effect-trailing"><span class="curse-indicator-wrap">${curseIcon}</span></span>` : ""}
      </button>
    `;
  }).join("");

  container.querySelectorAll("[data-effect-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-effect-id");
      if (!id) return;
      onPick(id);
    });
  });
}

function positionEffectMenu(menuEl, anchorRect) {
  const { innerWidth, innerHeight } = window;
  const rect = menuEl.getBoundingClientRect();

  let left = anchorRect.left;
  let top = anchorRect.bottom + 4;

  if (left + rect.width > innerWidth - 8) left = innerWidth - rect.width - 8;
  if (left < 8) left = 8;

  if (top + rect.height > innerHeight - 8) top = anchorRect.top - rect.height - 4;
  if (top < 8) top = 8;

  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
}

// No-op placeholder retained for compatibility; flyout merged into single layout.
function positionEffectFlyout() {}

function openEffectMenu(slotIdx, anchorBtn, clickEvent = null) {
  const data = computeEffectDialogData(slotIdx);
  if (data.disabled) {
    if (dom.statusText && data.reason) dom.statusText.textContent = data.reason;
    return;
  }

  closeEffectMenu();

  const eligible = data.eligible || [];
  const categories = data.categories || [];

  const catOptions = ["__all", ...categories];
  const hasUncategorized = eligible.some(r => !effectCategoryForRow(r));
  if (hasUncategorized && !catOptions.includes("Uncategorized")) {
    catOptions.push("Uncategorized");
  }
  const preferredCat = selectedCats[slotIdx] && categories.includes(selectedCats[slotIdx]) ? selectedCats[slotIdx] : "";
  let activeCategory = preferredCat || catOptions[0] || "__all";
  let searchTerm = "";

  const categoryThemes = buildCategoryThemes(catOptions);

  effectMenuSlot = slotIdx;
  effectMenuAnchorBtn = anchorBtn;

  effectMenu = document.createElement("div");
  effectMenu.className = "effect-menu effect-menu--wide";
  effectMenu.setAttribute("role", "dialog");
  effectMenu.innerHTML = `
    <div class="effect-menu__search-bar effect-menu__search-bar--shared">
      <input type="search" class="effect-menu__search-input" placeholder="Search effects..." aria-label="Search effects" data-effect-search="shared" />
    </div>
    <div class="effect-menu__layout">
      <div class="effect-menu__column effect-menu__column--cats" aria-label="Effect categories"></div>
      <div class="effect-menu__column effect-menu__column--effects">
        <div class="effect-menu__effects"></div>
      </div>
    </div>
  `;

  document.body.appendChild(effectMenu);

  const catsEl = effectMenu.querySelector(".effect-menu__column--cats");
  const effectsListEl = effectMenu.querySelector(".effect-menu__effects");

  const searchInputs = [...effectMenu.querySelectorAll("[data-effect-search]")];

  if (!catsEl || !effectsListEl) {
    closeEffectMenu();
    return;
  }

  const computeCounts = (list) => {
    const m = new Map();
    for (const r of list) {
      const c = effectCategoryForRow(r) || "Uncategorized";
      m.set(c, (m.get(c) || 0) + 1);
    }
    return m;
  };

  let filteredEligible = eligible.slice();
  let countsByCat = computeCounts(filteredEligible);

  const filterEligible = () => {
    const term = (searchTerm || "").trim().toLowerCase();
    if (!term) return eligible;
    return eligible.filter(r => {
      const name = (r.EffectDescription || "").toString().toLowerCase();
      const id = String(r.EffectID || "").toLowerCase();
      const cat = effectCategoryForRow(r).toLowerCase();
      return name.includes(term) || id.includes(term) || cat.includes(term);
    });
  };

  const renderEffectList = (catBtnRect = null) => {
    renderEffectMenuEffects(effectsListEl, filteredEligible, activeCategory, data.currentId, (id) => {
      setSelectedId(slotIdx, id);
      selectedCats[slotIdx] = (activeCategory === "__all" || activeCategory === "Uncategorized") ? "" : activeCategory;
      curseBySlot[slotIdx] = null;

      if (slotIdx === 0) {
        const chosen = getRow(id);
        const nextType = autoRelicTypeFromEffect1(dom.selType.value, chosen);
        maybeAutoSetTypeFromEffect1(nextType);
      }

      closeEffectMenu();
      updateUI("effect-change");
    }, categoryThemes);

    requestAnimationFrame(() => {
      const menuRect = effectMenu.getBoundingClientRect();
      const activeCatBtn = effectMenu.querySelector(".effect-menu__cat.is-active");
      const anchorRect = catBtnRect || activeCatBtn?.getBoundingClientRect() || menuRect;
      positionEffectFlyout(anchorRect, menuRect);
    });
  };

  const renderCategories = () => {
    const visibleCats = catOptions.filter(cat => {
      if (cat === "__all") return true;
      return (countsByCat.get(cat) || 0) > 0;
    });

    if (!visibleCats.includes(activeCategory)) {
      activeCategory = visibleCats[0] || "__all";
    }

    catsEl.innerHTML = visibleCats.map(cat => {
      const label = cat === "__all" ? "All" : cat;
      const count = cat === "__all"
        ? filteredEligible.length
        : (countsByCat.get(cat) || 0);
      const isActive = cat === activeCategory;
      const theme = categoryThemes.get(cat) || categoryThemes.get("__default");
      const rowBg = gradientFromTheme(theme);
      const borderColor = theme?.border || "rgba(120, 30, 30, 0.8)";
      const textColor = textColorFor(theme?.base || rowBg || "#2b2f38");
      return `
        <button type="button" class="effect-menu__cat ${isActive ? "is-active" : ""}" data-cat="${cat}" style="background:${rowBg}; border-color:${borderColor}; color:${textColor};">
          <span class="effect-menu__cat-label">${label}</span>
          <span class="effect-menu__cat-count">${count}</span>
        </button>
      `;
    }).join("");

    catsEl.querySelectorAll(".effect-menu__cat").forEach(btn => {
      const catValue = btn.getAttribute("data-cat") || "__all";
      btn.addEventListener("mouseenter", () => {
        setActiveCategory(catValue, false, btn.getBoundingClientRect());
      });
      btn.addEventListener("click", () => setActiveCategory(catValue, true, btn.getBoundingClientRect()));
      btn.addEventListener("focus", () => {
        setActiveCategory(catValue, true, btn.getBoundingClientRect());
      });
    });
  };

  const setActiveCategory = (catValue, commit = false, catBtnRect = null) => {
    activeCategory = catValue;
    if (commit) {
      selectedCats[slotIdx] = (catValue === "__all" || catValue === "Uncategorized") ? "" : catValue;
    }

    renderCategories();
    renderEffectList(catBtnRect);
  };

  const renderAll = (catBtnRect = null) => {
    filteredEligible = filterEligible();
    countsByCat = computeCounts(filteredEligible);
    renderCategories();
    renderEffectList(catBtnRect);
  };

  const syncSearchInputs = (value, sourceEl = null) => {
    searchInputs.forEach(inp => {
      if (inp === sourceEl) return;
      inp.value = value;
    });
  };

  const handleSearchChange = (evt) => {
    const value = evt.target.value || "";
    searchTerm = value;
    syncSearchInputs(value, evt.target);
    renderAll();
  };

  searchInputs.forEach(inp => {
    inp.addEventListener("input", handleSearchChange);
  });

  renderAll();

  positionEffectMenu(effectMenu, anchorBtn.getBoundingClientRect());

  requestAnimationFrame(() => {
    const primarySearch = effectMenu.querySelector("[data-effect-search]");
    if (primarySearch) {
      primarySearch.focus();
      primarySearch.select();
    }
  });

  const activeCatBtn = effectMenu.querySelector(`.effect-menu__cat.is-active`) || effectMenu.querySelector(`.effect-menu__cat`);
  if (activeCatBtn) {
    positionEffectFlyout(activeCatBtn.getBoundingClientRect(), effectMenu.getBoundingClientRect());
  }
  document.addEventListener("keydown", handleEffectMenuKeydown, true);
  document.addEventListener("pointerdown", handleEffectMenuPointerDown, true);
}

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

    if (slotIdx === 0) {
      const chosen = getRow(v);
      const nextType = autoRelicTypeFromEffect1(dom.selType.value, chosen);
      maybeAutoSetTypeFromEffect1(nextType);
    }

    effectDialog.close("apply");
    updateUI("effect-change");
  };

  effectDialog.showModal();
}

function installEffectButtons() {
  const btns = document.querySelectorAll("[data-effect-slot]");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const slotIdx = Number.parseInt(btn.getAttribute("data-effect-slot") || "-1", 10);
      if (!Number.isFinite(slotIdx) || slotIdx < 0 || slotIdx > 2) return;
      if (btn.hasAttribute("disabled")) return;
      openEffectMenu(slotIdx, btn, event);
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

function updateDetails(a, b, c) {
  if (!dom.detailsBody) return;

  const selected = [a, b, c].filter(Boolean);
  if (selected.length < 1) {
    dom.detailsBody.innerHTML = "";
    return;
  }

  const blocks = [];

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

function updateUI(reason = "") {
  closeEffectMenu();
  closeColorMenu();

  if (dom.selColor.value === "Random") {
    const modifierReasons = new Set([
      "type-change",
      "illegal-change",
      "cat-change",
      "effect-change",
      "init"
    ]);
    if (modifierReasons.has(reason)) pickRandomColor();
  }

  const showIllegal = !!dom.showIllegalEl.checked;

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
    selectedType: dom.selType.value,
    selectedColor: dom.selColor.value,
    randomColor: currentRandomColor,
    stage
  });

  updateColorChipLabel();

  const anySelected = cSelections.some(Boolean);
  const dupGroups = computeCompatDupGroups(cSelections.filter(Boolean));
  const hasCompatIssue = dupGroups.length > 0;

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

  const state = anySelected && (hasCompatIssue || hasOrderIssue || hasCurseMissing || hasPositionIssue) ? "Invalid" : "Valid";
  setValidityBadge(state, anySelected);

  const okBySlot = [false, false, false];

  for (let i = 0; i < cSelections.length; i++) {
    const row = cSelections[i];
    if (!row) continue;

    const compatBad = compatConflictIds.has(String(row.EffectID));
    const orderBad = hasOrderIssue && moveDeltaBySlot[i] !== 0;
    const curseReq = String(row?.CurseRequired ?? "0") === "1";
    const curseMissing = curseReq && !curseBySlot[i];
    const positionBad = hasPositionIssue && positionIssue.badSlots.includes(i);

    if (!compatBad && !orderBad && !curseMissing && !positionBad) okBySlot[i] = true;
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

  const firstEmptyIdx = cSelections.findIndex(r => !r);
  const activeIndex = firstEmptyIdx === -1 ? 0 : firstEmptyIdx + 1;
  const filteredForActiveSlot = firstEmptyIdx === -1
    ? []
    : applyCategory(slotData[firstEmptyIdx]?.filtered || [], selectedCats[firstEmptyIdx]);
  const availableCount = firstEmptyIdx === -1 ? 0 : filteredForActiveSlot.length;
  updateCounts(dom, activeIndex, availableCount);
}

// Meta visibility toggle removed; info is now provided via hover tooltips on the info icon.

function resetAllPreserveIllegal(desiredIllegal) {
  dom.selType.value = "All";
  dom.selColor.value = "Random";

  dom.showIllegalEl.checked = Boolean(desiredIllegal);

  for (let i = 0; i < selectedEffects.length; i++) setSelectedId(i, "");
  for (let i = 0; i < selectedCats.length; i++) selectedCats[i] = "";
  for (let i = 0; i < curseBySlot.length; i++) curseBySlot[i] = null;

  pickRandomColor();
  updateUI("illegal-change");
}

function resetAll() {
  dom.selType.value = "All";
  dom.selColor.value = "Random";

  dom.showIllegalEl.checked = false;

  for (let i = 0; i < selectedEffects.length; i++) setSelectedId(i, "");
  for (let i = 0; i < selectedCats.length; i++) selectedCats[i] = "";
  for (let i = 0; i < curseBySlot.length; i++) curseBySlot[i] = null;

  pickRandomColor();
  updateUI("reset");
}

async function load() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);

  rowsAll = await res.json();
  byIdAll = new Map(rowsAll.map(r => [String(r.EffectID), r]));
  curses = rowsAll.filter(r => String(r?.Curse ?? "0") === "1");
  rows = rowsAll.filter(r => String(r?.Curse ?? "0") !== "1");
  byId = new Map(rows.map(r => [String(r.EffectID), r]));
  pickRandomColor();

  dom.relicImg.src = relicDefaultPath(visualRelicType(dom.selType.value));
  installRelicImgFallback(dom.relicImg, () => dom.selType.value);

  installColorChipMenu();

  dom.selType.addEventListener("change", () => updateUI("type-change"));
  dom.selColor.addEventListener("change", () => updateUI("color-change"));
  dom.showIllegalEl.addEventListener("change", () => resetAllPreserveIllegal(dom.showIllegalEl.checked));
  if (dom.startOverBtn) dom.startOverBtn.addEventListener("click", resetAll);

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
