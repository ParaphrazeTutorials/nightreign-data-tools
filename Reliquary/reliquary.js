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

// App state
let rows = [];
let byId = new Map();
let currentRandomColor = "Red";

function pickRandomColor() {
  currentRandomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
}

function getRow(effectId) {
  return byId.get(String(effectId)) ?? null;
}

function updateUI(reason = "") {
  // If color is Random and a modifier changes, reroll
  if (dom.selColor.value === "Random") {
    const modifierReasons = new Set(["type-change", "illegal-change", "cat-change", "effect-change", "reset", "init"]);
    if (modifierReasons.has(reason)) pickRandomColor();
  }

  const showIllegal = !!dom.showIllegalEl.checked;

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

  // do NOT exclude a dropdown's own current selection
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

  // Enable flow
  dom.sel1.disabled = false;
  dom.cat1.disabled = false;

  dom.sel2.disabled = !a;
  dom.cat2.disabled = !a;

  dom.sel3.disabled = !a || !b;
  dom.cat3.disabled = !a || !b;

  // Lists
  const base1 = baseFilteredByRelicType(rows, dom.selType.value);
  const filtered1 = applyCategory(base1, dom.cat1.value);

  const eligible2 = a ? eligibleList(rows, dom.selType.value, blockedFor2, takenFor2, showIllegal) : [];
  const filtered2 = applyCategory(eligible2, dom.cat2.value);

  const eligible3 = (a && b) ? eligibleList(rows, dom.selType.value, blockedFor3, takenFor3, showIllegal) : [];
  const filtered3 = applyCategory(eligible3, dom.cat3.value);

  // Preserve selections when refilling
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

  // Right panel
  if (!a2) {
    dom.statusText.textContent = `Loaded ${rows.length} effects. Pick Effect 1 to begin.`;
    dom.detailsList.innerHTML = `<li>Waiting for Effect 1…</li>`;
    dom.chosenList.innerHTML = `
      <li>
        <div class="effect-icon" aria-hidden="true"></div>
        <div class="effect-line">
          <div class="title">No effects selected</div>
          <div class="meta">Pick Effect 1 to begin.</div>
        </div>
      </li>
    `;
    updateCounts(dom, 1, filtered1.length);
    return;
  }

  if (!b2) {
    dom.statusText.textContent = `Effect 1 selected. Choose Effect 2.`;
    dom.detailsList.innerHTML = `
      <li><strong>Effect 2 blocked CompatibilityIDs:</strong> <code>${[...blockedFor2].length ? [...blockedFor2].join(", ") : "None"}</code></li>
    `;
    dom.chosenList.innerHTML =
      renderChosenLine("Effect 1", a2) +
      renderChosenLine("Effect 2", null) +
      renderChosenLine("Effect 3", null);

    updateCounts(dom, 2, filtered2.length);
    return;
  }

  if (!c2) {
    dom.statusText.textContent = `Effects 1 & 2 selected. Choose Effect 3.`;
    dom.detailsList.innerHTML = `
      <li><strong>Effect 2 blocked CompatibilityIDs:</strong> <code>${[...blockedFor2].length ? [...blockedFor2].join(", ") : "None"}</code></li>
      <li><strong>Effect 3 blocked CompatibilityIDs:</strong> <code>${[...blockedFor3].length ? [...blockedFor3].join(", ") : "None"}</code></li>
    `;
    dom.chosenList.innerHTML =
      renderChosenLine("Effect 1", a2) +
      renderChosenLine("Effect 2", b2) +
      renderChosenLine("Effect 3", null);

    updateCounts(dom, 3, filtered3.length);
    return;
  }

  dom.statusText.textContent = `All 3 effects selected.`;
  dom.detailsList.innerHTML = `
    <li><strong>Effect 2 blocked CompatibilityIDs:</strong> <code>${[...blockedFor2].length ? [...blockedFor2].join(", ") : "None"}</code></li>
    <li><strong>Effect 3 blocked CompatibilityIDs:</strong> <code>${[...blockedFor3].length ? [...blockedFor3].join(", ") : "None"}</code></li>
  `;
  dom.chosenList.innerHTML =
    renderChosenLine("Effect 1", a2) +
    renderChosenLine("Effect 2", b2) +
    renderChosenLine("Effect 3", c2);

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
  dom.statusText.textContent = "Loading data…";

  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);

  rows = await res.json();
  byId = new Map(rows.map(r => [String(r.EffectID), r]));

  pickRandomColor();

  // Categories based on relic-type filtered list
  const base = baseFilteredByRelicType(rows, dom.selType.value);
  const cats = categoriesFor(base);
  fillCategorySelect(dom.cat1, cats);
  fillCategorySelect(dom.cat2, cats);
  fillCategorySelect(dom.cat3, cats);

  // Fill Effect 1; 2/3 filled on update
  fillSelect(dom.sel1, base, "— Effect 1 —");
  fillSelect(dom.sel2, [], "— Effect 2 —");
  fillSelect(dom.sel3, [], "— Effect 3 —");

  // Default relic image
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
  dom.statusText.textContent = "Failed to load reliquary data. Check console.";
  dom.detailsList.innerHTML = `<li><code>${String(err.message || err)}</code></li>`;
  dom.relicImg.src = "";
});
