// The Lexicon — table + tile theater mode + module picker
// Session-only: sort + text zoom. No persistence across refresh.

const DATASETS = {
  reliquary: new URL("../Data/reliquary.json", window.location.href).toString(),
  // placeholders (not wired yet)
  menagerie: "",
  armory: "",
  grimoire: ""
};

const dom = {
  // layout
  grid: document.getElementById("lexiconGrid"),
  moduleButtons: Array.from(document.querySelectorAll(".lexicon-module-card[data-module]")),
  expandButtons: Array.from(document.querySelectorAll(".lex-tile__expand")),

  // table
  wrap: document.querySelector(".lexicon-wrap"),
  tableHead: document.getElementById("lexiconHead"),
  tableBody: document.getElementById("lexiconBody"),
  meta: document.getElementById("lexiconMeta"),
  searchInput: document.getElementById("lexiconSearch"),

  // downloads
  downloadsDynamic: document.getElementById("lexiconDownloadsDynamic"),

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

  // theater
  expandedTile: null, // "table" | "downloads" | "docs" | "insights" | null

  // downloads
  downloadsManifest: null
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

const PRIORITY_COLUMNS = ["EffectID", "EffectCategory", "EffectDescription"];

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
  const url = getManifestUrl(moduleKey);
  if (!url) {
    renderDownloads();
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
  renderDownloads();
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
    const label = item.label || item.id || "Download";
    const href = item.href || "#";
    const fmt = item.format ? String(item.format).toUpperCase() : "";
    const size = item.size ? String(item.size) : "";
    const meta = [fmt, size].filter(Boolean).join(" • ");
    const desc = item.description || "";
    return `
      <a class="lex-downloads__item" href="${escapeHtml(href)}" download>
        <span class="lex-downloads__item-label">${escapeHtml(label)}</span>
        ${meta ? `<span class="lex-downloads__item-meta">${escapeHtml(meta)}</span>` : ""}
        ${desc ? `<span class="lex-downloads__item-desc">${escapeHtml(desc)}</span>` : ""}
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

function renderDownloads() {
  if (!dom.downloadsDynamic) return;

  const m = state.downloadsManifest;
  if (!m) {
    dom.downloadsDynamic.innerHTML = `<div class="lex-downloads__empty">No downloads available for this module.</div>`;
    return;
  }

  const sections = [
    renderDownloadsSection("Table data export", m.tableExports),
    renderDownloadsSection("Raw game files", m.rawGameFiles),
    renderDownloadsSection("Supplemental files", m.supplementalFiles)
  ];

  dom.downloadsDynamic.innerHTML = sections.join("");
}

function thHtml(key) {
  const isActive = state.sortKey === key && state.sortDir !== 0;
  const glyph = !isActive ? "" : (state.sortDir === 1 ? "▲" : "▼");

  return `
    <th scope="col" class="lexicon-th ${isActive ? "is-sorted" : ""}"
        role="button" tabindex="0"
        data-col="${escapeHtml(key)}"
        aria-sort="${isActive ? (state.sortDir === 1 ? "ascending" : "descending") : "none"}">
      <div class="lexicon-th__inner">
        <span class="lexicon-th__label">${escapeHtml(key)}</span>
        <div class="lexicon-th__controls">
          <button class="lexicon-col-filter" type="button" title="Filter ${escapeHtml(key)}" aria-label="Filter ${escapeHtml(key)}" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M8 12h8m-4 7h0"/></svg>
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

  const cls = [
    isLongText ? "lexicon-cell--text" : "",
    isIdish ? "lexicon-cell--mono" : ""
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
  renderDownloads();
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
   Theater mode
------------------------- */

function tileIdForExpandButton(btn) {
  if (!btn) return "";
  const tile = btn.closest(".lex-tile[data-tile]");
  return tile ? String(tile.getAttribute("data-tile") || "") : "";
}

function setExpandedTile(tileIdOrNull) {
  state.expandedTile = tileIdOrNull || null;

  if (!dom.grid) return;

  const tiles = Array.from(dom.grid.querySelectorAll(".lex-tile[data-tile]"));
  for (const t of tiles) {
    const id = t.getAttribute("data-tile");
    const isExpanded = state.expandedTile && id === state.expandedTile;
    t.classList.toggle("is-expanded", !!isExpanded);
  }

  dom.grid.classList.toggle("is-theater", !!state.expandedTile);

  for (const b of dom.expandButtons) {
    const id = tileIdForExpandButton(b);
    const isExpanded = !!state.expandedTile && id === state.expandedTile;

    b.classList.toggle("is-expanded", isExpanded);
    b.setAttribute("title", isExpanded ? "Collapse" : "Expand");
    b.setAttribute("aria-label", isExpanded ? "Collapse panel" : "Expand panel");
  }
}

function bindTheaterMode() {
  for (const b of dom.expandButtons) {
    const activate = () => {
      const id = tileIdForExpandButton(b);
      if (!id) return;

      if (state.expandedTile === id) setExpandedTile(null);
      else setExpandedTile(id);
    };

    b.addEventListener("click", activate);
    b.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.expandedTile) {
      setExpandedTile(null);
    }
  });
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
  bindTheaterMode();
  bindSearch();
  bindModulePicker();

  setExpandedTile(null);
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
