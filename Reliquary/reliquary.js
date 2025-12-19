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
let currentRandomColor = "Red";

function pickRandomColor() {
  currentRandomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
}

function getRow(effectId) {
  if (!effectId) return null;
  return byId.get(String(effectId)) ?? null;
}

function computeValidity(selectedRows) {
  const seen = new Set();
  for (const r of selectedRows) {
    if (!r) continue;
    const cid = compatId(r);
    if (!cid) continue;
    if (seen.has(cid)) return "Invalid";
    seen.add(cid);
  }
  return "Valid";
}

function applyHeaderValidityClasses(state, anySelected) {
  if (!resultsHeader) return;

  resultsHeader.classList.remove("is-valid", "is-invalid");

  if (!anySelected) return;
  if (state === "Valid") resultsHeader.classList.add("is-valid");
  if (state === "Invalid") resultsHeader.classList.add("is-invalid");
}

function updateValidityBadge(a, b, c) {
  if (!validityBadge) return;

  const anySelected = !!a || !!b || !!c;
  if (!anySelected) {
    validityBadge.hidden = true;
    validityBadge.classList.remove("is-valid", "is-invalid");
    applyHeaderValidityClasses(null, false);
    return;
  }

  const state = computeValidity([a, b, c]);

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
  // renderChosenLine starts with `<li>`; we just add a class.
  return html.replace("<li>", `<li class="reorder-changed">`);
}

function updateDetails(a, b, c, showRaw) {
  if (!dom.detailsBody) return;

  const selected = [a, b, c].filter(Boolean);
  if (selected.length === 0) {
    dom.detailsBody.innerHTML = "";
    return;
  }

  const blocks = [];

  // 1) Compatibility duplicates
  const counts = new Map();
  for (const r of selected) {
    const id = compatId(r);
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const hasDup = [...counts.values()].some(v => v > 1);

  if (hasDup) {
    blocks.push(`
      <div class="info-box is-alert" data-kind="compat-dup">
        <div class="info-line">
          You have two effects that share a
          <button type="button" class="term-link" data-popover-toggle="compatPopover">
            Compatibility Group
          </button>.
        </div>

        <div class="popover" id="compatPopover" hidden>
          <div class="popover-title">Compatibility Group</div>
          <div class="popover-body">
            <p>TODO: Add your explanation text here.</p>
          </div>
        </div>
      </div>
    `);
  }

  // 2) RollOrder not sorted -> expandable "in the correct order"
  let needsSortedPreview = false;
  let sorted = null;
  let movedSlots = [false, false, false]; // which slots (1..3) changed after sorting

  if (a && b && c) {
    const oa = Number.parseInt(a.RollOrder, 10);
    const ob = Number.parseInt(b.RollOrder, 10);
    const oc = Number.parseInt(c.RollOrder, 10);

    const okNums = Number.isFinite(oa) && Number.isFinite(ob) && Number.isFinite(oc);
    const inOrder = okNums && (oa <= ob) && (ob <= oc);

    if (!inOrder) {
      needsSortedPreview = true;

      const original = [a, b, c];
      sorted = original.slice().sort((x, y) => {
        const rx = Number.parseInt(x.RollOrder, 10);
        const ry = Number.parseInt(y.RollOrder, 10);
        const ax = Number.isFinite(rx) ? rx : Number.MAX_SAFE_INTEGER;
        const ay = Number.isFinite(ry) ? ry : Number.MAX_SAFE_INTEGER;
        return ax - ay;
      });

      movedSlots = original.map((row, idx) => {
        return String(row.EffectID) !== String(sorted[idx].EffectID);
      });

      blocks.push(`
        <div class="info-box is-alert" data-kind="rollorder">
          <div class="info-line">
            Your effects aren't
            <button type="button" class="term-link" data-popover-toggle="orderPopover">
              in the correct order
            </button>.
          </div>

          <div class="popover" id="orderPopover" hidden>
            <div class="popover-title">Correct Order</div>
            <div class="popover-body">
              <p>TODO: Add your explanation text here.</p>
            </div>

            <div class="sorted-preview">
              <div class="relic-preview relic-preview--mini">
                <div class="relic-frame relic-frame--mini">
                  <img id="sortedRelicImg" alt="" />
                </div>

                <div class="relic-effects">
                  <ul class="chosen-effects" id="sortedChosenList"></ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
    }
  }

  dom.detailsBody.innerHTML = blocks.join("");

  installDetailsToggles();

  // Render sorted preview if present
  if (needsSortedPreview && sorted) {
    const img = dom.detailsBody.querySelector("#sortedRelicImg");
    const list = dom.detailsBody.querySelector("#sortedChosenList");

    if (img) img.src = dom.relicImg?.src || "";

    if (list) {
      let line1 = renderChosenLine("Effect 1", sorted[0], showRaw);
      let line2 = renderChosenLine("Effect 2", sorted[1], showRaw);
      let line3 = renderChosenLine("Effect 3", sorted[2], showRaw);

      if (movedSlots[0]) line1 = markLineReordered(line1);
      if (movedSlots[1]) line2 = markLineReordered(line2);
      if (movedSlots[2]) line3 = markLineReordered(line3);

      list.innerHTML = line1 + line2 + line3;
    }
  }
}

function updateUI(reason = "") {
  // Random color reroll on meaningful changes
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

  // Stage controls relic size
  const stage = c ? 3 : b ? 2 : a ? 1 : 0;

  setRelicImageForStage({
    relicImg: dom.relicImg,
    selectedType: dom.selType.value,
    selectedColor: dom.selColor.value,
    randomColor: currentRandomColor,
    stage
  });

  updateValidityBadge(a, b, c);

  // Exclude duplicates by ID (but don't exclude the dropdown's own current selection)
  const takenFor2 = new Set([dom.sel1.value, dom.sel3.value].filter(Boolean).map(String));
  const takenFor3 = new Set([dom.sel1.value, dom.sel2.value].filter(Boolean).map(String));

  // Build blocked compat sets
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

  // Enable flow
  dom.sel1.disabled = false;
  dom.cat1.disabled = false;

  dom.sel2.disabled = !a;
  dom.cat2.disabled = !a;

  dom.sel3.disabled = !a || !b;
  dom.cat3.disabled = !a || !b;

  // Available lists
  const base1 = baseFilteredByRelicType(rows, dom.selType.value);
  const filtered1 = applyCategory(base1, dom.cat1.value);

  const eligible2 = a ? eligibleList(rows, dom.selType.value, blockedFor2, takenFor2, showIllegal) : [];
  const filtered2 = applyCategory(eligible2, dom.cat2.value);

  const eligible3 = (a && b) ? eligibleList(rows, dom.selType.value, blockedFor3, takenFor3, showIllegal) : [];
  const filtered3 = applyCategory(eligible3, dom.cat3.value);

  // Preserve selections
  const prev1 = dom.sel1.value;
  const prev2 = dom.sel2.value;
  const prev3 = dom.sel3.value;

  // Fill Effect 1
  fillSelect(dom.sel1, filtered1, "— Effect 1 —");
  if (![...dom.sel1.options].some(o => o.value === prev1)) {
    dom.sel1.value = "";
    dom.sel2.value = "";
    dom.sel3.value = "";
  } else {
    dom.sel1.value = prev1;
  }

  const a2 = getRow(dom.sel1.value);

  // Fill Effect 2
  if (a2) {
    fillSelect(dom.sel2, filtered2, "— Effect 2 —");
    dom.sel2.value = [...dom.sel2.options].some(o => o.value === prev2) ? prev2 : "";
  } else {
    fillSelect(dom.sel2, [], "— Effect 2 —");
    dom.sel2.value = "";
  }

  const b2 = getRow(dom.sel2.value);

  // Fill Effect 3
  if (a2 && b2) {
    fillSelect(dom.sel3, filtered3, "— Effect 3 —");
    dom.sel3.value = [...dom.sel3.options].some(o => o.value === prev3) ? prev3 : "";
  } else {
    fillSelect(dom.sel3, [], "— Effect 3 —");
    dom.sel3.value = "";
  }

  const c2 = getRow(dom.sel3.value);

  // Preview rendering
  if (!a2) {
    setDetailsEmpty();

    dom.chosenList.innerHTML =
      renderChosenLine("Effect 1", null, showRaw) +
      renderChosenLine("Effect 2", null, showRaw) +
      renderChosenLine("Effect 3", null, showRaw);

    updateCounts(dom, 1, filtered1.length);
    updateValidityBadge(null, null, null);
    return;
  }

  if (!b2) {
    updateDetails(a2, null, null, showRaw);

    dom.chosenList.innerHTML =
      renderChosenLine("Effect 1", a2, showRaw) +
      renderChosenLine("Effect 2", null, showRaw) +
      renderChosenLine("Effect 3", null, showRaw);

    updateCounts(dom, 2, filtered2.length);
    return;
  }

  if (!c2) {
    updateDetails(a2, b2, null, showRaw);

    dom.chosenList.innerHTML =
      renderChosenLine("Effect 1", a2, showRaw) +
      renderChosenLine("Effect 2", b2, showRaw) +
      renderChosenLine("Effect 3", null, showRaw);

    updateCounts(dom, 3, filtered3.length);
    return;
  }

  updateDetails(a2, b2, c2, showRaw);

  dom.chosenList.innerHTML =
    renderChosenLine("Effect 1", a2, showRaw) +
    renderChosenLine("Effect 2", b2, showRaw) +
    renderChosenLine("Effect 3", c2, showRaw);

  updateCounts(dom, 3, filtered3.length);
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

  pickRandomColor();
  updateUI("reset");
}

async function load() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);

  rows = await res.json();
  byId = new Map(rows.map(r => [String(r.EffectID), r]));

  pickRandomColor();

  // Categories
  const base = baseFilteredByRelicType(rows, dom.selType.value);
  const cats = categoriesFor(base);
  fillCategorySelect(dom.cat1, cats);
  fillCategorySelect(dom.cat2, cats);
  fillCategorySelect(dom.cat3, cats);

  // Initial lists
  fillSelect(dom.sel1, base, "— Effect 1 —");
  fillSelect(dom.sel2, [], "— Effect 2 —");
  fillSelect(dom.sel3, [], "— Effect 3 —");

  // Default relic
  dom.relicImg.src = relicDefaultPath(visualRelicType(dom.selType.value));
  installRelicImgFallback(dom.relicImg, () => dom.selType.value);

  // Events
  dom.selType.addEventListener("change", () => updateUI("type-change"));
  dom.selColor.addEventListener("change", () => updateUI("color-change"));
  dom.showIllegalEl.addEventListener("change", () => updateUI("illegal-change"));
  if (dom.showRawEl) dom.showRawEl.addEventListener("change", () => updateUI("raw-change"));

  dom.cat1.addEventListener("change", () => updateUI("cat-change"));
  dom.cat2.addEventListener("change", () => updateUI("cat-change"));
  dom.cat3.addEventListener("change", () => updateUI("cat-change"));

  dom.sel1.addEventListener("change", () => {
    const chosen = getRow(dom.sel1.value);
    const nextType = autoRelicTypeFromEffect1(dom.selType.value, chosen);
    if (nextType) dom.selType.value = nextType;
    updateUI("effect-change");
  });

  dom.sel2.addEventListener("change", () => updateUI("effect-change"));
  dom.sel3.addEventListener("change", () => updateUI("effect-change"));

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
