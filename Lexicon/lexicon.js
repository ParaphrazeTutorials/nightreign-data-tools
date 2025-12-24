// The Lexicon — read-only table (Path 1)
// Session-only: sort + text zoom (S/M/L). No persistence across refresh.

const DATA_URL = new URL("../Data/reliquary.json", window.location.href).toString();

const dom = {
  wrap: document.querySelector(".lexicon-wrap"),
  tableHead: document.getElementById("lexiconHead"),
  tableBody: document.getElementById("lexiconBody"),
  // Present in HTML, but intentionally unused/hidden:
  meta: document.getElementById("lexiconMeta"),
  exportBtn: document.getElementById("lexiconExportCsv"),
  zoomButtons: Array.from(document.querySelectorAll(".lexicon-zoom-btn[data-zoom]"))
};

const state = {
  rawRows: [],
  columns: [],
  sortKey: "",
  sortDir: 0, // 0 none, 1 asc, -1 desc
  typeByCol: new Map(), // col -> "number" | "string"
  zoom: "small" // "small" | "medium" | "large"
};

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  // If it contains quotes, commas, or newlines, wrap in quotes and escape quotes.
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function toCsv(columns, rows) {
  const lines = [];
  lines.push(columns.map(csvEscape).join(","));

  for (const r of rows) {
    const line = columns.map(c => csvEscape(r?.[c])).join(",");
    lines.push(line);
  }
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

function bindExport() {
  if (!dom.exportBtn) return;

  dom.exportBtn.addEventListener("click", () => {
    const rows = getCurrentViewRows();
    const csv = toCsv(state.columns, rows);

    // Filename is stable and human-friendly. Session-only.
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`lexicon_reliquary_${stamp}.csv`, csv, "text/csv;charset=utf-8");
  });
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
  // In future steps, this is where filters will be applied.
  return stableSort(state.rawRows.slice(), state.sortKey, state.sortDir);
}

function render() {
  const columns = state.columns;
  const sorted = getCurrentViewRows();
  renderHead(columns);
  renderBody(columns, sorted);
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

async function load() {
  bindZoomButtons();
  bindExport();

  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);

  const rows = await res.json();
  state.rawRows = Array.isArray(rows) ? rows : [];
  state.columns = inferColumns(state.rawRows);
  computeTypeMap(state.rawRows, state.columns);

  state.sortKey = "";
  state.sortDir = 0;

  render();
}

load().catch(err => {
  console.error(err);
  if (dom.tableBody) {
    dom.tableBody.innerHTML =
      `<tr><td colspan="99">Error: ${escapeHtml(String(err.message || err))}</td></tr>`;
  }
});
