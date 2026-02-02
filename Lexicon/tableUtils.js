// Shared table utilities for Lexicon-style datasets

export function inferColumns(rows) {
  const cols = [];
  const seen = new Set();
  for (const r of rows || []) {
    if (!r || typeof r !== "object") continue;
    for (const key of Object.keys(r)) {
      if (seen.has(key)) continue;
      seen.add(key);
      cols.push(key);
    }
  }
  return cols;
}

export function reorderColumns(columns, priority = []) {
  const priLower = new Set(priority.map(c => c.toLowerCase()));
  const prioritized = [];
  for (const target of priority) {
    const found = columns.find(c => c.toLowerCase() === target.toLowerCase());
    if (found) prioritized.push(found);
  }
  const rest = columns.filter(c => !priLower.has(c.toLowerCase()));
  return [...prioritized, ...rest];
}

function inferTypeForColumn(rows, col) {
  let sawValue = false;
  for (const r of rows || []) {
    const v = r?.[col];
    if (v == null || v === "") continue;
    sawValue = true;
    const n = Number(v);
    if (!Number.isFinite(n)) return "string";
  }
  return sawValue ? "number" : "string";
}

export function inferTypeMap(rows, columns) {
  const map = new Map();
  for (const c of columns || []) map.set(c, inferTypeForColumn(rows, c));
  return map;
}

function comparableValue(type, value) {
  if (value == null || value === "") return null;
  if (type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return String(value).toLowerCase();
}

export function stableSort(rows, col, dir, typeByCol = new Map()) {
  if (!col || !dir) return rows;
  const type = typeByCol.get(col) || "string";
  const decorated = (rows || []).map((r, idx) => ({ r, idx }));
  decorated.sort((a, b) => {
    const av = comparableValue(type, a.r?.[col]);
    const bv = comparableValue(type, b.r?.[col]);
    const aNull = av == null;
    const bNull = bv == null;
    if (aNull && bNull) return a.idx - b.idx;
    if (aNull) return 1;
    if (bNull) return -1;
    let cmp = 0;
    if (type === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    if (cmp !== 0) return cmp * dir;
    return a.idx - b.idx;
  });
  return decorated.map(d => d.r);
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
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

export function exportCsvFile({ columns, rows, filenameBase, displayLabelFor }) {
  if (!Array.isArray(columns) || !columns.length) return;
  const header = columns.map(col => displayLabelFor ? displayLabelFor(col) : col);
  const lines = [];
  lines.push(header.map(csvEscape).join(","));
  for (const r of rows || []) lines.push(columns.map(c => csvEscape(r?.[c])).join(","));
  const date = new Date().toISOString().split("T")[0];
  const filename = `${filenameBase || "export"}-${date}.csv`;
  downloadText(filename, lines.join("\n"), "text/csv;charset=utf-8");
}

export function createFloatingFilterPortal({
  onFilterChange,
  getFilterValue,
  getLabelForColumn
}) {
  let filterEl = null;
  let currentCol = null;
  let anchorTh = null;
  let anchorBtn = null;

  const hide = () => {
    if (!filterEl) return;
    filterEl.hidden = true;
    filterEl.style.display = "none";
    filterEl.setAttribute("aria-hidden", "true");
    anchorTh?.classList.remove("is-filtering");
    anchorBtn?.classList.remove("is-open");
    currentCol = null;
    anchorTh = null;
    anchorBtn = null;
  };

  const ensureFilter = () => {
    if (filterEl) return filterEl;
    filterEl = document.createElement("input");
    filterEl.type = "text";
    filterEl.className = "lexicon-floating-filter";
    filterEl.autocomplete = "off";
    filterEl.spellcheck = false;
    filterEl.inputMode = "search";
    filterEl.placeholder = "Filter column...";
    filterEl.hidden = true;
    filterEl.style.display = "none";
    filterEl.setAttribute("aria-hidden", "true");

    filterEl.addEventListener("input", () => {
      if (!currentCol) return;
      const value = filterEl.value || "";
      const trimmed = value.trim();
      if (trimmed === "") {
        onFilterChange?.(currentCol, "");
        hide();
        return;
      }
      onFilterChange?.(currentCol, value);
    });

    filterEl.addEventListener("blur", () => {
      if (currentCol && (filterEl.value || "").trim() === "") {
        onFilterChange?.(currentCol, "");
      }
      hide();
    });

    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);

    document.body.appendChild(filterEl);
    return filterEl;
  };

  const open = (column, th, btn) => {
    const el = ensureFilter();
    currentCol = column;
    anchorTh = th || null;
    anchorBtn = btn || null;

    const current = getFilterValue ? (getFilterValue(column) || "") : "";
    el.value = current;
    const label = getLabelForColumn ? getLabelForColumn(column) : column;
    el.placeholder = label ? `Filter ${label}...` : "Filter...";

    el.hidden = false;
    el.removeAttribute("aria-hidden");
    el.style.display = "inline-block";

    const rect = btn?.getBoundingClientRect?.() || th?.getBoundingClientRect?.();
    const top = (rect?.bottom || 0) + window.scrollY + 4;
    const left = (rect?.left || 0) + window.scrollX;
    const minW = Math.max((rect?.width || 0) + 60, 150);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.minWidth = `${minW}px`;

    if (th) th.classList.add("is-filtering");
    if (btn) btn.classList.add("is-open");

    requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
  };

  return {
    open,
    hide,
    isOpenFor(column) {
      return !!filterEl && !filterEl.hidden && currentCol === column;
    }
  };
}
