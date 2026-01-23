// Effect and Curse selection menus for Reliquary
// Pure DOM builders; state is provided by callers.

import { compatId, textColorFor } from "./reliquary.logic.js";
import { gradientFromTheme, buildCategoryThemes } from "../scripts/ui/theme.js";

// ---------- shared helpers ----------
function mobileOverlayPreferred() {
  if (typeof window === "undefined") return false;
  const sw = Math.round(Number(window.screen?.width || 0));
  const sh = Math.round(Number(window.screen?.height || 0));
  const vw = Math.round(Number(window.innerWidth || 0));
  const vh = Math.round(Number(window.innerHeight || 0));

  if (![sw, sh, vw, vh].every(Number.isFinite)) return false;

  const maxView = Math.max(vw, vh);
  const minView = Math.min(vw, vh);
  const maxScreen = Math.max(sw, sh);
  const minScreen = Math.min(sw, sh);

  // Hard overrides
  const forceMobile = (vw === 768 && vh === 1024) || (vw === 1024 && vh === 768);
  const forceDesktop = (vw === 1366 && vh === 768) || (vw === 768 && vh === 1366);

  // Treat compact phone viewports as mobile regardless of reported screen size.
  if (vw <= 480 && vh <= 950) return true;

  // Hard overrides
  if (forceMobile) return true;
  if (forceDesktop) return false;

  const desktopViewport = vw >= 1366 && vh >= 768;
  const desktopScreen = maxScreen >= 1366 && minScreen >= 768;

  // Treat as mobile when the viewport is tablet/phone-sized, unless it meets desktop thresholds.
  const smallViewport = minView <= 1024 && maxView <= 1280;
  const smallScreen = maxScreen < 1366 && minScreen < 1200;

  if (desktopViewport || desktopScreen) return false;
  return smallViewport || smallScreen;
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

function renderMenuList(listEl, rows, activeCategory, currentId, onPick, categoryThemes, isEffectMenu) {
  if (!listEl) return;
  const list = (() => {
    if (!activeCategory || activeCategory === "__all") return rows;
    if (activeCategory === "Uncategorized") return rows.filter(r => !effectCategoryForRow(r));
    return rows.filter(r => effectCategoryForRow(r) === activeCategory);
  })();

  if (!list.length) {
    listEl.innerHTML = `<div class="effect-menu__empty">No ${isEffectMenu ? "effects" : "curses"} match your filters.</div>`;
    return;
  }

  listEl.innerHTML = list.map(r => {
    const id = compatId(r);
    const title = r.EffectDescription ?? (isEffectMenu ? `(Effect ${id})` : `(Curse ${id})`);
    const cat = effectCategoryForRow(r) || "Uncategorized";
    const theme = categoryThemes.get(cat) || categoryThemes.get("__default");
    const curseRequired = isEffectMenu && String(r?.CurseRequired ?? "0") === "1";
    // Base category gradient.
    const baseBg = gradientFromTheme(theme);
    // For effect rows, put a strong right-side darkening overlay on top of the category gradient.
    const rowBg = isEffectMenu
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
    const isSelected = String(r.EffectID) === String(currentId);

    return `
      <button
        type="button"
        class="effect-menu__effect ${isSelected ? "is-current" : ""}"
        data-effect-id="${r.EffectID}"
        role="listitem"
        style="background:${rowBg}; border-color:${borderColor}; color:${txt};"
      >
        <div class="effect-menu__effect-main">
          <div class="effect-menu__effect-title">${title}</div>
        </div>
        <div class="effect-menu__effect-trailing">
          ${curseRequired ? `<span class="curse-indicator-wrap" aria-label="Curse Required" title="Curse Required"><span class="curse-indicator" aria-hidden="true"></span></span>` : ""}
          <span class="effect-menu__tag" style="border-color:${borderColor}; color:${txt}; background:${baseBg};">${cat}</span>
        </div>
      </button>
    `;
  }).join("");

  listEl.querySelectorAll("[data-effect-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-effect-id");
      if (!id) return;
      onPick(id);
    });
  });
}

// ---------- Effect Menu ----------
let effectMenu;
let effectMenuAnchorBtn = null;
let effectMenuCleanup = null;

function teardownEffectMenu() {
  if (effectMenuCleanup) effectMenuCleanup();
  effectMenuCleanup = null;
  if (effectMenu) effectMenu.remove();
  effectMenu = null;
  effectMenuAnchorBtn = null;
  unlockBodyScroll();
}

export function closeEffectMenu() {
  teardownEffectMenu();
}

export function isEffectMenuOverlayOpen() {
  return !!effectMenu && effectMenu.classList.contains("effect-overlay");
}

export function openEffectMenu({ slotIdx, anchorBtn, eligible, categories, currentId, selectedCategory, onPick }) {
  teardownEffectMenu();
  effectMenuAnchorBtn = anchorBtn;

  const catOptions = ["__all", ...(categories || [])];
  if ((eligible || []).some(r => !effectCategoryForRow(r)) && !catOptions.includes("Uncategorized")) {
    catOptions.push("Uncategorized");
  }

  let activeCategory = selectedCategory && catOptions.includes(selectedCategory) ? selectedCategory : "";
  let searchTerm = "";
  const categoryThemes = buildCategoryThemes(catOptions, "Effect");

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
      const cat = (effectCategoryForRow(r) || "").toLowerCase();
      return name.includes(term) || id.includes(term) || cat.includes(term);
    });
  };

  const applyFilters = () => {
    filteredEligible = filterEligible();
    countsByCat = computeCounts(filteredEligible);
  };

  const handlePick = (id) => {
    const catToPersist = (activeCategory === "__all" || activeCategory === "Uncategorized") ? "" : activeCategory;
    onPick(id, catToPersist);
    teardownEffectMenu();
  };

  const useMobileOverlay = mobileOverlayPreferred();

  if (useMobileOverlay) {
    // mobile overlay with category sheet toggle
    effectMenu = document.createElement("div");
    effectMenu.className = "effect-overlay";
    effectMenu.innerHTML = `
      <div class="effect-overlay__backdrop" data-overlay-dismiss></div>
      <div class="effect-overlay__panel" role="dialog" aria-modal="true" aria-label="Select Effect">
        <div class="effect-overlay__header">
          <div class="effect-overlay__title">Select Effect</div>
          <button type="button" class="effect-overlay__close" aria-label="Close" data-overlay-dismiss>×</button>
        </div>
        <div class="effect-overlay__controls">
          <div class="effect-overlay__control-row">
            <input type="search" class="effect-overlay__search" placeholder="Search effects by name, ID, or category" aria-label="Search effects" />
          </div>
          <div class="effect-overlay__control-row">
            <button type="button" class="effect-overlay__cat-toggle" aria-haspopup="dialog" aria-expanded="false">
              <span class="effect-overlay__cat-toggle-label">-- Select Category --</span>
            </button>
            <div class="effect-overlay__cat-sheet" hidden></div>
          </div>
        </div>
        <div class="effect-overlay__list" role="list"></div>
      </div>
    `;

    document.body.appendChild(effectMenu);
    lockBodyScroll();

    const listEl = effectMenu.querySelector(".effect-overlay__list");
    const searchEl = effectMenu.querySelector(".effect-overlay__search");
    const catToggleEl = effectMenu.querySelector(".effect-overlay__cat-toggle");
    const dismissEls = [...effectMenu.querySelectorAll("[data-overlay-dismiss]")];
    if (!listEl || !searchEl || !catToggleEl) {
      teardownEffectMenu();
      return;
    }

    let catDialogEl = null;

    const closeCatDialog = () => {
      if (catDialogEl) catDialogEl.remove();
      catDialogEl = null;
      if (catToggleEl) catToggleEl.setAttribute("aria-expanded", "false");
    };

    const renderList = () => {
      applyFilters();

      const visibleCats = catOptions.filter(cat => cat === "__all" || (countsByCat.get(cat) || 0) > 0);
      const effectiveCat = activeCategory || "__all";
      if (!visibleCats.includes(effectiveCat)) activeCategory = "";

      const list = (() => {
        const cat = activeCategory || "__all";
        if (cat === "__all") return filteredEligible;
        if (cat === "Uncategorized") return filteredEligible.filter(r => !effectCategoryForRow(r));
        return filteredEligible.filter(r => effectCategoryForRow(r) === cat);
      })();

      if (!list.length) {
        listEl.innerHTML = `<div class="effect-overlay__empty">No effects match your filters.</div>`;
        return;
      }

      listEl.innerHTML = list.map(r => {
        const id = compatId(r);
        const title = r.EffectDescription ?? `(Effect ${id})`;
        const cat = effectCategoryForRow(r) || "Uncategorized";
        const theme = categoryThemes.get(cat) || categoryThemes.get("__default");
        const base = theme?.base || "#6e9fd8";
        const rowBg = gradientFromTheme(theme);
        const borderColor = base;
        const borderGlow = "rgba(255, 255, 255, 0.08)";
        const txt = textColorFor(base || rowBg || "#2b2f38");
        const curseRequired = String(r?.CurseRequired ?? "0") === "1";
        const curseBadge = curseRequired
          ? '<span class="curse-indicator-wrap effect-overlay__row-curse" aria-label="Curse Required" title="Curse Required"><span class="curse-indicator" aria-hidden="true"></span></span>'
          : "";
        return `
          <button type="button" class="effect-overlay__row" data-effect-id="${r.EffectID}" role="listitem" style="border:2px solid ${borderColor}; box-shadow: 0 0 0 1px ${borderGlow};">
            <span class="effect-overlay__row-title">${title}${curseBadge}</span>
            <span class="effect-overlay__row-cat" style="background:${rowBg}; border-color:${borderColor}; color:${txt};">${cat}</span>
          </button>
        `;
      }).join("");

      listEl.querySelectorAll("[data-effect-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-effect-id");
          if (!id) return;
          handlePick(id);
        });
      });
    };

    const renderCatLabel = () => {
      const label = (() => {
        if (!activeCategory) return "-- Select Category --";
        if (activeCategory === "__all") return "All Effects";
        return activeCategory;
      })();
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

    const openCatDialog = () => {
      closeCatDialog();
      if (catToggleEl) catToggleEl.setAttribute("aria-expanded", "true");

      const visibleCats = catOptions.filter(cat => cat === "__all" || (countsByCat.get(cat) || 0) > 0);
      const effectiveCat = activeCategory || "__all";
      const pills = visibleCats.map(cat => ({ value: cat, label: cat === "__all" ? "All Effects" : cat }));

      catDialogEl = document.createElement("div");
      catDialogEl.className = "effect-cat-dialog";
      catDialogEl.innerHTML = `
        <div class="effect-cat-dialog__backdrop" data-cat-dialog-dismiss></div>
        <div class="effect-cat-dialog__panel" role="dialog" aria-modal="true" aria-label="Select Category">
          <header class="effect-cat-dialog__header">
            <button type="button" class="effect-cat-dialog__back" data-cat-dialog-dismiss aria-label="Back">←</button>
            <div class="effect-cat-dialog__title">Select Category</div>
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

      const themeFor = (val) => categoryThemes.get(val || "__all") || categoryThemes.get("__default");

      pillGrid.innerHTML = pills.map(p => {
        const theme = themeFor(p.value);
        const rowBg = gradientFromTheme(theme);
        const borderColor = theme?.border || "rgba(255, 255, 255, 0.18)";
        const txt = textColorFor(theme?.base || rowBg || "#2b2f38");
        const count = p.value === "__all" ? filteredEligible.length : (countsByCat.get(p.value) || 0);
        const isActive = (p.value || "") === (effectiveCat || "__all");
        return `
          <button type="button" class="effect-overlay__cat-pill ${isActive ? "is-active" : ""}" data-cat="${p.value}" style="background:${rowBg}; border-color:${borderColor}; color:${txt};">
            <span class="effect-overlay__cat-pill-label">${p.label}</span>
            <span class="effect-overlay__cat-pill-count">${count}</span>
          </button>
        `;
      }).join("");

      pillGrid.querySelectorAll("[data-cat]").forEach(btn => {
        btn.addEventListener("click", () => {
          activeCategory = btn.getAttribute("data-cat") || "__all";
          closeCatDialog();
          renderCatLabel();
          renderList();
        });
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

    dismissEls.forEach(el => el.addEventListener("click", () => teardownEffectMenu()));

    const handleKeydown = (evt) => { if (evt.key === "Escape") teardownEffectMenu(); };
    const handlePointerDown = (evt) => {
      if (!effectMenu) return;
      if (evt.target === effectMenu.querySelector(".effect-overlay__backdrop")) teardownEffectMenu();
    };
    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);

    effectMenuCleanup = () => {
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      closeCatDialog();
      unlockBodyScroll();
    };

    renderCatLabel();
    renderList();
    requestAnimationFrame(() => { searchEl.focus(); searchEl.select(); });
    return;
  }

  // desktop popover
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
  if (!catsEl || !effectsListEl) { teardownEffectMenu(); return; }

  const renderEffectListInternal = () => {
    applyFilters();
    renderMenuList(effectsListEl, filteredEligible, activeCategory || "__all", currentId, id => handlePick(id), categoryThemes, true);
  };

  const renderCategories = () => {
    applyFilters();
    const visibleCats = catOptions.filter(cat => cat === "__all" || (countsByCat.get(cat) || 0) > 0);
    if (!visibleCats.includes(activeCategory)) activeCategory = visibleCats[0] || "__all";

    catsEl.innerHTML = visibleCats.map(cat => {
      const label = cat === "__all" ? "All" : cat;
      const count = cat === "__all" ? filteredEligible.length : (countsByCat.get(cat) || 0);
      const isActive = cat === activeCategory;
      const theme = categoryThemes.get(cat) || categoryThemes.get("__default");
      const rowBg = gradientFromTheme(theme);
      const borderColor = theme?.border || "rgba(120, 30, 30, 0.8)";
      const txt = textColorFor(theme?.base || rowBg || "#2b2f38");
      return `
        <button type="button" class="effect-menu__cat ${isActive ? "is-active" : ""}" data-cat="${cat}" style="background:${rowBg}; border-color:${borderColor}; color:${txt};">
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

  const setActiveCategory = (catValue) => {
    activeCategory = catValue || "__all";
    renderCategories();
    renderEffectListInternal();
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
  const position = () => positionMenu(effectMenu, anchorBtn ? anchorBtn.getBoundingClientRect() : null);
  position();
  requestAnimationFrame(position);
  requestAnimationFrame(() => {
    const primarySearch = effectMenu.querySelector("[data-effect-search]");
    if (primarySearch) { primarySearch.focus(); primarySearch.select(); }
  });

  const handleKeydown = (evt) => { if (evt.key === "Escape") teardownEffectMenu(); };
  const handlePointerDown = (evt) => {
    if (!effectMenu) return;
    const target = evt.target;
    if (effectMenu.contains(target)) return;
    if (effectMenuAnchorBtn && effectMenuAnchorBtn.contains(target)) return;
    teardownEffectMenu();
  };
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  effectMenuCleanup = () => {
    document.removeEventListener("keydown", handleKeydown, true);
    document.removeEventListener("pointerdown", handlePointerDown, true);
  };
}

// ---------- Curse Menu ----------
let curseMenu;
let curseMenuAnchorBtn = null;
let curseMenuCleanup = null;

function teardownCurseMenu() {
  if (curseMenuCleanup) curseMenuCleanup();
  curseMenuCleanup = null;
  if (curseMenu) curseMenu.remove();
  curseMenu = null;
  curseMenuAnchorBtn = null;
  unlockBodyScroll();
}

export function closeCurseMenu() {
  teardownCurseMenu();
}

export function openCurseMenu({ slotIdx, anchorBtn, eligible, categories, currentId, selectedCategory, onPick }) {
  teardownCurseMenu();
  curseMenuAnchorBtn = anchorBtn;

  const catOptions = ["__all", ...(categories || [])];
  if ((eligible || []).some(r => !effectCategoryForRow(r)) && !catOptions.includes("Uncategorized")) {
    catOptions.push("Uncategorized");
  }

  let activeCategory = selectedCategory && catOptions.includes(selectedCategory) ? selectedCategory : "";
  let searchTerm = "";
  const categoryThemes = buildCategoryThemes(catOptions, "Curse");

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
      const cat = (effectCategoryForRow(r) || "").toLowerCase();
      return name.includes(term) || id.includes(term) || cat.includes(term);
    });
  };

  const applyFilters = () => {
    filteredEligible = filterEligible();
    countsByCat = computeCounts(filteredEligible);
  };

  const handlePick = (id) => {
    const catToPersist = (activeCategory === "__all" || activeCategory === "Uncategorized") ? "" : activeCategory;
    onPick(id, catToPersist);
    teardownCurseMenu();
  };

  const useMobileOverlay = mobileOverlayPreferred();

  if (useMobileOverlay) {
    curseMenu = document.createElement("div");
    curseMenu.className = "effect-overlay";
    curseMenu.innerHTML = `
      <div class="effect-overlay__backdrop" data-overlay-dismiss></div>
      <div class="effect-overlay__panel" role="dialog" aria-modal="true" aria-label="Select Curse">
        <div class="effect-overlay__header">
          <div class="effect-overlay__title">Select Curse</div>
          <button type="button" class="effect-overlay__close" aria-label="Close" data-overlay-dismiss>×</button>
        </div>
        <div class="effect-overlay__controls">
          <div class="effect-overlay__control-row">
            <input type="search" class="effect-overlay__search" placeholder="Search curses by name, ID, or category" aria-label="Search curses" />
          </div>
          <div class="effect-overlay__control-row">
            <button type="button" class="effect-overlay__cat-toggle" aria-haspopup="dialog" aria-expanded="false">
              <span class="effect-overlay__cat-toggle-label">-- Select Curse Category --</span>
            </button>
            <div class="effect-overlay__cat-sheet" hidden></div>
          </div>
        </div>
        <div class="effect-overlay__list" role="list"></div>
      </div>
    `;

    document.body.appendChild(curseMenu);
    lockBodyScroll();

    const listEl = curseMenu.querySelector(".effect-overlay__list");
    const searchEl = curseMenu.querySelector(".effect-overlay__search");
    const catToggleEl = curseMenu.querySelector(".effect-overlay__cat-toggle");
    const catSheetEl = curseMenu.querySelector(".effect-overlay__cat-sheet");
    const dismissEls = [...curseMenu.querySelectorAll("[data-overlay-dismiss]")];
    if (!listEl || !searchEl || !catToggleEl || !catSheetEl) { teardownCurseMenu(); return; }

    let catSheetOpen = false;

    const renderCatSheet = () => {
      const opts = catOptions.filter(cat => cat === "__all" || (countsByCat.get(cat) || 0) > 0);
      const pills = [{ value: "", label: "-- Select Curse Category --" }, ...opts.map(cat => ({ value: cat, label: cat === "__all" ? "All" : cat }))];
      const effectiveCat = activeCategory || "";
      if (effectiveCat && !pills.some(p => p.value === effectiveCat)) activeCategory = "";

      const themeFor = (val) => categoryThemes.get(val || "__all") || categoryThemes.get("__default");

      catSheetEl.innerHTML = pills.map(p => {
        const theme = themeFor(p.value);
        const rowBg = gradientFromTheme(theme);
        const borderColor = theme?.border || "rgba(255, 255, 255, 0.18)";
        const txt = textColorFor(theme?.base || rowBg || "#2b2f38");
        const isActive = (p.value || "") === (activeCategory || "");
        return `
          <button type="button" class="effect-overlay__cat-pill ${isActive ? "is-active" : ""}" data-cat="${p.value}" style="background:${rowBg}; border-color:${borderColor}; color:${txt};">
            <span class="effect-overlay__cat-pill-label">${p.label}</span>
          </button>
        `;
      }).join("");

      catSheetEl.querySelectorAll("[data-cat]").forEach(btn => {
        btn.addEventListener("click", () => {
          activeCategory = btn.getAttribute("data-cat") || "";
          catSheetOpen = false;
          catSheetEl.hidden = true;
          catToggleEl.setAttribute("aria-expanded", "false");
          renderList();
        });
      });

      const label = pills.find(p => (p.value || "") === (activeCategory || ""))?.label || "-- Select Curse Category --";
      catToggleEl.querySelector(".effect-overlay__cat-toggle-label").textContent = label;
    };

    const renderList = () => {
      applyFilters();
      renderCatSheet();

      const visibleCats = catOptions.filter(cat => cat === "__all" || (countsByCat.get(cat) || 0) > 0);
      const effectiveCat = activeCategory || "__all";
      if (!visibleCats.includes(effectiveCat)) activeCategory = "";

      const list = (() => {
        const cat = activeCategory || "__all";
        if (cat === "__all") return filteredEligible;
        if (cat === "Uncategorized") return filteredEligible.filter(r => !effectCategoryForRow(r));
        return filteredEligible.filter(r => effectCategoryForRow(r) === cat);
      })();

      if (!list.length) {
        listEl.innerHTML = `<div class="effect-overlay__empty">No curses match your filters.</div>`;
        return;
      }

      listEl.innerHTML = list.map(r => {
        const id = compatId(r);
        const title = r.EffectDescription ?? `(Curse ${id})`;
        const cat = effectCategoryForRow(r) || "Uncategorized";
        return `
          <button type="button" class="effect-overlay__row" data-effect-id="${r.EffectID}" role="listitem">
            <span class="effect-overlay__row-title">${title}</span>
            <span class="effect-overlay__row-cat">${cat}</span>
          </button>
        `;
      }).join("");

      listEl.querySelectorAll("[data-effect-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-effect-id");
          if (!id) return;
          handlePick(id);
        });
      });
    };

    searchEl.addEventListener("input", evt => {
      searchTerm = evt.target.value || "";
      renderList();
    });

    catToggleEl.addEventListener("click", () => {
      catSheetOpen = !catSheetOpen;
      catSheetEl.hidden = !catSheetOpen;
      catToggleEl.setAttribute("aria-expanded", catSheetOpen ? "true" : "false");
      if (catSheetOpen) renderCatSheet();
    });

    dismissEls.forEach(el => el.addEventListener("click", () => teardownCurseMenu()));

    const handleKeydown = (evt) => { if (evt.key === "Escape") teardownCurseMenu(); };
    const handlePointerDown = (evt) => { if (evt.target === curseMenu.querySelector(".effect-overlay__backdrop")) teardownCurseMenu(); };
    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);

    curseMenuCleanup = () => {
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      unlockBodyScroll();
    };

    renderList();
    requestAnimationFrame(() => { searchEl.focus(); searchEl.select(); });
    return;
  }

  // desktop popover
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
  if (!catsEl || !effectsListEl) { teardownCurseMenu(); return; }

  const renderEffectListInternal = () => {
    applyFilters();
    renderMenuList(effectsListEl, filteredEligible, activeCategory || "__all", currentId, id => handlePick(id), categoryThemes, false);
  };

  const renderCategories = () => {
    applyFilters();
    const visibleCats = catOptions.filter(cat => cat === "__all" || (countsByCat.get(cat) || 0) > 0);
    if (!visibleCats.includes(activeCategory)) activeCategory = visibleCats[0] || "__all";

    catsEl.innerHTML = visibleCats.map(cat => {
      const label = cat === "__all" ? "All" : cat;
      const count = cat === "__all" ? filteredEligible.length : (countsByCat.get(cat) || 0);
      const isActive = cat === activeCategory;
      const theme = categoryThemes.get(cat) || categoryThemes.get("__default");
      const rowBg = gradientFromTheme(theme);
      const borderColor = theme?.border || "rgba(255, 255, 255, 0.18)";
      const txt = textColorFor(theme?.base || rowBg || "#2b2f38");
      return `
        <button type="button" class="effect-menu__cat ${isActive ? "is-active" : ""}" data-cat="${cat}" style="background:${rowBg}; border-color:${borderColor}; color:${txt};">
          <span class="effect-menu__cat-label">${label}</span>
          <span class="effect-menu__cat-count">${count}</span>
        </button>
      `;
    }).join("");

    catsEl.querySelectorAll(".effect-menu__cat").forEach(btn => {
      const catValue = btn.getAttribute("data-cat") || "__all";
      btn.addEventListener("mouseenter", () => setActiveCategory(catValue));
      btn.addEventListener("click", () => setActiveCategory(catValue));
      btn.addEventListener("focus", () => setActiveCategory(catValue));
    });
  };

  const setActiveCategory = (catValue) => {
    activeCategory = catValue || "__all";
    renderCategories();
    renderEffectListInternal();
  };

  const renderAll = () => {
    applyFilters();
    renderCategories();
    renderEffectListInternal();
  };

  const syncSearchInputs = (value, sourceEl = null) => searchInputs.forEach(inp => { if (inp !== sourceEl) inp.value = value; });

  const handleSearchChange = (evt) => {
    const value = evt.target.value || "";
    searchTerm = value;
    syncSearchInputs(value, evt.target);
    renderAll();
  };

  searchInputs.forEach(inp => inp.addEventListener("input", handleSearchChange));

  renderAll();
  const position = () => positionMenu(curseMenu, anchorBtn ? anchorBtn.getBoundingClientRect() : null);
  position();
  requestAnimationFrame(position);
  requestAnimationFrame(() => {
    const primarySearch = curseMenu.querySelector("[data-curse-search]");
    if (primarySearch) { primarySearch.focus(); primarySearch.select(); }
  });

  const handleKeydown = (evt) => { if (evt.key === "Escape") teardownCurseMenu(); };
  const handlePointerDown = (evt) => {
    if (!curseMenu) return;
    const target = evt.target;
    if (curseMenu.contains(target)) return;
    if (curseMenuAnchorBtn && curseMenuAnchorBtn.contains(target)) return;
    teardownCurseMenu();
  };
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  curseMenuCleanup = () => {
    document.removeEventListener("keydown", handleKeydown, true);
    document.removeEventListener("pointerdown", handlePointerDown, true);
  };
}

