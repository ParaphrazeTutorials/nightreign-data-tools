// Effect and Curse selection menus for Reliquary
// Pure DOM builders; state is provided by callers.
// ==================== Menus ====================

import { gradientFromTheme, buildCategoryThemes } from "../scripts/ui/theme.js";
import { breakpoints, mqAtMost } from "../scripts/breakpoints.js";

import { compatId } from "./modules/logic.js";
import { textColorFor } from "./modules/theme.js";

const MENU_COPY = {
  effect: {
    label: "Effect",
    labelPlural: "effects",
    title: "Select Effect",
    catTitle: "Select Category",
    overlayCatPlaceholder: "-- Select Category --",
    catAllLabel: "All Effects",
    emptyText: "No effects match your filters.",
    overlayEmptyText: "No effects match your filters.",
    searchPlaceholder: "Search effects...",
    overlaySearchPlaceholder: "Search effects by name, ID, or category",
    themeKind: "Effect",
    showCurseIndicator: true
  },
  curse: {
    label: "Curse",
    labelPlural: "curses",
    title: "Select Curse",
    catTitle: "Select Category",
    overlayCatPlaceholder: "-- Select Curse Category --",
    catAllLabel: "All Curses",
    emptyText: "No curses match your filters.",
    overlayEmptyText: "No curses match your filters.",
    searchPlaceholder: "Search curses...",
    overlaySearchPlaceholder: "Search curses by name, ID, or category",
    themeKind: "Curse",
    showCurseIndicator: false
  }
};

const menuState = {
  effect: { menu: null, anchorBtn: null, cleanup: null },
  curse: { menu: null, anchorBtn: null, cleanup: null }
};

// ---------- shared helpers ----------
function mobileOverlayPreferred() {
  if (typeof window === "undefined") return false;
  const vw = Math.round(Number(window.innerWidth || 0));

  // Honor the same breakpoint the CSS uses for the mobile stack; width-only.
  if (mqAtMost(breakpoints.mdMax).matches) return true;

  // Fallback when matchMedia is unavailable.
  return Number.isFinite(vw) && vw <= breakpoints.mdMax;
}

let bodyScrollLockState = null;
function lockBodyScroll() {
  if (bodyScrollLockState) return;
  const scrollTop = window.scrollY || 0;
  bodyScrollLockState = { scrollTop, previousOverflow: document.body.style.overflow || "" };
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollTop}px`;
  document.body.style.width = "100%";
}

function unlockBodyScroll() {
  if (!bodyScrollLockState) return;
  document.body.style.overflow = bodyScrollLockState.previousOverflow;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, bodyScrollLockState.scrollTop || 0);
  bodyScrollLockState = null;
}

function effectCategoryForRow(row) {
  return row?.EffectCategory || row?.Category || row?.Type || row?.EffectType || "";
}

function positionMenu(menuEl, anchorRect) {
  if (!menuEl) return;
  if (!anchorRect) {
    menuEl.style.top = "40px";
    menuEl.style.left = "40px";
    return;
  }
  const margin = 8;
  // Flyout uses position: fixed, so work in viewport coords (do not add page scroll).
  const top = anchorRect.bottom + margin;
  const left = Math.min(
    Math.max(anchorRect.left, margin),
    Math.max(margin, window.innerWidth - menuEl.offsetWidth - margin)
  );
  menuEl.style.top = `${top}px`;
  menuEl.style.left = `${left}px`;
}

function menuConfigFor(kind) {
  return MENU_COPY[kind] || MENU_COPY.effect;
}

function computeCounts(list) {
  const m = new Map();
  m.set("__all", list.length);
  for (const r of list || []) {
    const c = effectCategoryForRow(r) || "Uncategorized";
    m.set(c, (m.get(c) || 0) + 1);
  }
  return m;
}

function filterEligibleList(list, term) {
  const t = (term || "").trim().toLowerCase();
  if (!t) return list.slice();
  return list.filter(r => {
    const name = (r.EffectDescription || "").toString().toLowerCase();
    const id = String(r.EffectID || "").toLowerCase();
    const cat = (effectCategoryForRow(r) || "").toLowerCase();
    return name.includes(t) || id.includes(t) || cat.includes(t);
  });
}

function visibleCategories(catOptions, countsByCat) {
  return catOptions.filter(cat => cat === "__all" || (countsByCat.get(cat) || 0) > 0);
}

function categoryLabel(cat, config) {
  if (cat === "__all") return config.catAllLabel;
  return cat || "Uncategorized";
}

function teardownMenu(kind) {
  const state = menuState[kind];
  if (!state) return;
  if (state.cleanup) state.cleanup();
  state.cleanup = null;
  if (state.menu) state.menu.remove();
  state.menu = null;
  state.anchorBtn = null;
  unlockBodyScroll();
}

function createDesktopRow(row, theme, { config, isSelected }) {
  const baseBg = gradientFromTheme(theme);
  const rowBg = config.showCurseIndicator
    ? `linear-gradient(90deg,
        rgba(0,0,0,0) 0%,
        rgba(0,0,0,0) 35%,
        rgba(0,0,0,0.35) 55%,
        rgba(0,0,0,0.7) 65%,
        rgba(0,0,0,1) 75%,
        rgba(0,0,0,1) 100%), ${baseBg}`
    : baseBg;
  const borderColor = theme?.border || "rgba(255, 255, 255, 0.12)";
  const txt = textColorFor(theme?.base || rowBg || "#2b2f38");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `effect-menu__effect${isSelected ? " is-current" : ""}`;
  btn.dataset.effectId = row.EffectID;
  btn.setAttribute("role", "listitem");
  btn.style.background = rowBg;
  btn.style.borderColor = borderColor;
  btn.style.color = txt;

  const main = document.createElement("div");
  main.className = "effect-menu__effect-main";
  const title = document.createElement("div");
  title.className = "effect-menu__effect-title";
  title.textContent = row.EffectDescription ?? `(${config.label} ${compatId(row)})`;
  main.appendChild(title);

  const trailing = document.createElement("div");
  trailing.className = "effect-menu__effect-trailing";

  if (config.showCurseIndicator && String(row?.CurseRequired ?? "0") === "1") {
    const wrap = document.createElement("span");
    wrap.className = "curse-indicator-wrap";
    wrap.setAttribute("aria-label", "Curse Required");
    wrap.title = "Curse Required";
    const dot = document.createElement("span");
    dot.className = "curse-indicator";
    dot.setAttribute("aria-hidden", "true");
    wrap.appendChild(dot);
    trailing.appendChild(wrap);
  }

  const tag = document.createElement("span");
  tag.className = "effect-menu__tag";
  tag.style.borderColor = borderColor;
  tag.style.color = txt;
  tag.style.background = baseBg;
  tag.textContent = effectCategoryForRow(row) || "Uncategorized";
  trailing.appendChild(tag);

  const frag = document.createDocumentFragment();
  frag.appendChild(main);
  frag.appendChild(trailing);
  btn.appendChild(frag);
  return btn;
}

function createOverlayRow(row, theme, { config }) {
  const base = theme?.base || "#6e9fd8";
  const rowBg = gradientFromTheme(theme);
  const borderColor = theme?.border || base;
  const txt = textColorFor(base || rowBg || "#2b2f38");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "effect-overlay__row";
  btn.dataset.effectId = row.EffectID;
  btn.setAttribute("role", "listitem");
  btn.style.border = `2px solid ${borderColor}`;
  btn.style.boxShadow = "0 0 0 1px rgba(255, 255, 255, 0.08)";

  const title = document.createElement("span");
  title.className = "effect-overlay__row-title";
  title.textContent = row.EffectDescription ?? `(${config.label} ${compatId(row)})`;

  if (config.showCurseIndicator && String(row?.CurseRequired ?? "0") === "1") {
    const badgeWrap = document.createElement("span");
    badgeWrap.className = "curse-indicator-wrap effect-overlay__row-curse";
    badgeWrap.setAttribute("aria-label", "Curse Required");
    badgeWrap.title = "Curse Required";
    const badge = document.createElement("span");
    badge.className = "curse-indicator";
    badge.setAttribute("aria-hidden", "true");
    badgeWrap.appendChild(badge);
    title.appendChild(badgeWrap);
  }

  const cat = document.createElement("span");
  cat.className = "effect-overlay__row-cat";
  cat.style.background = rowBg;
  cat.style.borderColor = borderColor;
  cat.style.color = txt;
  cat.textContent = effectCategoryForRow(row) || "Uncategorized";

  const frag = document.createDocumentFragment();
  frag.appendChild(title);
  frag.appendChild(cat);
  btn.appendChild(frag);
  return btn;
}

function renderMenuRows(listEl, rows, {
  activeCategory,
  currentId,
  onPick,
  categoryThemes,
  config,
  variant
}) {
  if (!listEl) return;
  const list = (() => {
    if (!activeCategory || activeCategory === "__all") return rows;
    if (activeCategory === "Uncategorized") return rows.filter(r => !effectCategoryForRow(r));
    return rows.filter(r => effectCategoryForRow(r) === activeCategory);
  })();

  const emptyClass = variant === "overlay" ? "effect-overlay__empty" : "effect-menu__empty";
  const emptyText = variant === "overlay" ? config.overlayEmptyText : config.emptyText;

  if (!list.length) {
    const div = document.createElement("div");
    div.className = emptyClass;
    div.textContent = emptyText;
    listEl.replaceChildren(div);
    return;
  }

  const frag = document.createDocumentFragment();
  list.forEach(r => {
    const cat = effectCategoryForRow(r) || "Uncategorized";
    const theme = categoryThemes.get(cat) || categoryThemes.get("__default");
    const isSelected = String(r.EffectID) === String(currentId);
    const rowEl = variant === "overlay"
      ? createOverlayRow(r, theme, { config })
      : createDesktopRow(r, theme, { config, isSelected });
    rowEl.addEventListener("click", () => onPick(String(r.EffectID)));
    frag.appendChild(rowEl);
  });
  listEl.replaceChildren(frag);
}

function renderCategoryButtons(container, visibleCats, countsByCat, activeCategory, categoryThemes, config, onSelect, allowHover = true) {
  if (!container) return;
  const frag = document.createDocumentFragment();
  visibleCats.forEach(cat => {
    const label = categoryLabel(cat, config);
    const count = cat === "__all" ? (countsByCat.get("__all") || 0) : (countsByCat.get(cat) || 0);
    const isActive = cat === activeCategory;
    const theme = categoryThemes.get(cat) || categoryThemes.get("__default");
    const rowBg = gradientFromTheme(theme);
    const borderColor = theme?.border || "rgba(255, 255, 255, 0.12)";
    const txt = textColorFor(theme?.base || rowBg || "#2b2f38");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `effect-menu__cat${isActive ? " is-active" : ""}`;
    btn.dataset.cat = cat;
    btn.style.background = rowBg;
    btn.style.borderColor = borderColor;
    btn.style.color = txt;
    btn.innerHTML = `<span class="effect-menu__cat-label">${label}</span><span class="effect-menu__cat-count">${count}</span>`;
    if (allowHover) btn.addEventListener("mouseenter", () => onSelect(cat, false));
    btn.addEventListener("click", () => onSelect(cat, true));
    btn.addEventListener("focus", () => onSelect(cat, true));
    frag.appendChild(btn);
  });
  container.replaceChildren(frag);
}

function renderCategoryPills(container, pills, activeValue, categoryThemes, onSelect) {
  if (!container) return;
  const frag = document.createDocumentFragment();
  pills.forEach(p => {
    const theme = categoryThemes.get(p.value || "__all") || categoryThemes.get("__default");
    const rowBg = gradientFromTheme(theme);
    const borderColor = theme?.border || "rgba(255, 255, 255, 0.18)";
    const txt = textColorFor(theme?.base || rowBg || "#2b2f38");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `effect-overlay__cat-pill${(p.value || "") === (activeValue || "") ? " is-active" : ""}`;
    btn.dataset.cat = p.value;
    btn.style.background = rowBg;
    btn.style.borderColor = borderColor;
    btn.style.color = txt;

    const label = document.createElement("span");
    label.className = "effect-overlay__cat-pill-label";
    label.textContent = p.label;
    btn.appendChild(label);

    if (p.count != null) {
      const count = document.createElement("span");
      count.className = "effect-overlay__cat-pill-count";
      count.textContent = String(p.count);
      btn.appendChild(count);
    }

    btn.addEventListener("click", () => onSelect(p.value || "__all"));
    frag.appendChild(btn);
  });
  container.replaceChildren(frag);
}

function createOverlayShell(config) {
  const menuEl = document.createElement("div");
  menuEl.className = "effect-overlay";

  const backdrop = document.createElement("div");
  backdrop.className = "effect-overlay__backdrop";
  backdrop.dataset.overlayDismiss = "";

  const panel = document.createElement("div");
  panel.className = "effect-overlay__panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", config.title);

  const header = document.createElement("div");
  header.className = "effect-overlay__header";
  const title = document.createElement("div");
  title.className = "effect-overlay__title";
  title.textContent = config.title;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "effect-overlay__close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.dataset.overlayDismiss = "";
  closeBtn.textContent = "×";
  header.appendChild(title);
  header.appendChild(closeBtn);

  const controls = document.createElement("div");
  controls.className = "effect-overlay__controls";

  const searchRow = document.createElement("div");
  searchRow.className = "effect-overlay__control-row";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "effect-overlay__search";
  search.placeholder = config.overlaySearchPlaceholder;
  search.setAttribute("aria-label", `Search ${config.labelPlural}`);
  searchRow.appendChild(search);

  const catRow = document.createElement("div");
  catRow.className = "effect-overlay__control-row";
  const catToggle = document.createElement("button");
  catToggle.type = "button";
  catToggle.className = "effect-overlay__cat-toggle";
  catToggle.setAttribute("aria-haspopup", "dialog");
  catToggle.setAttribute("aria-expanded", "false");
  const catLabel = document.createElement("span");
  catLabel.className = "effect-overlay__cat-toggle-label";
  catLabel.textContent = config.overlayCatPlaceholder;
  catToggle.appendChild(catLabel);
  catRow.appendChild(catToggle);

  controls.appendChild(searchRow);
  controls.appendChild(catRow);

  const list = document.createElement("div");
  list.className = "effect-overlay__list";
  list.setAttribute("role", "list");

  const frag = document.createDocumentFragment();
  frag.appendChild(backdrop);
  frag.appendChild(panel);
  panel.appendChild(header);
  panel.appendChild(controls);
  panel.appendChild(list);
  menuEl.appendChild(frag);

  return {
    menuEl,
    listEl: list,
    searchEl: search,
    catToggleEl: catToggle,
    dismissEls: [backdrop, closeBtn]
  };
}

function createDesktopShell(config) {
  const menuEl = document.createElement("div");
  menuEl.className = "effect-menu effect-menu--wide";
  menuEl.setAttribute("role", "dialog");

  const searchBar = document.createElement("div");
  searchBar.className = "effect-menu__search-bar effect-menu__search-bar--shared";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "effect-menu__search-input";
  search.placeholder = config.searchPlaceholder;
  search.setAttribute("aria-label", `Search ${config.labelPlural}`);
  search.dataset.menuSearch = "shared";
  searchBar.appendChild(search);

  const layout = document.createElement("div");
  layout.className = "effect-menu__layout";

  const catsCol = document.createElement("div");
  catsCol.className = "effect-menu__column effect-menu__column--cats";
  catsCol.setAttribute("aria-label", `${config.label} categories`);

  const effectsCol = document.createElement("div");
  effectsCol.className = "effect-menu__column effect-menu__column--effects";
  const effects = document.createElement("div");
  effects.className = "effect-menu__effects";
  effectsCol.appendChild(effects);

  layout.appendChild(catsCol);
  layout.appendChild(effectsCol);

  const frag = document.createDocumentFragment();
  frag.appendChild(searchBar);
  frag.appendChild(layout);
  menuEl.appendChild(frag);

  return {
    menuEl,
    catsEl: catsCol,
    effectsListEl: effects,
    searchInputs: [search]
  };
}

function openMenu(kind, { anchorBtn, eligible, categories, currentId, selectedCategory, onPick }) {
  const config = menuConfigFor(kind);
  teardownMenu(kind);

  const catOptions = ["__all", ...(categories || [])];
  if ((eligible || []).some(r => !effectCategoryForRow(r)) && !catOptions.includes("Uncategorized")) {
    catOptions.push("Uncategorized");
  }

  let activeCategory = selectedCategory && catOptions.includes(selectedCategory) ? selectedCategory : "";
  let searchTerm = "";
  const categoryThemes = buildCategoryThemes(catOptions, config.themeKind);

  let filteredEligible = eligible.slice();
  let countsByCat = computeCounts(filteredEligible);

  const applyFilters = () => {
    filteredEligible = filterEligibleList(eligible, searchTerm);
    countsByCat = computeCounts(filteredEligible);
  };

  const handlePick = (id) => {
    const catToPersist = (activeCategory === "__all" || activeCategory === "Uncategorized") ? "" : activeCategory;
    onPick(id, catToPersist);
    teardownMenu(kind);
  };

  const useMobileOverlay = mobileOverlayPreferred();
  const state = menuState[kind];
  state.anchorBtn = anchorBtn;

  if (useMobileOverlay) {
    const { menuEl, listEl, searchEl, catToggleEl, dismissEls } = createOverlayShell(config);
    document.body.appendChild(menuEl);
    lockBodyScroll();

    let catDialogEl = null;

    const closeCatDialog = () => {
      if (catDialogEl) catDialogEl.remove();
      catDialogEl = null;
      catToggleEl.setAttribute("aria-expanded", "false");
    };

    const renderCatLabel = () => {
      const label = categoryLabel(activeCategory || "__all", config) || config.overlayCatPlaceholder;
      const theme = categoryThemes.get(activeCategory || "__all") || categoryThemes.get("__default");
      const bg = gradientFromTheme(theme);
      const border = theme?.border || "rgba(255, 255, 255, 0.18)";
      const text = textColorFor(theme?.base || bg || "#2b2f38");
      const labelEl = catToggleEl.querySelector(".effect-overlay__cat-toggle-label");
      if (labelEl) labelEl.textContent = label;
      catToggleEl.style.background = bg || "";
      catToggleEl.style.borderColor = border;
      catToggleEl.style.color = text;
    };

    const renderList = () => {
      applyFilters();

      const visibleCatsList = visibleCategories(catOptions, countsByCat);
      const effectiveCat = activeCategory || "__all";
      if (!visibleCatsList.includes(effectiveCat)) activeCategory = "";

      renderMenuRows(listEl, filteredEligible, {
        activeCategory: activeCategory || "__all",
        currentId,
        onPick: handlePick,
        categoryThemes,
        config,
        variant: "overlay"
      });
    };

    const openCatDialog = () => {
      closeCatDialog();
      catToggleEl.setAttribute("aria-expanded", "true");

      const visibleCatsList = visibleCategories(catOptions, countsByCat);
      const effectiveCat = activeCategory || "__all";
      const pills = visibleCatsList.map(cat => ({
        value: cat,
        label: categoryLabel(cat, config),
        count: cat === "__all" ? filteredEligible.length : (countsByCat.get(cat) || 0)
      }));

      catDialogEl = document.createElement("div");
      catDialogEl.className = "effect-cat-dialog";

      catDialogEl.innerHTML = `
        <div class="effect-cat-dialog__backdrop" data-cat-dialog-dismiss></div>
        <div class="effect-cat-dialog__panel" role="dialog" aria-modal="true" aria-label="${config.catTitle}">
          <header class="effect-cat-dialog__header">
            <button type="button" class="effect-cat-dialog__back" data-cat-dialog-dismiss aria-label="Back">←</button>
            <div class="effect-cat-dialog__title">${config.catTitle}</div>
            <button type="button" class="effect-cat-dialog__close" data-cat-dialog-dismiss aria-label="Close">×</button>
          </header>
          <div class="effect-cat-dialog__body">
            <div class="effect-cat-dialog__pill-grid"></div>
          </div>
        </div>
      `;

      const pillGrid = catDialogEl.querySelector(".effect-cat-dialog__pill-grid");
      if (!pillGrid) {
        closeCatDialog();
        return;
      }

      renderCategoryPills(pillGrid, pills, effectiveCat, categoryThemes, value => {
        activeCategory = value || "__all";
        closeCatDialog();
        renderCatLabel();
        renderList();
      });

      catDialogEl.querySelectorAll("[data-cat-dialog-dismiss]").forEach(btn => {
        btn.addEventListener("click", () => closeCatDialog());
      });

      document.body.appendChild(catDialogEl);
      requestAnimationFrame(() => catDialogEl.classList.add("is-visible"));
    };

    searchEl.addEventListener("input", evt => {
      searchTerm = evt.target.value || "";
      renderList();
    });

    catToggleEl.addEventListener("click", () => openCatDialog());

    dismissEls.forEach(el => el.addEventListener("click", () => teardownMenu(kind)));

    const handleKeydown = (evt) => { if (evt.key === "Escape") teardownMenu(kind); };
    const handlePointerDown = (evt) => {
      if (!state.menu) return;
      if (evt.target === menuEl.querySelector(".effect-overlay__backdrop")) teardownMenu(kind);
    };
    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);

    state.cleanup = () => {
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      closeCatDialog();
      unlockBodyScroll();
    };

    renderCatLabel();
    renderList();
    requestAnimationFrame(() => { searchEl.focus(); searchEl.select(); });

    state.menu = menuEl;
    return;
  }

  const { menuEl, catsEl, effectsListEl, searchInputs } = createDesktopShell(config);
  document.body.appendChild(menuEl);

  const renderEffectListInternal = () => {
    applyFilters();
    renderMenuRows(effectsListEl, filteredEligible, {
      activeCategory: activeCategory || "__all",
      currentId,
      onPick: handlePick,
      categoryThemes,
      config,
      variant: "desktop"
    });
  };

  const setActiveCategory = (catValue) => {
    activeCategory = catValue || "__all";
    renderCategories();
    renderEffectListInternal();
  };

  const renderCategories = () => {
    applyFilters();
    const visibleCatsList = visibleCategories(catOptions, countsByCat);
    if (!visibleCatsList.includes(activeCategory)) activeCategory = visibleCatsList[0] || "__all";

    renderCategoryButtons(catsEl, visibleCatsList, countsByCat, activeCategory, categoryThemes, config, setActiveCategory, true);
  };

  const renderAll = () => {
    applyFilters();
    renderCategories();
    renderEffectListInternal();
  };

  const syncSearchInputs = (value, sourceEl = null) => {
    searchInputs.forEach(inp => { if (inp !== sourceEl) inp.value = value; });
  };

  const handleSearchChange = (evt) => {
    const value = evt.target.value || "";
    searchTerm = value;
    syncSearchInputs(value, evt.target);
    renderAll();
  };

  searchInputs.forEach(inp => inp.addEventListener("input", handleSearchChange));

  renderAll();
  const position = () => positionMenu(menuEl, anchorBtn ? anchorBtn.getBoundingClientRect() : null);
  position();
  requestAnimationFrame(position);
  requestAnimationFrame(() => {
    const primarySearch = menuEl.querySelector("[data-menu-search]") || searchInputs[0];
    if (primarySearch) { primarySearch.focus(); primarySearch.select(); }
  });

  const handleKeydown = (evt) => { if (evt.key === "Escape") teardownMenu(kind); };
  const handlePointerDown = (evt) => {
    if (!menuEl) return;
    const target = evt.target;
    if (menuEl.contains(target)) return;
    if (state.anchorBtn && state.anchorBtn.contains(target)) return;
    teardownMenu(kind);
  };
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  state.cleanup = () => {
    document.removeEventListener("keydown", handleKeydown, true);
    document.removeEventListener("pointerdown", handlePointerDown, true);
  };

  state.menu = menuEl;
}

/**
 * Close the currently open effect menu (desktop or mobile overlay).
 */
export function closeEffectMenu() {
  teardownMenu("effect");
}

/**
 * Whether the effect menu overlay is active (mobile overlay state).
 * @returns {boolean} True when the overlay menu is present.
 */
export function isEffectMenuOverlayOpen() {
  const menu = menuState.effect.menu;
  return !!menu && menu.classList.contains("effect-overlay");
}

/**
 * Open the effect selection menu.
 * @param {object} options Menu configuration including rows, anchor, and callbacks.
 */
export function openEffectMenu(options) {
  openMenu("effect", options);
}

/**
 * Close the currently open curse menu.
 */
export function closeCurseMenu() {
  teardownMenu("curse");
}

/**
 * Open the curse selection menu.
 * @param {object} options Menu configuration including rows, anchor, and callbacks.
 */
export function openCurseMenu(options) {
  openMenu("curse", options);
}

