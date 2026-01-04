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
    EffectID: { description: "", source: "AttachEffectParam.csv" },
    OverrideBaseEffectID: { description: "", source: "AttachEffectParam.csv" },
    RawRollOrder: { description: "", source: "Calculated (See Query)" },
    CompatibilityID: { description: "", source: "AttachEffectParam.csv" },
    EffectCategory: { description: "", source: "Compatibility.csv" },
    EffectDescription: { description: "", source: "AttachEffectName.csv" },
    ChanceWeight_110: { description: "", source: "AttachEffectTableParam.csv" },
    ChanceWeight_210: { description: "", source: "AttachEffectTableParam.csv" },
    ChanceWeight_310: { description: "", source: "AttachEffectTableParam.csv" },
    ChanceWeight_2000000: { description: "", source: "AttachEffectTableParam.csv" },
    ChanceWeight_2200000: { description: "", source: "AttachEffectTableParam.csv" },
    ChanceWeight_3000000: { description: "", source: "AttachEffectTableParam.csv" },
    StatusIconID: { description: "", source: "AttachEffectParam.csv" },
    CurseRequired: { description: "", source: "Calculated (See Query)" },
    Curse: { description: "", source: "Calculated (See Query)" },
    RelicType: { description: "", source: "Calculated (See Query)" },
    RollOrder: { description: "Calculated (See Query)", source: "" }
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
    ChanceWeight_110: "Weight 1",
    ChanceWeight_210: "Weight 2",
    ChanceWeight_310: "Weight 3",
    ChanceWeight_2000000: "Weight 4",
    ChanceWeight_2200000: "Weight 5",
    ChanceWeight_3000000: "Weight 6",
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

  // table
  wrap: document.querySelector(".lexicon-wrap"),
  table: document.querySelector(".lexicon-table"),
  tableHead: document.getElementById("lexiconHead"),
  tableBody: document.getElementById("lexiconBody"),
  meta: document.getElementById("lexiconMeta"),
  searchInput: document.getElementById("lexiconSearch"),

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

  // zoom
  zoomButtons: Array.from(document.querySelectorAll(".lexicon-zoom-btn[data-zoom]")),

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
  zoom: "small", // "small" | "medium" | "large"
  filters: new Map(),
  searchTerm: "",

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

const PRIORITY_COLUMNS = ["EffectID", "EffectDescription","EffectCategory","RelicType","ChanceWeight_110","ChanceWeight_210","ChanceWeight_310","ChanceWeight_2000000","ChanceWeight_2200000","ChanceWeight_3000000"];

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

function applyZoomClass() {
  if (!dom.wrap) return;

  dom.wrap.classList.remove("zoom-small", "zoom-medium", "zoom-large");
  dom.wrap.classList.add(`zoom-${state.zoom}`);

  for (const b of dom.zoomButtons) {
    const z = b.getAttribute("data-zoom");
    const pressed = z === state.zoom;
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    if (pressed) b.classList.add("is-active");
    else b.classList.remove("is-active");
  }
}

function bindZoomButtons() {
  state.zoom = "small";
  applyZoomClass();

  for (const b of dom.zoomButtons) {
    b.addEventListener("click", () => {
      const z = String(b.getAttribute("data-zoom") || "small");
      state.zoom = (z === "medium" || z === "large") ? z : "small";
      applyZoomClass();
    });
  }
}

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
    dom.infoModalBody.innerHTML = `
      <div class="lex-info__row"><strong>Data Type:</strong> <code>${escapeHtml(type)}</code></div>
      <div class="lex-info__row"><strong>Raw Column Name:</strong> ${rawNameHtml}</div>
      <div class="lex-info__row"><strong>Data Source:</strong> ${sourceHtml}</div>
      <div class="lex-info__row"><strong>Description:</strong> ${defHtml}</div>
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

  return `
    <th scope="col" class="lexicon-th ${isActive ? "is-sorted" : ""}"
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
  const isLongText = key.toLowerCase().includes("description");
  const isIdish = key.toLowerCase().endsWith("id") || /^[0-9]+$/.test(v);
  const isNumeric = state.typeByCol.get(key) === "number";
  const isSortedCol = state.sortKey === key && state.sortDir !== 0;

  const cls = [
    isLongText ? "lexicon-cell--text" : "",
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
   Search
------------------------- */

function bindSearch() {
  if (!dom.searchInput) return;
  dom.searchInput.addEventListener("input", () => {
    state.searchTerm = String(dom.searchInput.value || "");
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

function render() {
  const columns = state.columns;
  const sorted = getCurrentViewRows();
  renderHead(columns);
  renderBody(columns, sorted);
  updateMeta();
  renderInsights();
  renderDownloadsModal();
  updateFrozenOffsets();
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

  closeDownloadsModal();
  closeInfoModal();

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
    });
  }
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
  if (dom.searchInput) dom.searchInput.value = "";
  computeTypeMap(state.rawRows, state.columns);

  render();
  loadDownloadsManifest(state.module).catch(console.error);
}

async function init() {
  bindZoomButtons();
  bindSearch();
  bindModulePicker();
  bindExportButton();
  bindDownloadsModal();
  bindInfoModal();

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
