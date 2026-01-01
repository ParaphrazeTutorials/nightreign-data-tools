import { DATA_URL, relicDefaultPath, visualRelicType } from "./reliquary.assets.js";
import {
  COLORS,
  compatId,
  categoriesFor,
  applyCategory,
  eligibleList,
  baseFilteredByRelicType,
  autoRelicTypeFromEffect1
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
  const n = Number.parseInt(row?.RollOrder, 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function computeCompatDupGroups(selectedRows) {
  const byCompat = new Map();

  for (const r of selectedRows) {
    if (!r) continue;
    const id = compatId(r);
    if (!id) continue;
    if (!byCompat.has(id)) byCompat.set(id, []);
    byCompat.get(id).push(r);
  }

  return [...byCompat.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([cid, list], idx) => ({ cid, list, listId: `compatDupList_${idx}` }));
}

function computeRollOrderIssue(a, b, c) {
  const original = [a, b, c];
  const picked = original.filter(Boolean);

  if (picked.length < 2) {
    return {
      hasIssue: false,
      sorted: null,
      movedSlots: [false, false, false],
      moveDeltaBySlot: [0, 0, 0]
    };
  }

  const sortedPicked = picked.slice().sort((x, y) => getRollValue(x) - getRollValue(y));

  let mismatch = false;
  let j = 0;
  for (let i = 0; i < original.length; i++) {
    if (!original[i]) continue;
    if (String(original[i].EffectID) !== String(sortedPicked[j].EffectID)) mismatch = true;
    j++;
  }

  if (!mismatch) {
    return {
      hasIssue: false,
      sorted: null,
      movedSlots: [false, false, false],
      moveDeltaBySlot: [0, 0, 0]
    };
  }

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
  j = 0;
  for (let i = 0; i < sortedSlots.length; i++) {
    if (!sortedSlots[i]) continue;
    sortedSlots[i] = sortedPicked[j];
    j++;
  }

  return {
    hasIssue: true,
    sorted: sortedSlots,
    movedSlots,
    moveDeltaBySlot
  };
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

function installDetailsToggles() {
  if (!dom.detailsBody) return;
  const buttons = dom.detailsBody.querySelectorAll("[data-popover-toggle]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-popover-toggle");
      if (!id) return;
      const pop = dom.detailsBody.querySelector(`#${CSS.escape(id)}`);
      if (!pop) return;
      pop.hidden = !pop.hidden;
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
      openCurseDialog(slotIdx);
    });
  });
}

function computeEffectDialogData(slotIdx, showIllegalOverride = null) {
  const showIllegal = showIllegalOverride ?? !!dom.showIllegalEl.checked;
  const type = dom.selType.value;

  const base = baseFilteredByRelicType(rows, type);
  const baseCats = categoriesFor(base);

  const a = getSelectedRow(0);
  const b = getSelectedRow(1);

  if (slotIdx === 1 && !a) return { disabled: true, reason: "Select Effect 1 first" };
  if (slotIdx === 2 && (!a || !b)) return { disabled: true, reason: "Select previous effects first" };

  if (slotIdx === 0) {
    const filtered = applyCategory(base, selectedCats[0]);
    return { disabled: false, categories: baseCats, filtered, currentId: getSelectedId(0) };
  }

  if (slotIdx === 1) {
    const takenFor2 = new Set([selectedEffects[0], selectedEffects[2]].filter(Boolean).map(String));
    const blockedFor2 = new Set();
    if (a) {
      const cidA = compatId(a);
      if (cidA) blockedFor2.add(cidA);
    }
    const eligible2 = eligibleList(rows, type, blockedFor2, takenFor2, showIllegal);
    const filtered = applyCategory(eligible2, selectedCats[1]);
    return { disabled: false, categories: categoriesFor(eligible2.length ? eligible2 : base), filtered, currentId: getSelectedId(1) };
  }

  if (slotIdx === 2) {
    const takenFor3 = new Set([selectedEffects[0], selectedEffects[1]].filter(Boolean).map(String));
    const blockedFor3 = new Set();
    if (a) {
      const cidA = compatId(a);
      if (cidA) blockedFor3.add(cidA);
    }
    if (b) {
      const cidB = compatId(b);
      if (cidB) blockedFor3.add(cidB);
    }
    const eligible3 = eligibleList(rows, type, blockedFor3, takenFor3, showIllegal);
    const filtered = applyCategory(eligible3, selectedCats[2]);
    return { disabled: false, categories: categoriesFor(eligible3.length ? eligible3 : base), filtered, currentId: getSelectedId(2) };
  }

  return { disabled: true, reason: "Invalid slot" };
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
      if (nextType) dom.selType.value = nextType;
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
      openEffectDialog(slotIdx);
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

  if (missingCurseSlots.length > 0) {
    const labels = missingCurseSlots.map(i => slotLabel(i)).join(", ");
    blocks.push(`
      <div class="info-box is-alert" data-kind="curse-required">
        <div class="info-line">
          <span>One or more of your effects requires a </span>
          <button type="button" class="term-link" data-popover-toggle="cursePopover">Curse</button><span>.</span>
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
          <button type="button" class="term-link" data-popover-toggle="orderPopover">
            roll order
          </button>.
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
  if (dom.selColor.value === "Random") {
    const modifierReasons = new Set([
      "type-change",
      "illegal-change",
      "cat-change",
      "effect-change",
      "init",
      "raw-change"
    ]);
    if (modifierReasons.has(reason)) pickRandomColor();
  }

  const showIllegal = !!dom.showIllegalEl.checked;
  const showRaw = !!dom.showRawEl?.checked;

  const hasCurseSelected = curseBySlot.some(Boolean);

  if (resultsEl) {
    resultsEl.classList.toggle("is-raw", showRaw);
    resultsEl.classList.toggle("raw-has-curse", showRaw && hasCurseSelected);
  }

  const a = getSelectedRow(0);
  const b = getSelectedRow(1);
  const c = getSelectedRow(2);

  const takenFor2 = new Set([selectedEffects[0], selectedEffects[2]].filter(Boolean).map(String));
  const takenFor3 = new Set([selectedEffects[0], selectedEffects[1]].filter(Boolean).map(String));

  const blockedFor2 = new Set();
  if (a) {
    const cidA = compatId(a);
    if (cidA) blockedFor2.add(cidA);
  }

  const blockedFor3 = new Set();
  if (a) {
    const cidA = compatId(a);
    if (cidA) blockedFor3.add(cidA);
  }
  if (b) {
    const cidB = compatId(b);
    if (cidB) blockedFor3.add(cidB);
  }

  const base1 = baseFilteredByRelicType(rows, dom.selType.value);
  const filtered1 = applyCategory(base1, selectedCats[0]);

  const eligible2 = a ? eligibleList(rows, dom.selType.value, blockedFor2, takenFor2, showIllegal) : [];
  const filtered2 = applyCategory(eligible2, selectedCats[1]);

  const eligible3 = (a && b) ? eligibleList(rows, dom.selType.value, blockedFor3, takenFor3, showIllegal) : [];
  const filtered3 = applyCategory(eligible3, selectedCats[2]);

  const eligible2Ids = new Set(filtered2.map(r => String(r.EffectID)));
  const eligible3Ids = new Set(filtered3.map(r => String(r.EffectID)));

  let cleared = false;
  if (selectedEffects[1] && !eligible2Ids.has(selectedEffects[1])) {
    setSelectedId(1, "");
    curseBySlot[1] = null;
    cleared = true;
  }

  if (selectedEffects[2] && !eligible3Ids.has(selectedEffects[2])) {
    setSelectedId(2, "");
    curseBySlot[2] = null;
    cleared = true;
  }

  if (cleared) {
    updateUI(reason);
    return;
  }

  const cSelections = [getSelectedRow(0), getSelectedRow(1), getSelectedRow(2)];
  const stage = cSelections[2] ? 3 : cSelections[1] ? 2 : cSelections[0] ? 1 : 0;

  setRelicImageForStage({
    relicImg: dom.relicImg,
    selectedType: dom.selType.value,
    selectedColor: dom.selColor.value,
    randomColor: currentRandomColor,
    stage
  });

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

  function isIncompatRow(r) {
    return !!(r && compatConflictIds.has(String(r.EffectID)));
  }

  const roll = computeRollOrderIssue(cSelections[0], cSelections[1], cSelections[2]);
  const hasOrderIssue = roll.hasIssue;

  const hasCurseMissing = (() => {
    for (let i = 0; i < cSelections.length; i++) {
      const r = cSelections[i];
      if (!r) continue;
      const req = String(r?.CurseRequired ?? "0") === "1";
      if (req && !curseBySlot[i]) return true;
    }
    return false;
  })();

  const state = anySelected && (hasCompatIssue || hasOrderIssue || hasCurseMissing) ? "Invalid" : "Valid";
  setValidityBadge(state, anySelected);

  const okBySlot = [false, false, false];

  if (state === "Valid") {
    if (cSelections[0] && !cSelections[1] && !cSelections[2]) okBySlot[0] = true;
    if (cSelections[0] && cSelections[1] && !cSelections[2] && !roll.hasIssue && !hasCompatIssue) {
      okBySlot[0] = true;
      okBySlot[1] = true;
    }
    if (cSelections[0] && cSelections[1] && cSelections[2] && !roll.hasIssue && !hasCompatIssue) {
      okBySlot[0] = true;
      okBySlot[1] = true;
      okBySlot[2] = true;
    }
  }

  if (hasCompatIssue && !roll.hasIssue) {
    if (cSelections[0] && cSelections[1] && !cSelections[2]) {
      okBySlot[0] = !isIncompatRow(cSelections[0]);
      okBySlot[1] = !isIncompatRow(cSelections[1]);
    }
    if (cSelections[0] && cSelections[1] && cSelections[2]) {
      okBySlot[0] = !isIncompatRow(cSelections[0]);
      okBySlot[1] = !isIncompatRow(cSelections[1]);
      okBySlot[2] = !isIncompatRow(cSelections[2]);
    }
  }

  const allThreeSelected = !!cSelections[0] && !!cSelections[1] && !!cSelections[2];
  if (allThreeSelected && roll.hasIssue) {
    const deltas = roll.moveDeltaBySlot.slice(0, 3);
    const zeros = deltas
      .map((d, idx) => ({ d, idx }))
      .filter(x => x.d === 0);

    if (zeros.length === 1) {
      const idx = zeros[0].idx;
      const rowByIdx = cSelections[idx];
      if (!isIncompatRow(rowByIdx)) okBySlot[idx] = true;
    }
  }

  const effectButtonDisabled = [false, !cSelections[0], !(cSelections[0] && cSelections[1])];

  function renderSlot(idx, row, moveDelta, showOk, badge) {
    const effectBtnLabel = row ? "Change Effect" : "Select Effect";
    return renderChosenLine(slotLabel(idx), row, showRaw, moveDelta, showOk, badge, {
      effectSlot: idx,
      effectButtonLabel: effectBtnLabel,
      effectButtonDisabled: effectButtonDisabled[idx],
      curseRequired: String(row?.CurseRequired ?? "0") === "1",
      curseRow: getAnyRow(curseBySlot[idx]),
      curseButtonLabel: curseBySlot[idx] ? "Change Curse" : "Select a Curse",
      curseSlot: idx
    });
  }

  if (!cSelections[0]) {
    setDetailsEmpty();

    dom.chosenList.innerHTML =
      renderSlot(0, null, 0, okBySlot[0], null) +
      renderSlot(1, null, 0, okBySlot[1], null) +
      renderSlot(2, null, 0, okBySlot[2], null);

    installEffectButtons();
    installCurseButtons();

    updateCounts(dom, 1, filtered1.length);
    setValidityBadge("Valid", false);
    return;
  }

  if (!cSelections[1]) {
    updateDetails(cSelections[0], null, null);

    dom.chosenList.innerHTML =
      renderSlot(0, cSelections[0], 0, okBySlot[0], badgeForRow(cSelections[0])) +
      renderSlot(1, null, 0, okBySlot[1], null) +
      renderSlot(2, null, 0, okBySlot[2], null);

    installEffectButtons();
    installCurseButtons();

    updateCounts(dom, 2, filtered2.length);
    return;
  }

  if (!cSelections[2]) {
    updateDetails(cSelections[0], cSelections[1], null);

    dom.chosenList.innerHTML =
      renderSlot(0, cSelections[0], roll.moveDeltaBySlot[0], okBySlot[0], badgeForRow(cSelections[0])) +
      renderSlot(1, cSelections[1], roll.moveDeltaBySlot[1], okBySlot[1], badgeForRow(cSelections[1])) +
      renderSlot(2, null, 0, okBySlot[2], null);

    installEffectButtons();
    installCurseButtons();

    updateCounts(dom, 3, filtered3.length);
    return;
  }

  updateDetails(cSelections[0], cSelections[1], cSelections[2]);

  dom.chosenList.innerHTML =
    renderSlot(0, cSelections[0], roll.moveDeltaBySlot[0], okBySlot[0], badgeForRow(cSelections[0])) +
    renderSlot(1, cSelections[1], roll.moveDeltaBySlot[1], okBySlot[1], badgeForRow(cSelections[1])) +
    renderSlot(2, cSelections[2], roll.moveDeltaBySlot[2], okBySlot[2], badgeForRow(cSelections[2]));

  installEffectButtons();
  installCurseButtons();

  updateCounts(dom, 3, filtered3.length);
}

function resetAllPreserveIllegal(desiredIllegal) {
  dom.selType.value = "All";
  dom.selColor.value = "Random";

  dom.showIllegalEl.checked = Boolean(desiredIllegal);
  if (dom.showRawEl) dom.showRawEl.checked = false;

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
  if (dom.showRawEl) dom.showRawEl.checked = false;

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

  dom.selType.addEventListener("change", () => updateUI("type-change"));
  dom.selColor.addEventListener("change", () => updateUI("color-change"));
  dom.showIllegalEl.addEventListener("change", () => resetAllPreserveIllegal(dom.showIllegalEl.checked));
  if (dom.showRawEl) dom.showRawEl.addEventListener("change", () => updateUI("raw-change"));
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
