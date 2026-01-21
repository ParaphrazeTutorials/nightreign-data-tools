import { textColorFor } from "../Reliquary/reliquary.logic.js";
import { openEffectMenu, closeEffectMenu, isEffectMenuOverlayOpen } from "../Reliquary/reliquary.menus.js";
import { gradientFromTheme, buildCategoryThemeMap } from "../scripts/ui/theme.js";
import { applyPaletteCssVars, CHARACTER_COLORS, CHIP_COLORS } from "../scripts/ui/palette.js";

applyPaletteCssVars();

// The Lexicon — table + tile theater mode + module picker
// Session-only: sort + text zoom. No persistence across refresh.

const DATASETS = {
  reliquary: new URL("../Data/reliquary.json", window.location.href).toString(),
  // placeholders (not wired yet)
  menagerie: "",
  armory: "",
  grimoire: ""
};

// Optional column definitions per module. Add entries as needed.
const COLUMN_DEFINITIONS = {
  reliquary: {
    EffectID: { description: "A unique identifier that represents an individual effect.", source: "AttachEffectParam.csv" },
    OverrideBaseEffectID: { description: "Used for calculating Roll Order, this an ID that works in conjunction with the EffectID.", source: "AttachEffectParam.csv" },
    RawRollOrder: { description: "A concatenation of OverrideBaseEffectID and EffectID to determine the truly unique order of effect rolls.", source: "Calculated (See Query)" },
    CompatibilityID: { description: "Determines which effects share compatibility with one another, excluding them from rolling on the same relic at the same time.", source: "AttachEffectParam.csv" },
    EffectCategory: { description: "Created by manually matching up the EffectID with the categories used on the in-game Relic Effect filters.", source: "Compatibility.csv" },
    EffectDescription: { description: "Contains the in-game description of the effect.", source: "AttachEffectName.csv" },
    EffectExtendedDescription: { description: "Contains a community written version of the effect with more detail.", source: "AttachEffectName.csv" },
    ChanceWeight_110: { description: "Standard Relic Effects Only. Used for calculating the likilihood of rolling the third roll of a large relic, second roll of a medium relic, and only roll of a small relic.", source: "AttachEffectTableParam.csv" },
    ChanceWeight_210: { description: "Standard Relic Effects Only. Used for calculating the likilihood of rolling the second roll of a large relic, or the first roll of a medium relic.", source: "AttachEffectTableParam.csv" },
    ChanceWeight_310: { description: "Standard Relic Effects Only. Used for calculating the likilihood of rolling the first roll of a large relic.", source: "AttachEffectTableParam.csv" },
    ChanceWeight_2000000: { description: "Depth of Night Effects Only. Used for calculating the likilihood of rolling an effect that requires a curse effect.", source: "AttachEffectTableParam.csv" },
    ChanceWeight_2200000: { description: "Depth of Night Effects Only. Used for calculating the likilihood of rolling an effect that does not require a curse effect.", source: "AttachEffectTableParam.csv" },
    ChanceWeight_3000000: { description: "Depth of Night Curses Only. Used for calculating the likilihood of rolling a curse effect.", source: "AttachEffectTableParam.csv" },
    StatusIconID: { description: "The unique identifier for the Status Icon of the effect.", source: "AttachEffectParam.csv" },
    CurseRequired: { description: "Indicates if the effect requires a curse.", source: "Calculated (See Query)" },
    Curse: { description: "Indicates if the effect is a curse.", source: "Calculated (See Query)" },
    RelicType: { description: "Indicates if the effect can be found on Standard, Depth of Night, or both types of relics.", source: "Calculated (See Query)" },
    RollOrder: { description: "Determines the order that effects must be presented on a relic to be valid for online play.", source: "Calculated (See Query)" }
  }
};

// Optional display labels per module. Map raw column name -> display label.
const COLUMN_DISPLAY_NAMES = {
  reliquary: {
    EffectID: "EffectID",
    OverrideBaseEffectID: "OverrideID",
    RawRollOrder: "RawRollOrder",
    CompatibilityID: "CompatibilityID",
    EffectCategory: "Category",
    EffectDescription: "Description",
    EffectExtendedDescription: "Extended Description",
    ChanceWeight_110: "Weight 110",
    ChanceWeight_210: "Weight 210",
    ChanceWeight_310: "Weight 310",
    ChanceWeight_2000000: "Weight 2000000",
    ChanceWeight_2200000: "Weight 2200000",
    ChanceWeight_3000000: "Weight 3000000",
    StatusIconID: "StatusIconID",
    CurseRequired: "CurseRequired",
    Curse: "Curse",
    RelicType: "Type",
    RollOrder: "RollOrder"
  }
};

const dom = {
  // layout
  moduleButtons: Array.from(document.querySelectorAll(".lexicon-module-card[data-module]")),
  datasetToggle: document.getElementById("lexDatasetToggle"),
  datasetPanel: document.getElementById("lexDatasetPanel"),

  // detail + table
  meta: document.getElementById("lexiconMeta"),
  searchInput: document.getElementById("lexSearchInput"),
  table: document.getElementById("lexTable"),
  tableHead: document.getElementById("lexTableHead"),
  tableBody: document.getElementById("lexTableBody"),
  tableWrap: document.querySelector(".lexicon-table-wrap"),
  effectSelectBtn: document.getElementById("lexEffectSelect"),
  detail: document.getElementById("lexDetail"),
  detailContent: document.getElementById("lexDetailContent"),

  // downloads button + modal
  exportButton: document.getElementById("lexExportButton"),
  downloadsButton: document.getElementById("lexDownloadsButton"),
  modalRoot: document.getElementById("lexModal"),
  modalBody: document.getElementById("lexModalBody"),
  modalClose: document.querySelector(".lex-modal__close"),
  modalBackdrop: document.querySelector("#lexModal .lex-modal__backdrop"),

  // column info modal
  infoModalRoot: document.getElementById("lexInfoModal"),
  infoModalBody: document.getElementById("lexInfoModalBody"),
  infoModalTitle: document.getElementById("lexInfoTitle"),
  infoModalClose: document.querySelector("#lexInfoModal .lex-modal__close"),
  infoModalBackdrop: document.querySelector("#lexInfoModal .lex-modal__backdrop"),

  // insights
  insights: document.getElementById("lexiconInsights")
};

const state = {
  // dataset
  module: "reliquary",
  dataUrl: DATASETS.reliquary,

  // table
  rawRows: [],
  columns: [],
  sortKey: "",
  sortDir: 0, // 0 none, 1 asc, -1 desc
  typeByCol: new Map(), // col -> "number" | "string"
  filters: new Map(),
  searchTerm: "",

  // styling helpers
  categoryThemes: new Map(),

  // selection
  selectedEffectId: "",
  userPickedEffect: false,

  // downloads
  downloadsManifest: null,
  downloadsLoading: false
};

// Single floating filter input appended to body (portal) so it never overlaps headers when hidden
let floatingFilter = null;
let floatingFilterCol = null;
let floatingAnchorTh = null;
let floatingAnchorBtn = null;

function hideFloatingFilter() {
  if (!floatingFilter) return;
  floatingFilter.hidden = true;
  floatingFilter.style.display = "none";
  floatingFilter.setAttribute("aria-hidden", "true");
  if (floatingAnchorTh) floatingAnchorTh.classList.remove("is-filtering");
  if (floatingAnchorBtn) floatingAnchorBtn.classList.remove("is-open");
  floatingAnchorTh = null;
  floatingAnchorBtn = null;
  floatingFilterCol = null;
}

function ensureFloatingFilter() {
  if (floatingFilter) return floatingFilter;

  floatingFilter = document.createElement("input");
  floatingFilter.type = "text";
  floatingFilter.className = "lexicon-floating-filter";
  floatingFilter.autocomplete = "off";
  floatingFilter.spellcheck = false;
  floatingFilter.inputMode = "search";
  floatingFilter.placeholder = "Filter column...";
  floatingFilter.hidden = true;
  floatingFilter.style.display = "none";
  floatingFilter.setAttribute("aria-hidden", "true");

  floatingFilter.addEventListener("input", () => {
    const value = floatingFilter.value || "";
    const trimmed = value.trim();
    if (!floatingFilterCol) return;

    if (trimmed === "") {
      state.filters.delete(floatingFilterCol);
      hideFloatingFilter();
      render();
      return;
    }

    state.filters.set(floatingFilterCol, value);
    render();
  });

  floatingFilter.addEventListener("blur", () => {
    if (floatingFilterCol && (floatingFilter.value || "").trim() === "") {
      state.filters.delete(floatingFilterCol);
    }
    hideFloatingFilter();
  });

  window.addEventListener("scroll", hideFloatingFilter, true);
  window.addEventListener("resize", hideFloatingFilter);

  document.body.appendChild(floatingFilter);
  return floatingFilter;
}

function openFloatingFilter(col, th, btn) {
  ensureFloatingFilter();

  const rect = btn.getBoundingClientRect();
  floatingFilterCol = col;
  floatingAnchorTh = th;
  floatingAnchorBtn = btn;

  const current = state.filters.get(col) || "";
  floatingFilter.value = current;
  const label = getDisplayLabel(col);
  floatingFilter.placeholder = `Filter ${label}...`;

  floatingFilter.hidden = false;
  floatingFilter.removeAttribute("aria-hidden");
  floatingFilter.style.display = "inline-block";

  const top = rect.bottom + window.scrollY + 4;
  const left = rect.left + window.scrollX;
  const minW = Math.max(rect.width + 60, 150);
  floatingFilter.style.top = `${top}px`;
  floatingFilter.style.left = `${left}px`;
  floatingFilter.style.minWidth = `${minW}px`;

  th.classList.add("is-filtering");
  btn.classList.add("is-open");

  floatingFilter.focus();
  floatingFilter.select();
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `\"${s.replaceAll('"', '""')}\"`;
  return s;
}

function toCsv(columns, rows) {
  const lines = [];
  lines.push(columns.map(csvEscape).join(","));
  for (const r of rows) lines.push(columns.map(c => csvEscape(r?.[c])).join(","));
  return lines.join("\n");
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function exportCurrentTable() {
  const columns = state.columns;
  if (!columns.length) return;

  const rows = getCurrentViewRows();
  const header = columns.map(col => getDisplayLabel(col));

  const lines = [];
  lines.push(header.map(csvEscape).join(","));
  for (const r of rows) lines.push(columns.map(c => csvEscape(r?.[c])).join(","));

  const date = new Date().toISOString().split("T")[0];
  const moduleKey = state.module || "export";
  const filename = `lexicon-${moduleKey}-${date}.csv`;

  downloadText(filename, lines.join("\n"), "text/csv;charset=utf-8");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function categoryThemeFor(value) {
  if (state.module !== "reliquary") return null;
  const key = (value ?? "").toString().trim() || "Uncategorized";
  return state.categoryThemes.get(key) || state.categoryThemes.get("__default") || null;
}

function categoryCellHtml(rawValue, isSorted = false) {
  const label = (rawValue == null || String(rawValue).trim() === "") ? "Uncategorized" : String(rawValue);
  const theme = categoryThemeFor(label);
  const bg = gradientFromTheme(theme);
  const base = theme?.base || "#2b2f38";
  const borderColor = theme?.border || "rgba(255, 255, 255, 0.14)";
  const textColor = textColorFor(base);

  const cls = isSorted ? "lex-cat-cell lexicon-td--sorted" : "lex-cat-cell";

  return `<td class="${cls}"><span class="lex-cat-pill" style="--lex-cat-base:${base}; background:${bg}; border-color:${borderColor}; color:${textColor};"><span class="lex-cat-pill__label">${escapeHtml(label)}</span></span></td>`;
}

function inferColumns(rows) {
  const cols = [];
  const seen = new Set();

  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    for (const k of Object.keys(r)) {
      if (seen.has(k)) continue;
      seen.add(k);
      cols.push(k);
    }
  }
  return cols;
}

function getDisplayLabel(col) {
  const mod = state.module || "";
  const map = COLUMN_DISPLAY_NAMES[mod] || {};
  return map[col] || col;
}

const PRIORITY_COLUMNS = [
  "EffectID",
  "RollOrder",
  "EffectDescription",
  "EffectExtendedDescription",
  "EffectCategory",
  "Characters",
  "RelicType",
  "SelfStacking",
  "ChanceWeight_110",
  "ChanceWeight_210",
  "ChanceWeight_310",
  "ChanceWeight_2000000",
  "ChanceWeight_2200000",
  "ChanceWeight_3000000"
];

function reorderColumns(columns) {
  const priLower = new Set(PRIORITY_COLUMNS.map(c => c.toLowerCase()));

  const prioritized = [];
  for (const target of PRIORITY_COLUMNS) {
    const found = columns.find(c => c.toLowerCase() === target.toLowerCase());
    if (found) prioritized.push(found);
  }

  const rest = columns.filter(c => !priLower.has(c.toLowerCase()));
  return [...prioritized, ...rest];
}

function inferTypeForColumn(rows, col) {
  let sawValue = false;
  for (const r of rows) {
    const v = r?.[col];
    if (v == null || v === "") continue;
    sawValue = true;

    const n = Number(v);
    if (!Number.isFinite(n)) return "string";
  }
  return sawValue ? "number" : "string";
}

function computeTypeMap(rows, columns) {
  state.typeByCol.clear();
  for (const c of columns) state.typeByCol.set(c, inferTypeForColumn(rows, c));
}

function getComparable(col, value) {
  if (value == null || value === "") return null;
  const t = state.typeByCol.get(col) || "string";

  if (t === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return String(value).toLowerCase();
}

function stableSort(rows, col, dir) {
  if (!col || !dir) return rows;

  const t = state.typeByCol.get(col) || "string";
  const decorated = rows.map((r, idx) => ({ r, idx }));

  decorated.sort((a, b) => {
    const av = getComparable(col, a.r?.[col]);
    const bv = getComparable(col, b.r?.[col]);

    // Nulls last
    const aNull = av == null;
    const bNull = bv == null;
    if (aNull && bNull) return a.idx - b.idx;
    if (aNull) return 1;
    if (bNull) return -1;

    let cmp = 0;
    if (t === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));

    if (cmp !== 0) return cmp * dir;
    return a.idx - b.idx;
  });

  return decorated.map(d => d.r);
}

function noop() {}

function getManifestUrl(moduleKey) {
  const key = String(moduleKey || "").toLowerCase();
  if (!key) return "";
  return new URL(`../downloads/${key}/manifest.json`, window.location.href).toString();
}

async function loadDownloadsManifest(moduleKey) {
  state.downloadsManifest = null;
  state.downloadsLoading = true;
  renderDownloadsModal();
  const url = getManifestUrl(moduleKey);
  if (!url) {
    state.downloadsLoading = false;
    renderDownloadsModal();
    return;
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load manifest (${res.status})`);
    const manifest = await res.json();
    state.downloadsManifest = manifest || null;
  } catch (err) {
    console.error(err);
    state.downloadsManifest = null;
  }
  state.downloadsLoading = false;
  renderDownloadsModal();
}

function getDownloadFilename(item) {
  if (!item) return "";
  if (item.filename) return String(item.filename);
  const href = item.href || "";
  if (!href) return item.label || "";
  try {
    const url = new URL(href, window.location.href);
    const parts = (url.pathname || "").split("/").filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  } catch (err) {
    const parts = String(href).split("/").filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return item.label || "";
}

function renderDownloadsSection(title, items) {
  if (!items || items.length === 0) {
    return `
      <div class="lex-downloads__section">
        <div class="lex-downloads__section-title">${escapeHtml(title)}</div>
        <div class="lex-downloads__empty">Unavailable</div>
      </div>
    `;
  }

  const list = items.map(item => {
    const label = item.title || item.label || item.id || "Download";
    const href = item.href || "#";
    const fmt = item.format ? String(item.format).toUpperCase() : "";
    const size = item.size ? String(item.size) : "";
    const meta = [fmt, size].filter(Boolean).join(" • ");
    const desc = item.description || "";
    return `
      <a class="lex-downloads__item" href="${escapeHtml(href)}" download>
        <div class="lex-downloads__item-row">
          <span class="lex-downloads__item-title">${escapeHtml(label)}</span>
          ${meta ? `<span class="lex-downloads__item-meta">${escapeHtml(meta)}</span>` : ""}
        </div>
        <div class="lex-downloads__item-row lex-downloads__item-row--desc">
          <span class="lex-downloads__item-desc">${escapeHtml(desc)}</span>
          <span class="lex-downloads__item-download" aria-hidden="true"></span>
        </div>
      </a>
    `;
  }).join("");

  return `
    <div class="lex-downloads__section">
      <div class="lex-downloads__section-title">${escapeHtml(title)}</div>
      <div class="lex-downloads__list">${list}</div>
    </div>
  `;
}

function renderDownloadsModal() {
  if (!dom.modalBody) return;

  if (state.downloadsLoading) {
    dom.modalBody.innerHTML = `<div class="lex-downloads__empty">Loading downloads…</div>`;
    return;
  }

  const m = state.downloadsManifest;
  if (!m) {
    dom.modalBody.innerHTML = `<div class="lex-downloads__empty">No downloads available for this module.</div>`;
    return;
  }

  const sections = [
    renderDownloadsSection("Table Data Export", m.tableExports),
    renderDownloadsSection("Raw Game Files", m.rawGameFiles),
    renderDownloadsSection("Supplemental Files", m.supplementalFiles)
  ];

  dom.modalBody.innerHTML = sections.join("");
}

/* -------------------------
   Downloads modal
------------------------- */

function closeDownloadsModal() {
  if (!dom.modalRoot) return;
  dom.modalRoot.classList.remove("is-open");
  dom.modalRoot.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* -------------------------
   Column info modal
------------------------- */

function getColumnDefinition(col) {
  const mod = state.module || "";
  const map = COLUMN_DEFINITIONS[mod] || {};
  const entry = map[col];
  if (!entry) return { description: "", source: "" };
  if (typeof entry === "string") return { description: entry, source: "" };
  const description = entry.description || "";
  const source = entry.source || "";
  return { description, source };
}

function closeInfoModal() {
  if (!dom.infoModalRoot) return;
  dom.infoModalRoot.classList.remove("is-open");
  dom.infoModalRoot.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function openInfoModal(col) {
  if (!dom.infoModalRoot || !col) return;

  const def = getColumnDefinition(col);
  const type = state.typeByCol.get(col) || "string";
  const defHtml = def.description ? escapeHtml(def.description) : "No description provided.";
  const sourceHtml = def.source ? escapeHtml(def.source) : "Not specified.";
  const label = getDisplayLabel(col);
  const rawNameHtml = escapeHtml(col);

  if (dom.infoModalTitle) dom.infoModalTitle.textContent = label;

  if (dom.infoModalBody) {
    const typeLabel = escapeHtml(type);
    dom.infoModalBody.innerHTML = `
      <div class="effect-info-grid lex-info-grid" role="list">
        <div class="effect-info-section" role="listitem">
          <div class="effect-info-label">Data Type</div>
          <div class="effect-info-divider" aria-hidden="true"></div>
          <div class="effect-info-value">
            <span class="effect-chip effect-chip--datatype">${typeLabel}</span>
          </div>
        </div>

        <div class="effect-info-section" role="listitem">
          <div class="effect-info-label">Raw Column Name</div>
          <div class="effect-info-divider" aria-hidden="true"></div>
          <div class="effect-info-value">
            <span class="lex-info-plain">${rawNameHtml}</span>
          </div>
        </div>

        <div class="effect-info-section" role="listitem">
          <div class="effect-info-label">Data Source</div>
          <div class="effect-info-divider" aria-hidden="true"></div>
          <div class="effect-info-value">
            <span class="lex-info-plain">${sourceHtml}</span>
          </div>
        </div>

        <div class="effect-info-section" role="listitem">
          <div class="effect-info-label">Description</div>
          <div class="effect-info-divider" aria-hidden="true"></div>
          <div class="effect-info-value">
            <p class="lex-info-description">${defHtml}</p>
          </div>
        </div>
      </div>
    `;
  }

  dom.infoModalRoot.classList.add("is-open");
  dom.infoModalRoot.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  dom.infoModalClose?.focus();
}

function bindInfoModal() {
  dom.infoModalClose?.addEventListener("click", closeInfoModal);
  dom.infoModalBackdrop?.addEventListener("click", closeInfoModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dom.infoModalRoot?.classList.contains("is-open")) {
      closeInfoModal();
    }
  });
}

function openDownloadsModal() {
  if (!dom.modalRoot) return;
  dom.modalRoot.classList.add("is-open");
  dom.modalRoot.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderDownloadsModal();

  if (!state.downloadsManifest && !state.downloadsLoading) {
    loadDownloadsManifest(state.module).catch(console.error);
  }

  dom.modalClose?.focus();
}

function bindDownloadsModal() {
  if (dom.downloadsButton) {
    dom.downloadsButton.addEventListener("click", openDownloadsModal);
  }

  dom.modalClose?.addEventListener("click", closeDownloadsModal);
  dom.modalBackdrop?.addEventListener("click", closeDownloadsModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dom.modalRoot?.classList.contains("is-open")) {
      closeDownloadsModal();
    }
  });
}

function bindExportButton() {
  if (!dom.exportButton) return;
  dom.exportButton.addEventListener("click", exportCurrentTable);
}

function thHtml(key) {
  const isActive = state.sortKey === key && state.sortDir !== 0;
  const glyph = !isActive ? "" : (state.sortDir === 1 ? "▲" : "▼");
  const label = getDisplayLabel(key);
  const isLongText = key.toLowerCase().includes("description");
  const thClass = ["lexicon-th", isActive ? "is-sorted" : "", isLongText ? "lexicon-th--description" : ""].filter(Boolean).join(" ");

  return `
    <th scope="col" class="${thClass}"
        role="button" tabindex="0"
        data-col="${escapeHtml(key)}"
        title="${escapeHtml(key)}"
        aria-sort="${isActive ? (state.sortDir === 1 ? "ascending" : "descending") : "none"}">
      <div class="lexicon-th__inner">
        <span class="lexicon-th__label">${escapeHtml(label)}</span>
        <div class="lexicon-th__controls">
          <button class="lexicon-col-info" type="button" title="Column info" aria-label="Column info">i</button>
          <button class="lexicon-col-filter" type="button" title="Filter ${escapeHtml(label)}" aria-label="Filter ${escapeHtml(label)}" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7z"/></svg>
          </button>
          <span class="lexicon-th__glyph" aria-hidden="true">${glyph}</span>
        </div>
      </div>
    </th>
  `;
}

function tdHtml(key, value) {
  const v = value == null ? "" : String(value);
  const isEffectCategory = state.module === "reliquary" && key === "EffectCategory";

  if (isEffectCategory) {
    const isSortedCol = state.sortKey === key && state.sortDir !== 0;
    return categoryCellHtml(v, isSortedCol);
  }

  const isLongText = key.toLowerCase().includes("description");
  const isIdish = key.toLowerCase().endsWith("id") || /^[0-9]+$/.test(v);
  const isNumeric = state.typeByCol.get(key) === "number";
  const isSortedCol = state.sortKey === key && state.sortDir !== 0;

  const cls = [
    isLongText ? "lexicon-cell--text lexicon-cell--description" : "",
    isIdish ? "lexicon-cell--mono" : "",
    isNumeric ? "lexicon-cell--number" : "",
    isSortedCol ? "lexicon-td--sorted" : ""
  ].filter(Boolean).join(" ");

  const content = v ? escapeHtml(v) : `<span class="lexicon-empty">∅</span>`;
  return `<td class="${cls}" title="${escapeHtml(v)}">${content}</td>`;
}

function renderHead(columns) {
  if (!dom.tableHead) return;
  ensureFloatingFilter();
  dom.tableHead.innerHTML = `<tr>${columns.map(thHtml).join("")}</tr>`;

  dom.tableHead.querySelectorAll("th[data-col]").forEach(th => {
    const col = th.getAttribute("data-col") || "";
    const activate = () => toggleSort(col);

    th.addEventListener("click", activate);
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });

    const infoBtn = th.querySelector(".lexicon-col-info");
    if (infoBtn) {
      infoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openInfoModal(col);
      });
    }

    const btn = th.querySelector(".lexicon-col-filter");
    if (!btn) return;

    const val = state.filters.get(col) || "";
    const active = val.trim() !== "";

    btn.classList.toggle("is-active", active);
    th.classList.toggle("has-filter", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isSame = floatingFilterCol === col && floatingAnchorBtn === btn && !floatingFilter?.hidden;
      hideFloatingFilter();
      if (!isSame) {
        openFloatingFilter(col, th, btn);
      }
    });
  });
}

function renderBody(columns, rows) {
  if (!dom.tableBody) return;
  const out = [];
  for (const r of rows) out.push(`<tr>${columns.map(k => tdHtml(k, r?.[k])).join("")}</tr>`);
  dom.tableBody.innerHTML = out.join("");
}

function updateFrozenOffsets() {
  const table = dom.tableHead?.closest("table") || dom.table;
  if (!table || !dom.tableHead) return;

  const firstTh = dom.tableHead.querySelector("th:nth-child(1)");
  const secondTh = dom.tableHead.querySelector("th:nth-child(2)");

  const buffer = 2; // minimal gap to align with body while preventing overlap
  const col1 = firstTh ? firstTh.getBoundingClientRect().width : 0;
  const col2 = secondTh ? secondTh.getBoundingClientRect().width : 0;

  table.style.setProperty("--lex-freeze-col1", `${col1 + buffer}px`);
  table.style.setProperty("--lex-freeze-col2", `${col1 + col2 + buffer}px`);
}

function rowMatchesSearch(row, term) {
  if (!term) return true;
  const needle = term.toLowerCase();
  for (const col of state.columns) {
    const v = row?.[col];
    if (v == null) continue;
    const s = String(v).toLowerCase();
    if (s.includes(needle)) return true;
  }
  return false;
}

function getFilteredRows() {
  const term = state.searchTerm.trim();
  const activeFilters = Array.from(state.filters.entries()).filter(([, v]) => v && v.trim() !== "");

  if (!term && activeFilters.length === 0) return state.rawRows;

  return state.rawRows.filter(r => {
    if (term && !rowMatchesSearch(r, term)) return false;

    for (const [col, value] of activeFilters) {
      const needle = value.trim().toLowerCase();
      const cell = r?.[col];
      if (needle === "") continue;
      if (cell == null) return false;

      const cellStr = String(cell).toLowerCase();
      if (!cellStr.includes(needle)) return false;
    }

    return true;
  });
}

function getCurrentViewRows() {
  const filtered = getFilteredRows();
  return stableSort(filtered, state.sortKey, state.sortDir);
}

function updateMeta() {
  if (!dom.meta) return;

  const total = state.rawRows.length;
  const rows = getFilteredRows().length;
  const cols = state.columns.length;

  const sortText = state.sortKey && state.sortDir
    ? `• Sorted: ${state.sortKey} ${state.sortDir === 1 ? "▲" : "▼"}`
    : "";

  const modText = state.module ? `• Module: ${state.module}` : "";
  const filtersActive = state.filters.size ? "• Filters on" : "";
  const filteredCount = rows !== total ? `• Filtered from ${total}` : "";

  dom.meta.textContent = `${rows} rows • ${cols} columns ${modText} ${filtersActive} ${filteredCount} ${sortText}`.replace(/\s+/g, " ").trim();
}

/* -------------------------
   Global search
------------------------- */

function bindSearch() {
  if (!dom.searchInput) return;

  dom.searchInput.addEventListener("input", (e) => {
    state.searchTerm = (e.target.value || "").trim();
    render();
  });
}

function renderInsights() {
  if (!dom.insights) return;

  const filteredRows = getFilteredRows();
  const rows = filteredRows.length;
  const cols = state.columns.length;

  if (!rows || !cols) {
    dom.insights.innerHTML = `<div class="lex-insights__placeholder">No data loaded.</div>`;
    return;
  }

  const summaries = state.columns.map(col => {
    let nulls = 0;
    for (const r of filteredRows) {
      const v = r?.[col];
      if (v == null || v === "") nulls++;
    }
    const pct = rows > 0 ? Math.round((nulls / rows) * 1000) / 10 : 0;
    const type = state.typeByCol.get(col) || "string";
    return { col, type, nulls, pct };
  });

  summaries.sort((a, b) => b.nulls - a.nulls);
  const top = summaries.slice(0, 12);

  dom.insights.innerHTML = `
    <div class="lex-insights__kpi">
      <div class="lex-kpi">
        <div class="lex-kpi__label">Rows</div>
        <div class="lex-kpi__value">${rows}</div>
      </div>
      <div class="lex-kpi">
        <div class="lex-kpi__label">Columns</div>
        <div class="lex-kpi__value">${cols}</div>
      </div>
    </div>

    <div class="lex-insights__table" aria-label="Column summary">
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Null %</th>
          </tr>
        </thead>
        <tbody>
          ${top.map(s => `
            <tr>
              <td>${escapeHtml(s.col)}</td>
              <td><code>${escapeHtml(s.type)}</code></td>
              <td>${s.pct}%</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTable() {
  if (!dom.tableHead || !dom.tableBody) return;

  const columns = state.columns;
  const rows = getCurrentViewRows();

  renderHead(columns);
  renderBody(columns, rows);

  requestAnimationFrame(updateFrozenOffsets);
}

function render() {
  updateMeta();
  renderTable();
  renderDetail();
  renderInsights();
  renderDownloadsModal();
}

function toggleSort(col) {
  if (!col) return;

  if (state.sortKey !== col) {
    state.sortKey = col;
    state.sortDir = 1;
  } else {
    state.sortDir = state.sortDir === 1 ? -1 : (state.sortDir === -1 ? 0 : 1);
    if (state.sortDir === 0) state.sortKey = "";
  }
  render();
}

/* -------------------------
  Filters (per-column buttons)
------------------------- */

/* -------------------------
   Effect picker + detail view
------------------------- */

function categoriesFromRows(rows) {
  const set = new Set();
  rows.forEach(r => {
    const c = (r?.EffectCategory ?? "").toString().trim();
    if (c) set.add(c);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function currentEffectRow() {
  if (!state.selectedEffectId) return null;
  const target = String(state.selectedEffectId);
  return state.rawRows.find(r => String(r?.EffectID) === target) || null;
}

function setSelectedEffect(id) {
  state.selectedEffectId = id ? String(id) : "";
  state.userPickedEffect = true;
  render();
}

function openLexEffectMenu() {
  if (!dom.effectSelectBtn || !state.rawRows.length) return;

  const categories = categoriesFromRows(state.rawRows);
  openEffectMenu({
    slotIdx: 0,
    anchorBtn: dom.effectSelectBtn,
    eligible: state.rawRows,
    categories,
    currentId: state.selectedEffectId,
    selectedCategory: "__all",
    onPick: (id) => {
      setSelectedEffect(id);
      closeEffectMenu();
    }
  });
}

function bindEffectSelect() {
  if (dom.effectSelectBtn) dom.effectSelectBtn.addEventListener("click", openLexEffectMenu);

  const safeClose = () => {
    if (isEffectMenuOverlayOpen && isEffectMenuOverlayOpen()) return;
    closeEffectMenu();
  };

  window.addEventListener("resize", safeClose);
  window.addEventListener("scroll", safeClose, true);
}

function bindDetailInfo() {
  if (!dom.detailContent) return;

  dom.detailContent.addEventListener("click", (e) => {
    const btn = e.target.closest(".lex-detail__info");
    if (!btn) return;
    const col = btn.getAttribute("data-col") || "";
    if (col) openInfoModal(col);
  });
}

function renderDetail() {
  if (!dom.detailContent) return;

  const row = currentEffectRow();

  if (!row) {
    dom.detailContent.innerHTML = `<div class="lex-detail__placeholder">Select an effect to view all fields.</div>`;
    if (dom.effectSelectBtn) dom.effectSelectBtn.textContent = "-- Select Effect --";
    return;
  }

  const title = row.EffectDescription || `Effect ${row.EffectID}`;
  const theme = categoryThemeFor(row.EffectCategory);
  const headerStyle = theme
    ? `style="background:${gradientFromTheme(theme)}; border-color:${theme?.border || 'rgba(255,255,255,0.16)'}; color:${textColorFor(theme?.base || '#2b2f38')}"`
    : "";
  if (dom.effectSelectBtn) {
    const hasSelection = state.userPickedEffect && !!row;
    const label = hasSelection ? title : "-- Select Effect --";
    dom.effectSelectBtn.innerHTML = `<span class="lex-effect-select__label">${escapeHtml(label)}</span>`;
    dom.effectSelectBtn.classList.toggle("has-selection", hasSelection);
  }

  const fields = state.columns.map(col => {
    const label = getDisplayLabel(col);
    const val = row?.[col];
    const display = (val == null || String(val).trim() === "")
      ? `<span class="lexicon-empty">∅</span>`
      : escapeHtml(String(val));

    const colLower = col.toLowerCase();

    let decoratedValue = display;

    // Category pill styling
    if (colLower === "effectcategory" || colLower === "category") {
      const catLabel = String(val ?? "Uncategorized");
      const catTheme = categoryThemeFor(catLabel);
      const bg = gradientFromTheme(catTheme);
      const base = catTheme?.base || "#2b2f38";
      const border = catTheme?.border || "rgba(255,255,255,0.14)";
      const text = textColorFor(base);
      decoratedValue = `
        <span class="lex-cat-pill lex-cat-pill--inline" style="--lex-cat-base:${base}; background:${bg}; border-color:${border}; color:${text};">
          <span class="lex-cat-pill__label">${escapeHtml(catLabel || "Uncategorized")}</span>
        </span>
      `;
    }

    // Characters pill styling (palette-driven)
    if (colLower === "characters" || colLower === "character") {
      const charLabel = (val == null ? "" : String(val)).trim();
      const key = charLabel.toLowerCase();
      const theme = key === "all"
        ? CHIP_COLORS.characterAll
        : (CHARACTER_COLORS[key] || CHIP_COLORS.character || CHIP_COLORS.placeholder);

      const bg = theme?.bg || "rgba(255,255,255,0.08)";
      const border = theme?.border || "rgba(255,255,255,0.14)";
      const text = theme?.text || "rgba(245,245,245,0.92)";

      decoratedValue = `
        <span class="lex-char-pill" style="background:${bg}; border-color:${border}; color:${text};">
          ${escapeHtml(charLabel || "Unknown")}
        </span>
      `;
    }

    // Add human-readable booleans next to raw values for curse flags
    if (["curse", "curseRequired", "curserequired", "selfstacking"].includes(colLower) && val != null) {
      const raw = String(val).trim().toLowerCase();
      const isTrue = ["1", "true", "yes", "y"].includes(raw);
      const isFalse = ["0", "false", "no", "n"].includes(raw);
      const labelText = isTrue ? "Yes" : (isFalse ? "No" : String(val));
      decoratedValue = `
        <span class="lex-detail__value-primary">${display}</span>
        <span class="lex-detail__value-plain">(${escapeHtml(labelText)})</span>
      `;
    }
    return `
      <div class="lex-detail__row">
        <div class="lex-detail__label">
          <span class="lex-detail__label-text">${escapeHtml(label)}</span>
          <button class="lexicon-col-info lex-detail__info" type="button" data-col="${escapeHtml(col)}" aria-label="Column info">i</button>
        </div>
        <div class="lex-detail__value">${decoratedValue}</div>
      </div>
    `;
  }).join("");

  dom.detailContent.innerHTML = `
    <div class="lex-detail__header lex-detail__header--themed" ${headerStyle}>
      <div class="lex-detail__title">${escapeHtml(title)}</div>
    </div>
    <div class="lex-detail__grid">${fields}</div>
  `;
}

/* -------------------------
   Module picker
------------------------- */

function setActiveModule(moduleKey) {
  const key = String(moduleKey || "").toLowerCase();
  const url = DATASETS[key];

  if (!url) return;

  state.module = key;
  state.dataUrl = url;

  state.searchTerm = "";
  if (dom.searchInput) dom.searchInput.value = "";

  for (const b of dom.moduleButtons) {
    const mk = (b.getAttribute("data-module") || "").toLowerCase();
    b.classList.toggle("is-active", mk === key);
  }

  state.sortKey = "";
  state.sortDir = 0;
  state.downloadsManifest = null;
  state.downloadsLoading = false;
  state.selectedEffectId = "";

  closeDownloadsModal();
  closeInfoModal();
  closeEffectMenu();

  loadData().catch(console.error);
  loadDownloadsManifest(key).catch(console.error);
}

function bindModulePicker() {
  for (const b of dom.moduleButtons) {
    const disabled = b.getAttribute("aria-disabled") === "true";
    if (disabled) continue;

    b.addEventListener("click", () => {
      const key = b.getAttribute("data-module") || "";
      setActiveModule(key);
      closeDatasetPanel();
    });
  }
}

function setDatasetPanel(open) {
  if (!dom.datasetPanel || !dom.datasetToggle) return;
  dom.datasetPanel.classList.toggle("is-open", open);
  dom.datasetToggle.classList.toggle("is-open", open);
  dom.datasetToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function closeDatasetPanel() {
  setDatasetPanel(false);
}

function bindDatasetToggle() {
  if (!dom.datasetToggle || !dom.datasetPanel) return;

  dom.datasetToggle.addEventListener("click", () => {
    const isOpen = dom.datasetPanel.classList.contains("is-open");
    setDatasetPanel(!isOpen);
  });

  const mq = window.matchMedia("(min-width: 921px)");
  mq.addEventListener("change", e => {
    if (e.matches) closeDatasetPanel();
  });
}

/* -------------------------
   Data load
------------------------- */

async function loadData() {
  if (dom.meta) dom.meta.textContent = "Loading…";
  if (dom.insights) dom.insights.innerHTML = `<div class="lex-insights__placeholder">Loading…</div>`;

  const res = await fetch(state.dataUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${state.dataUrl} (${res.status})`);

  const rows = await res.json();
  state.rawRows = Array.isArray(rows) ? rows : [];
  state.columns = reorderColumns(inferColumns(state.rawRows));
  state.filters.clear();
  state.searchTerm = "";
  computeTypeMap(state.rawRows, state.columns);

  // Default to the first effect so detail view is populated immediately
  state.selectedEffectId = state.rawRows[0]?.EffectID ? String(state.rawRows[0].EffectID) : "";
  state.userPickedEffect = false;

  // Precompute category colors so EffectCategory cells mirror Reliquary dropdowns
  state.categoryThemes = state.module === "reliquary"
    ? buildCategoryThemeMap(state.rawRows)
    : new Map();

  render();
  loadDownloadsManifest(state.module).catch(console.error);
}

async function init() {
  bindSearch();
  bindModulePicker();
  bindDatasetToggle();
  bindExportButton();
  bindDownloadsModal();
  bindInfoModal();
  bindEffectSelect();
  bindDetailInfo();

  await loadData();
}

init().catch(err => {
  console.error(err);
  if (dom.tableBody) {
    dom.tableBody.innerHTML =
      `<tr><td colspan="99">Error: ${escapeHtml(String(err.message || err))}</td></tr>`;
  }
  if (dom.meta) dom.meta.textContent = "Error loading data.";
  if (dom.insights) dom.insights.innerHTML = `<div class="lex-insights__placeholder">Error loading data.</div>`;
});
