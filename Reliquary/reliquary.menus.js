// Effect and Curse selection menus for Reliquary
// Pure DOM builders; state is provided by callers.

import { compatId, categoryColorFor, textColorFor } from "./reliquary.logic.js";
import { gradientFromTheme, buildCategoryThemes } from "../scripts/ui/theme.js";

function effectCategoryForRow(row) {
  return (row?.EffectCategory ?? "").toString().trim();
}

function getRollValue(row) {
  const val = Number(row?.RollOrder);
  if (!Number.isFinite(val)) return Number.POSITIVE_INFINITY;
  return val;
}

function positionMenu(menuEl, anchorRect) {
  const { innerWidth, innerHeight } = window;
  const rect = menuEl.getBoundingClientRect();

  const rectIsZeroed = !anchorRect || (!anchorRect.width && !anchorRect.height && !anchorRect.top && !anchorRect.left);
  const anchorLeft = rectIsZeroed ? (innerWidth - rect.width) / 2 : anchorRect.left;
  const anchorTop = rectIsZeroed ? (innerHeight - rect.height) / 2 : anchorRect.top;
  const anchorBottom = rectIsZeroed ? anchorTop + rect.height : anchorRect.bottom;

  let left = anchorLeft;
  let top = anchorBottom + 4;

  if (left + rect.width > innerWidth - 8) left = innerWidth - rect.width - 8;
  if (left < 8) left = 8;

  if (top + rect.height > innerHeight - 8) top = anchorTop - rect.height - 4;
  if (top < 8) top = 8;

  menuEl.style.left = `${Math.round(left)}px`;
  menuEl.style.top = `${Math.round(top)}px`;
}

function renderMenuList(container, list, activeCategory, currentId, onPick, categoryThemes, showCurseBadge) {
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

  container.innerHTML = allList.map((r) => {
    const id = String(r.EffectID);
    const title = r.EffectDescription ?? `(Effect ${id})`;
    const cid = compatId(r) || "-";
    const roll = r?.RollOrder != null && String(r.RollOrder).trim() !== "" ? String(r.RollOrder) : "-";
    const requiresCurse = String(r?.CurseRequired ?? "0") === "1";
    const isCurrent = currentId && currentId === id;
    const catName = effectCategoryForRow(r) || "Uncategorized";
    const theme = categoryThemes?.get(catName) || categoryThemes?.get("__default");
    const rowBg = theme?.base || "rgba(40, 40, 44, 0.85)";
    const borderColor = theme?.border || "rgba(120, 30, 30, 0.8)";
    const textColor = textColorFor(rowBg);

    const curseIcon = requiresCurse && showCurseBadge ? `
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
            ${requiresCurse && showCurseBadge ? `<span class="effect-menu__tag">Curse Required</span>` : ""}
            ${isCurrent ? `<span class="effect-menu__tag effect-menu__tag--check">Selected</span>` : ""}
          </span>
        </span>
        ${requiresCurse && showCurseBadge ? `<span class="effect-menu__effect-trailing"><span class="curse-indicator-wrap">${curseIcon}</span></span>` : ""}
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

let effectMenu;
let effectMenuSlot = null;
let effectMenuAnchorBtn = null;
let effectMenuCleanup = null;

function teardownEffectMenu() {
  if (effectMenuCleanup) effectMenuCleanup();
  effectMenuCleanup = null;

  if (effectMenu) effectMenu.remove();
  effectMenu = null;
  effectMenuSlot = null;
  effectMenuAnchorBtn = null;
}

export function closeEffectMenu() {
  teardownEffectMenu();
}

export function openEffectMenu({ slotIdx, anchorBtn, eligible, categories, currentId, selectedCategory, onPick }) {
  teardownEffectMenu();

  const catOptions = ["__all", ...(categories || [])];
  const hasUncategorized = (eligible || []).some(r => !effectCategoryForRow(r));
  if (hasUncategorized && !catOptions.includes("Uncategorized")) {
    catOptions.push("Uncategorized");
  }

  let activeCategory = (selectedCategory && catOptions.includes(selectedCategory)) ? selectedCategory : (catOptions[0] || "__all");
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
    teardownEffectMenu();
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

  const renderEffectListWrapper = () => {
    renderEffectListInternal();
  };

  const renderEffectListInternal = () => {
    renderMenuList(effectsListEl, filteredEligible, activeCategory, currentId, (id) => {
      const activeCatToPersist = (activeCategory === "__all" || activeCategory === "Uncategorized") ? "" : activeCategory;
      onPick(id, activeCatToPersist);
      teardownEffectMenu();
    }, categoryThemes, true);
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
      // persist via onPick callback; no-op here
    }
    renderCategories();
    renderEffectListWrapper();
  };

  const renderAll = () => {
    filteredEligible = filterEligible();
    countsByCat = computeCounts(filteredEligible);
    renderCategories();
    renderEffectListWrapper();
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
  const position = () => positionMenu(effectMenu, anchorBtn ? anchorBtn.getBoundingClientRect() : null);
  position();
  requestAnimationFrame(position);

  requestAnimationFrame(() => {
    const primarySearch = effectMenu.querySelector("[data-effect-search]");
    if (primarySearch) {
      primarySearch.focus();
      primarySearch.select();
    }
  });

  const handleKeydown = (evt) => {
    if (evt.key === "Escape") teardownEffectMenu();
  };
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

// ----------------------- Curse Menu -----------------------

let curseMenu;
let curseMenuSlot = null;
let curseMenuAnchorBtn = null;
let curseMenuCleanup = null;

function teardownCurseMenu() {
  if (curseMenuCleanup) curseMenuCleanup();
  curseMenuCleanup = null;

  if (curseMenu) curseMenu.remove();
  curseMenu = null;
  curseMenuSlot = null;
  curseMenuAnchorBtn = null;
}

export function closeCurseMenu() {
  teardownCurseMenu();
}

export function openCurseMenu({ slotIdx, anchorBtn, eligible, categories, currentId, selectedCategory, onPick }) {
  teardownCurseMenu();

  const catOptions = ["__all", ...(categories || [])];
  const hasUncategorized = (eligible || []).some(r => !effectCategoryForRow(r));
  if (hasUncategorized && !catOptions.includes("Uncategorized")) catOptions.push("Uncategorized");

  let activeCategory = (selectedCategory && catOptions.includes(selectedCategory)) ? selectedCategory : (catOptions[0] || "__all");
  let searchTerm = "";

  const cursePalette = ["#4b2f70", "#6a3fa3", "#8d5fd3"]; // distinct purples
  const categoryThemes = (() => {
    const map = new Map();
    const baseTheme = categoryColorFor("Curse");
    map.set("__default", baseTheme);
    map.set("__all", baseTheme);
    map.set("Uncategorized", baseTheme);

    catOptions.forEach((cat, idx) => {
      if (map.has(cat)) return;
      const base = cursePalette[idx % cursePalette.length];
      map.set(cat, { ...baseTheme, base });
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
    teardownCurseMenu();
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

  const renderEffectListWrapper = () => {
    renderEffectListInternal();
  };

  const renderEffectListInternal = () => {
    renderMenuList(effectsListEl, filteredEligible, activeCategory, currentId, (id) => {
      const activeCatToPersist = (activeCategory === "__all" || activeCategory === "Uncategorized") ? "" : activeCategory;
      onPick(id, activeCatToPersist);
      teardownCurseMenu();
    }, categoryThemes, false);
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
      // persistence handled via onPick when user selects
    }
    renderCategories();
    renderEffectListWrapper();
  };

  const renderAll = () => {
    filteredEligible = filterEligible();
    countsByCat = computeCounts(filteredEligible);
    renderCategories();
    renderEffectListWrapper();
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
  const position = () => positionMenu(curseMenu, anchorBtn ? anchorBtn.getBoundingClientRect() : null);
  position();
  requestAnimationFrame(position);

  requestAnimationFrame(() => {
    const primarySearch = curseMenu.querySelector("[data-curse-search]");
    if (primarySearch) {
      primarySearch.focus();
      primarySearch.select();
    }
  });

  const handleKeydown = (evt) => {
    if (evt.key === "Escape") teardownCurseMenu();
  };
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
