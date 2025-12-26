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

  // downloads
  exportCsvBtn: document.getElementById("lexiconExportCsv"),
  exportJsonBtn: document.getElementById("lexiconExportJson"),

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

  // theater
  expandedTile: null // "table" | "downloads" | "docs" | "insights" | null
};

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

function bindDownloads() {
  if (dom.exportCsvBtn) {
    dom.exportCsvBtn.addEventListener("click", () => {
      const rows = getCurrentViewRows();
      const csv = toCsv(state.columns, rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadText(`lexicon_${state.module}_${stamp}.csv`, csv, "text/csv;charset=utf-8");
    });
  }

  if (dom.exportJsonBtn) {
    dom.exportJsonBtn.addEventListener("click", () => {
      const stamp = new Date().toISOString().slice(0, 10);
      const json = JSON.stringify(state.rawRows, null, 2);
      downloadText(`lexicon_${state.module}_${stamp}.json`, json, "application/json;charset=utf-8");
    });
  }
}

function thHtml(key) {
  const isActive = state.sortKey === key && state.sortDir !== 0;
  const glyph = !isActive ? "" : (state.sortDir === 1 ? "▲" : "▼");

  return `
    <th scope="col" class="lexicon-th ${isActive ? "is-sorted" : ""}"
        role="button" tabindex="0"
        data-col="${escapeHtml(key)}"
        aria-sort="${isActive ? (state.sortDir === 1 ? "ascending" : "descending") : "none"}">
      <span class="lexicon-th__label">${escapeHtml(key)}</span>
      <span class="lexicon-th__glyph" aria-hidden="true">${glyph}</span>
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
  });
}

function renderBody(columns, rows) {
  if (!dom.tableBody) return;
  const out = [];
  for (const r of rows) out.push(`<tr>${columns.map(k => tdHtml(k, r?.[k])).join("")}</tr>`);
  dom.tableBody.innerHTML = out.join("");
}

function getCurrentViewRows() {
  return stableSort(state.rawRows.slice(), state.sortKey, state.sortDir);
}

function updateMeta() {
  if (!dom.meta) return;

  const rows = state.rawRows.length;
  const cols = state.columns.length;

  const sortText = state.sortKey && state.sortDir
    ? `• Sorted: ${state.sortKey} ${state.sortDir === 1 ? "▲" : "▼"}`
    : "";

  const modText = state.module ? `• Module: ${state.module}` : "";
  dom.meta.textContent = `${rows} rows • ${cols} columns ${modText} ${sortText}`.replace(/\s+/g, " ").trim();
}

function renderInsights() {
  if (!dom.insights) return;

  const rows = state.rawRows.length;
  const cols = state.columns.length;

  if (!rows || !cols) {
    dom.insights.innerHTML = `<div class="lex-insights__placeholder">No data loaded.</div>`;
    return;
  }

  const summaries = state.columns.map(col => {
    let nulls = 0;
    for (const r of state.rawRows) {
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

  for (const b of dom.moduleButtons) {
    const mk = (b.getAttribute("data-module") || "").toLowerCase();
    b.classList.toggle("is-active", mk === key);
  }

  state.sortKey = "";
  state.sortDir = 0;

  loadData().catch(console.error);
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
  state.columns = inferColumns(state.rawRows);
  computeTypeMap(state.rawRows, state.columns);

  render();
}

async function init() {
  bindZoomButtons();
  bindDownloads();
  bindTheaterMode();
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
