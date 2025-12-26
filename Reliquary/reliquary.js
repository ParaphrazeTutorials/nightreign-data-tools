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
  fillSelect,
  fillCategorySelect,
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
const curseBySlot = [null, null, null];
const curseCatBySlot = ["", "", ""]; // remembered per slot ("" = All)

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

  // Is the current selected-only ordering already correct?
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

  // Map slot -> packed index among selected items
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

    const delta = want - cur; // negative => move up; positive => move down
    moveDeltaBySlot[i] = delta;
    movedSlots[i] = delta !== 0;
  }

  // 3-slot sorted array for Details mini-preview (keeps empties in place)
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
let curseDialogList;
let curseDialogTitle;

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
            <span class="curse-field__label">Curse Effect</span>
            <select id="curseEffectSelect">
              <option value="">Select a Curse…</option>
            </select>
          </label>
        </div>
      </div>

      <footer class="curse-dialog__footer">
        <button type="button" class="secondary" id="curseCancelBtn">Cancel</button>
        <button type="submit" class="primary" id="curseSubmitBtn" disabled>Apply Curse</button>
      </footer>
    </form>
  `;
  document.body.appendChild(d);

  curseDialog = d;
  curseDialogTitle = d.querySelector("#curseDialogTitle");

  d.querySelector(".curse-dialog__close").onclick =
  d.querySelector("#curseCancelBtn").onclick = () => d.close("cancel");
}


function computeBlockedCompatForCurse(slotIdx) {
  const blocked = new Set();

  // Block compatibility groups already used by selected curses in OTHER slots.
  for (let i = 0; i < curseBySlot.length; i++) {
    if (i === slotIdx) continue;
    const id = curseBySlot[i];
    if (!id) continue;
    const row = getAnyRow(id);
    const cid = compatId(row);
    if (cid) blocked.add(String(cid));
  }

  // Also block groups used by selected effects (keeps overall rules consistent).
  const a = getRow(dom.sel1.value);
  const b = getRow(dom.sel2.value);
  const c = getRow(dom.sel3.value);

  // Keep curse selections consistent with current effect picks.
  const picked = [a, b, c];
  for (let i = 0; i < picked.length; i++) {
    const r = picked[i];
    const req = r && String(r?.CurseRequired ?? "0") === "1";
    if (!req) curseBySlot[i] = null;
  }
  for (const r of [a, b, c]) {
    if (!r) continue;
    const cid = compatId(r);
    if (cid) blocked.add(String(cid));
  }

  // Allow this slot's current selection (so you can reopen and keep it).
  const curId = curseBySlot[slotIdx];
  if (curId) {
    const curRow = getAnyRow(curId);
    const cid = compatId(curRow);
    if (cid) blocked.delete(String(cid));
  }

  return blocked;
}

function openCurseDialog(slotIdx) {
  ensureCurseDialog();
  if (!curseDialog) return;

  const catSel = curseDialog.querySelector("#curseCategorySelect");
  const effectSel = curseDialog.querySelector("#curseEffectSelect");
  if (!catSel || !effectSel) return;

  if (curseDialogTitle) curseDialogTitle.textContent = `Select a Curse for ${slotLabel(slotIdx)}`;

  const blockedCompat = computeBlockedCompatForCurse(slotIdx);

  // Respect current relic-type filter and compatibility rules.
  const eligibleCurses = baseFilteredByRelicType(curses, dom.selType.value)
    .filter(r => {
      const cid = compatId(r);
      if (!cid) return true;
      return !blockedCompat.has(String(cid));
    })
    .sort((x, y) => getRollValue(x) - getRollValue(y));

  const currentId = curseBySlot[slotIdx] ? String(curseBySlot[slotIdx]) : "";

  // If we already have a selected curse, default the category to that curse's category.
  if (!curseCatBySlot[slotIdx] && currentId) {
    const curRow = getAnyRow(currentId);
    const curCat = curRow ? String(curRow.EffectCategory || "").trim() : "";
    curseCatBySlot[slotIdx] = curCat;
  }

  // Build category list from eligible curses
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

    // Keep current selection if it still exists under this filter
    if (currentId && [...effectSel.options].some(o => o.value === currentId)) {
      effectSel.value = currentId;
    } else {
      effectSel.value = "";
    }
  }

  // initial render
  renderEffectOptions();

  // events
  catSel.onchange = () => renderEffectOptions();

  effectSel.onchange = () => {
    const v = String(effectSel.value || "");
    const submit = curseDialog.querySelector("#curseSubmitBtn");
    submit.disabled = !v;
  };

  const submitBtn = curseDialog.querySelector("#curseSubmitBtn");
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

  if (missingCurseSlots.length > 0)
  {
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
            <p><em>On Depth of Night Relics only, there are certain effects that cannot be rolled without an accompanying Curse, which adds a detrimental effect to your roll.</em> Select a Curse for each effect that requires one before your relic can be finalized.</p>
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
            <p>Behind the scenes, most effects share a Compatibility Group with one or more other effects. Relics cannot have more than one effect from any given Compatibility group.</p>
            <p>For example, Fire Attack Power Up and Holy Attack Power Up share a Compatibility Group, and cannot be on the same Relic.</p>
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
            <p>Behind the scenes, there is a value attached to each effect called "Roll Order", which determines the correct order each effect must be placed on the relic.</p>
          </div>
        </div>
      </div>
    `);
  }

  dom.detailsBody.innerHTML = blocks.join("");
  installDetailsToggles();

  // Details: raw intentionally disabled
  if (hasDup) {
    for (const g of dupGroups) {
      const listEl = dom.detailsBody.querySelector(`#${CSS.escape(g.listId)}`);
      if (!listEl) continue;

      const lines = g.list
        .slice(0, 3)
        .map(row => renderChosenLine("", row, false))
        .join("");

      listEl.innerHTML = lines;
    }
  }

  if (roll.hasIssue && roll.sorted) {
    const img = dom.detailsBody.querySelector("#sortedRelicImg");
    const list = dom.detailsBody.querySelector("#sortedChosenList");

    if (img) img.src = dom.relicImg?.src || "";

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
      "reset",
      "init",
      "raw-change"
    ]);
    if (modifierReasons.has(reason)) pickRandomColor();
  }

  const showIllegal = !!dom.showIllegalEl.checked;
  const showRaw = !!dom.showRawEl?.checked;

  if (resultsEl) resultsEl.classList.toggle("is-raw", showRaw);

  const a = getRow(dom.sel1.value);
  const b = getRow(dom.sel2.value);
  const c = getRow(dom.sel3.value);

  const stage = c ? 3 : b ? 2 : a ? 1 : 0;

  setRelicImageForStage({
    relicImg: dom.relicImg,
    selectedType: dom.selType.value,
    selectedColor: dom.selColor.value,
    randomColor: currentRandomColor,
    stage
  });

  const takenFor2 = new Set([dom.sel1.value, dom.sel3.value].filter(Boolean).map(String));
  const takenFor3 = new Set([dom.sel1.value, dom.sel2.value].filter(Boolean).map(String));

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

  dom.sel1.disabled = false;
  dom.cat1.disabled = false;

  dom.sel2.disabled = !a;
  dom.cat2.disabled = !a;

  dom.sel3.disabled = !a || !b;
  dom.cat3.disabled = !a || !b;

  const base1 = baseFilteredByRelicType(rows, dom.selType.value);
  const filtered1 = applyCategory(base1, dom.cat1.value);

  const eligible2 = a ? eligibleList(rows, dom.selType.value, blockedFor2, takenFor2, showIllegal) : [];
  const filtered2 = applyCategory(eligible2, dom.cat2.value);

  const eligible3 = (a && b) ? eligibleList(rows, dom.selType.value, blockedFor3, takenFor3, showIllegal) : [];
  const filtered3 = applyCategory(eligible3, dom.cat3.value);

  const prev1 = dom.sel1.value;
  const prev2 = dom.sel2.value;
  const prev3 = dom.sel3.value;

  fillSelect(dom.sel1, filtered1, "— Effect 1 —");
  if (![...dom.sel1.options].some(o => o.value === prev1)) {
    dom.sel1.value = "";
    dom.sel2.value = "";
    dom.sel3.value = "";
  } else {
    dom.sel1.value = prev1;
  }

  const a2 = getRow(dom.sel1.value);

  if (a2) {
    fillSelect(dom.sel2, filtered2, "— Effect 2 —");
    dom.sel2.value = [...dom.sel2.options].some(o => o.value === prev2) ? prev2 : "";
  } else {
    fillSelect(dom.sel2, [], "— Effect 2 —");
    dom.sel2.value = "";
  }

  const b2 = getRow(dom.sel2.value);

  if (a2 && b2) {
    fillSelect(dom.sel3, filtered3, "— Effect 3 —");
    dom.sel3.value = [...dom.sel3.options].some(o => o.value === prev3) ? prev3 : "";
  } else {
    fillSelect(dom.sel3, [], "— Effect 3 —");
    dom.sel3.value = "";
  }

  const c2 = getRow(dom.sel3.value);

  const anySelected = !!a2 || !!b2 || !!c2;
  const dupGroups = computeCompatDupGroups([a2, b2, c2].filter(Boolean));
  const hasCompatIssue = dupGroups.length > 0;

  // Row-level Compatibility Group conflicts (used for per-row indicators)
  const compatConflictIds = (() => {
    const m = new Map();
    for (const r of [a2, b2, c2].filter(Boolean)) {
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

  const roll = computeRollOrderIssue(a2, b2, c2);
  const hasOrderIssue = roll.hasIssue;

  const hasCurseMissing = (() => {
    const orig = [a2, b2, c2];
    for (let i = 0; i < orig.length; i++) {
      const r = orig[i];
      if (!r) continue;
      const req = String(r?.CurseRequired ?? "0") === "1";
      if (req && !curseBySlot[i]) return true;
    }
    return false;
  })();

  const state = anySelected && (hasCompatIssue || hasOrderIssue || hasCurseMissing) ? "Invalid" : "Valid";
  setValidityBadge(state, anySelected);

  // --- Validity + checkmark indicators ---
  // When the relic is valid at 1 or 2 effects, show green check(s) and green row gradient.
  const okBySlot = [false, false, false];

  if (state === "Valid") {
    // 1-effect relics should immediately show as valid
    if (a2 && !b2 && !c2) okBySlot[0] = true;

    // 2-effect relics: if there is no roll-order issue, both are correct
    if (a2 && b2 && !c2 && !roll.hasIssue && !hasCompatIssue) {
      okBySlot[0] = true;
      okBySlot[1] = true;
    }

    // 3-effect relics: if fully valid, all three are correct
    if (a2 && b2 && c2 && !roll.hasIssue && !hasCompatIssue) {
      okBySlot[0] = true;
      okBySlot[1] = true;
      okBySlot[2] = true;
    }
  }

  // If the relic is invalid ONLY due to Compatibility conflicts (but roll order is correct),
  // still show green checks on the non-incompatible row(s).
  if (hasCompatIssue && !roll.hasIssue) {
    if (a2 && b2 && !c2) {
      okBySlot[0] = !isIncompatRow(a2);
      okBySlot[1] = !isIncompatRow(b2);
    }
    if (a2 && b2 && c2) {
      okBySlot[0] = !isIncompatRow(a2);
      okBySlot[1] = !isIncompatRow(b2);
      okBySlot[2] = !isIncompatRow(c2);
    }
  }

  // Special checkmark condition (exactly 3 effects selected)
  // If roll order is invalid and exactly one slot is already in the correct position,
  // show a green checkbox on that slot.
  const allThreeSelected = !!a2 && !!b2 && !!c2;

  if (allThreeSelected && roll.hasIssue) {
    const deltas = roll.moveDeltaBySlot.slice(0, 3);
    const zeros = deltas
      .map((d, idx) => ({ d, idx }))
      .filter(x => x.d === 0);

    // “only two need to move” => exactly one is correct
    if (zeros.length === 1) {
      const idx = zeros[0].idx;
      const rowByIdx = idx === 0 ? a2 : idx === 1 ? b2 : c2;
      if (!isIncompatRow(rowByIdx)) okBySlot[idx] = true;
    }
  }

  // Preview rendering
  if (!a2) {
    setDetailsEmpty();

    dom.chosenList.innerHTML =
      renderChosenLine("", null, showRaw) +
      renderChosenLine("", null, showRaw) +
      renderChosenLine("", null, showRaw);

    installCurseButtons();

    updateCounts(dom, 1, filtered1.length);
    setValidityBadge("Valid", false);
    return;
  }

  if (!b2) {
    // With only Effect 1 selected, still show Details if a curse is required/missing.
    updateDetails(a2, null, null);

    dom.chosenList.innerHTML =
      renderChosenLine("", a2, showRaw, 0, okBySlot[0], badgeForRow(a2), {
      curseRequired: String(a2?.CurseRequired ?? "0") === "1",
      curseRow: getAnyRow(curseBySlot[0]),
      curseButtonLabel: curseBySlot[0] ? "Change Curse" : "Select a Curse",
      curseSlot: 0
    }) +
      renderChosenLine("", null, showRaw) +
      renderChosenLine("", null, showRaw);

    installCurseButtons();

    updateCounts(dom, 2, filtered2.length);
    return;
  }

  if (!c2) {
    updateDetails(a2, b2, null);

    dom.chosenList.innerHTML =
      renderChosenLine("", a2, showRaw, roll.moveDeltaBySlot[0], okBySlot[0], badgeForRow(a2), {
      curseRequired: String(a2?.CurseRequired ?? "0") === "1",
      curseRow: getAnyRow(curseBySlot[0]),
      curseButtonLabel: curseBySlot[0] ? "Change Curse" : "Select a Curse",
      curseSlot: 0
    }) +
      renderChosenLine("", b2, showRaw, roll.moveDeltaBySlot[1], okBySlot[1], badgeForRow(b2), {
      curseRequired: String(b2?.CurseRequired ?? "0") === "1",
      curseRow: getAnyRow(curseBySlot[1]),
      curseButtonLabel: curseBySlot[1] ? "Change Curse" : "Select a Curse",
      curseSlot: 1
    }) +
      renderChosenLine("", null, showRaw);

    installCurseButtons();

    updateCounts(dom, 3, filtered3.length);
    return;
  }

  updateDetails(a2, b2, c2);

  dom.chosenList.innerHTML =
    renderChosenLine("", a2, showRaw, roll.moveDeltaBySlot[0], okBySlot[0], badgeForRow(a2), {
      curseRequired: String(a2?.CurseRequired ?? "0") === "1",
      curseRow: getAnyRow(curseBySlot[0]),
      curseButtonLabel: curseBySlot[0] ? "Change Curse" : "Select a Curse",
      curseSlot: 0
    }) +
    renderChosenLine("", b2, showRaw, roll.moveDeltaBySlot[1], okBySlot[1], badgeForRow(b2), {
      curseRequired: String(b2?.CurseRequired ?? "0") === "1",
      curseRow: getAnyRow(curseBySlot[1]),
      curseButtonLabel: curseBySlot[1] ? "Change Curse" : "Select a Curse",
      curseSlot: 1
    }) +
    renderChosenLine("", c2, showRaw, roll.moveDeltaBySlot[2], okBySlot[2], badgeForRow(c2), {
      curseRequired: String(c2?.CurseRequired ?? "0") === "1",
      curseRow: getAnyRow(curseBySlot[2]),
      curseButtonLabel: curseBySlot[2] ? "Change Curse" : "Select a Curse",
      curseSlot: 2
    });

    installCurseButtons();

  updateCounts(dom, 3, filtered3.length);
}

function resetAllPreserveIllegal(desiredIllegal) {
  dom.selType.value = "All";
  dom.selColor.value = "Random";

  // Preserve Show Illegal Combinations state (the user just toggled it)
  dom.showIllegalEl.checked = Boolean(desiredIllegal);

  // Start Over behavior: Raw Data off, all selections cleared, default color repicked
  if (dom.showRawEl) dom.showRawEl.checked = false;

  dom.cat1.value = "";
  dom.cat2.value = "";
  dom.cat3.value = "";

  dom.sel1.value = "";
  dom.sel2.value = "";
  dom.sel3.value = "";

  // Clear any selected curses (forces re-pick after effect changes/reset)
  for (let i = 0; i < curseBySlot.length; i++) curseBySlot[i] = null;

  pickRandomColor();
  updateUI("illegal-change");
}

function resetAll() {
  dom.selType.value = "All";
  dom.selColor.value = "Random";

  dom.showIllegalEl.checked = false;
  if (dom.showRawEl) dom.showRawEl.checked = false;

  dom.cat1.value = "";
  dom.cat2.value = "";
  dom.cat3.value = "";

  dom.sel1.value = "";
  dom.sel2.value = "";
  dom.sel3.value = "";

  // Clear any selected curses (forces re-pick after effect changes/reset)
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
  // Filter out cursed effects (Curse = 1) from main dropdowns and categories.
  // Data values are strings in JSON, so compare as strings.
  rows = rowsAll.filter(r => String(r?.Curse ?? "0") !== "1");
  byId = new Map(rows.map(r => [String(r.EffectID), r]));
pickRandomColor();

  const base = baseFilteredByRelicType(rows, dom.selType.value);
  const cats = categoriesFor(base);
  fillCategorySelect(dom.cat1, cats);
  fillCategorySelect(dom.cat2, cats);
  fillCategorySelect(dom.cat3, cats);

  fillSelect(dom.sel1, base, "— Effect 1 —");
  fillSelect(dom.sel2, [], "— Effect 2 —");
  fillSelect(dom.sel3, [], "— Effect 3 —");

  dom.relicImg.src = relicDefaultPath(visualRelicType(dom.selType.value));
  installRelicImgFallback(dom.relicImg, () => dom.selType.value);

  dom.selType.addEventListener("change", () => updateUI("type-change"));
  dom.selColor.addEventListener("change", () => updateUI("color-change"));
  dom.showIllegalEl.addEventListener("change", () => resetAllPreserveIllegal(dom.showIllegalEl.checked));
  if (dom.showRawEl) dom.showRawEl.addEventListener("change", () => updateUI("raw-change"));

  dom.cat1.addEventListener("change", () => updateUI("cat-change"));
  dom.cat2.addEventListener("change", () => updateUI("cat-change"));
  dom.cat3.addEventListener("change", () => updateUI("cat-change"));

  dom.sel1.addEventListener("change", () => {
    // Any effect change forces curse re-pick for that slot
    curseBySlot[0] = null;
    const chosen = getRow(dom.sel1.value);
    const nextType = autoRelicTypeFromEffect1(dom.selType.value, chosen);
    if (nextType) dom.selType.value = nextType;
    updateUI("effect-change");
  });

  dom.sel2.addEventListener("change", () => {
    // Any effect change forces curse re-pick for that slot
    curseBySlot[1] = null;
    updateUI("effect-change");
  });
  dom.sel3.addEventListener("change", () => {
    // Any effect change forces curse re-pick for that slot
    curseBySlot[2] = null;
    updateUI("effect-change");
  });

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