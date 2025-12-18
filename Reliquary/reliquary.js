// Data (relative to Reliquary/index.html)
const DATA_URL = new URL("../data/reliquary.json", window.location.href).toString();

// Icon folder:
// assets/icons/reliquary/{StatusIconID}.png
function iconPath(statusIconId) {
  if (!statusIconId) return "";
  return new URL(`../assets/icons/reliquary/${statusIconId}.png`, window.location.href).toString();
}

// Default relic images (your confirmed path + filenames)
function relicDefaultPath(relicType) {
  const file = (relicType === "Depth Of Night") ? "depth_of_night.png" : "standard.png";
  return new URL(`../Assets/relics/default/${file}`, window.location.href).toString();
}

// Colored relics: assets/relics/{type}/{size}/{color}.png
function relicFolderForType(relicType) {
  return relicType === "Depth Of Night" ? "depth" : "standard";
}

function relicPath(relicType, color, size) {
  const type = relicFolderForType(relicType);
  const c = String(color).toLowerCase();
  const s = String(size).toLowerCase();
  return new URL(`../assets/relics/${type}/${s}/${c}.png`, window.location.href).toString();
}

const selType = document.getElementById("relicType");
const selColor = document.getElementById("relicColor");
const showIllegalEl = document.getElementById("showIllegal");

const cat1 = document.getElementById("cat1");
const cat2 = document.getElementById("cat2");
const cat3 = document.getElementById("cat3");

const sel1 = document.getElementById("effect1");
const sel2 = document.getElementById("effect2");
const sel3 = document.getElementById("effect3");

const count1 = document.getElementById("count1");
const count2 = document.getElementById("count2");
const count3 = document.getElementById("count3");

const relicImg = document.getElementById("relicImg");
const statusText = document.getElementById("statusText");
const detailsList = document.getElementById("detailsList");
const chosenList = document.getElementById("chosenList");

const COLORS = ["Red", "Blue", "Yellow", "Green"];

let rows = [];
let byId = new Map();
let currentRandomColor = "Red";

function normalize(v) {
  return (v ?? "").toString().trim();
}

function compatId(row) {
  return row?.CompatibilityID == null ? "" : String(row.CompatibilityID);
}

function relicTypeForRow(row) {
  return normalize(row?.RelicType);
}

function effectCategoryForRow(row) {
  return normalize(row?.EffectCategory);
}

function optionHtml(row) {
  const label = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  return `<option value="${row.EffectID}">${label}</option>`;
}

function fillSelect(selectEl, options, placeholderText) {
  const first = `<option value="">${placeholderText}</option>`;
  selectEl.innerHTML = first + options.map(optionHtml).join("");
}

function fillCategorySelect(catEl, categories) {
  const first = `<option value="">— All Categories —</option>`;
  const opts = categories.map(c => `<option value="${c}">${c}</option>`).join("");
  catEl.innerHTML = first + opts;
}

function getRow(effectId) {
  return byId.get(String(effectId)) ?? null;
}

function pickRandomColor() {
  currentRandomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
}

function effectiveColor() {
  const c = selColor.value;
  if (c === "Random") return currentRandomColor;
  return c;
}

function setRelicImageForStage(stage /* 0..3 */) {
  const relicType = selType.value;

  if (stage <= 0) {
    relicImg.src = relicDefaultPath(relicType);
    return;
  }

  const color = effectiveColor();
  const size = stage === 1 ? "Small" : stage === 2 ? "Medium" : "Large";
  relicImg.src = relicPath(relicType, color, size);
}

// If an image is missing, fall back to default
relicImg.addEventListener("error", () => {
  relicImg.src = relicDefaultPath(selType.value);
});

function baseFilteredByRelicType() {
  // IMPORTANT: "Both" rows should appear when user selects Standard OR Depth Of Night OR Both
  const selectedType = selType.value;

  return rows.filter(r => {
    const t = relicTypeForRow(r);
    if (selectedType === "Both") return t === "Both";
    if (selectedType === "Standard") return (t === "Standard" || t === "Both");
    if (selectedType === "Depth Of Night") return (t === "Depth Of Night" || t === "Both");
    return true;
  });
}

function categoriesFor(list) {
  const set = new Set(list.map(effectCategoryForRow).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function applyCategory(list, catValue) {
  const c = normalize(catValue);
  if (!c) return list;
  return list.filter(r => effectCategoryForRow(r) === c);
}

function eligibleList(blockedCompatIds, takenIds, showIllegal) {
  // Candidate pool starts with relic-type filtered list
  const pool = baseFilteredByRelicType();

  return pool.filter(r => {
    const id = String(r.EffectID);
    if (takenIds.has(id)) return false;
    if (showIllegal) return true;

    const cid = compatId(r);
    if (!cid) return true;
    return !blockedCompatIds.has(cid);
  });
}

function renderChosenLine(slotLabel, row) {
  if (!row) {
    return `
      <li>
        <div class="effect-icon" aria-hidden="true"></div>
        <div class="effect-line">
          <div class="title">${slotLabel}: <span class="pill">Empty</span></div>
          <div class="meta">Not selected</div>
        </div>
      </li>
    `;
  }

  const name = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  const cid = compatId(row) || "∅";
  const iconId = normalize(row.StatusIconID);
  const src = iconId ? iconPath(iconId) : "";

  return `
    <li>
      <div class="effect-icon" aria-hidden="true">
        ${src ? `<img src="${src}" alt="" onerror="this.remove()" />` : ""}
      </div>
      <div class="effect-line">
        <div class="title">${slotLabel}: ${name}</div>
        <div class="meta">
          EffectID <code>${row.EffectID}</code>
          • Compatibility <code>${cid}</code>
          ${iconId ? `• Icon <code>${iconId}</code>` : ``}
        </div>
      </div>
    </li>
  `;
}

function updateCounts(activeIndex, availableCount) {
  // Active-box-only behavior: show count only under the currently active effect box
  count1.textContent = "";
  count2.textContent = "";
  count3.textContent = "";

  const msg = `(${availableCount} Effects Available based on current selections)`;

  if (activeIndex === 1) count1.textContent = msg;
  if (activeIndex === 2) count2.textContent = msg;
  if (activeIndex === 3) count3.textContent = msg;
}

function updateUI(reason = "") {
  // If color is Random and a modifier changes, reroll
  if (selColor.value === "Random") {
    const modifierReasons = new Set([
      "type-change",
      "illegal-change",
      "cat-change",
      "effect-change"
    ]);
    if (modifierReasons.has(reason)) pickRandomColor();
  }

  const showIllegal = !!showIllegalEl.checked;

  const a = getRow(sel1.value);
  const b = getRow(sel2.value);
  const c = getRow(sel3.value);

  // Stage controls relic size
  const stage = c ? 3 : b ? 2 : a ? 1 : 0;
  setRelicImageForStage(stage);

  // IMPORTANT: do NOT exclude a dropdown's own current selection.
  const takenFor2 = new Set([sel1.value, sel3.value].filter(Boolean).map(String));
  const takenFor3 = new Set([sel1.value, sel2.value].filter(Boolean).map(String));

  // Build blocked sets
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
  sel1.disabled = false;
  cat1.disabled = false;

  sel2.disabled = !a;
  cat2.disabled = !a;

  sel3.disabled = !a || !b;
  cat3.disabled = !a || !b;

  // Build available lists for each stage
  const base1 = baseFilteredByRelicType();
  const filtered1 = applyCategory(base1, cat1.value);

  const eligible2 = a ? eligibleList(blockedFor2, takenFor2, showIllegal) : [];
  const filtered2 = applyCategory(eligible2, cat2.value);

  const eligible3 = (a && b) ? eligibleList(blockedFor3, takenFor3, showIllegal) : [];
  const filtered3 = applyCategory(eligible3, cat3.value);

  // Preserve selections if possible when refilling
  const prev1 = sel1.value;
  const prev2 = sel2.value;
  const prev3 = sel3.value;

  fillSelect(sel1, filtered1, "— Effect 1 —");

  // If Effect 1 got wiped, clear downstream
  if (![...sel1.options].some(o => o.value === prev1)) {
    sel1.value = "";
    sel2.value = "";
    sel3.value = "";
  } else {
    sel1.value = prev1;
  }

  const a2 = getRow(sel1.value);

  // Refill 2
  if (a2) {
    fillSelect(sel2, filtered2, "— Effect 2 —");
    if ([...sel2.options].some(o => o.value === prev2)) sel2.value = prev2;
    else sel2.value = "";
  } else {
    fillSelect(sel2, [], "— Effect 2 —");
    sel2.value = "";
  }

  const b2 = getRow(sel2.value);

  // Refill 3
  if (a2 && b2) {
    fillSelect(sel3, filtered3, "— Effect 3 —");
    if ([...sel3.options].some(o => o.value === prev3)) sel3.value = prev3;
    else sel3.value = "";
  } else {
    fillSelect(sel3, [], "— Effect 3 —");
    sel3.value = "";
  }

  const c2 = getRow(sel3.value);

  // Status + Details + Right panel
  if (!a2) {
    statusText.textContent = `Loaded ${rows.length} effects. Pick Effect 1 to begin.`;
    detailsList.innerHTML = `<li>Waiting for Effect 1…</li>`;
    chosenList.innerHTML = `
      <li>
        <div class="effect-icon" aria-hidden="true"></div>
        <div class="effect-line">
          <div class="title">No effects selected</div>
          <div class="meta">Pick Effect 1 to begin.</div>
        </div>
      </li>
    `;
    updateCounts(1, filtered1.length);
    return;
  }

  if (!b2) {
    statusText.textContent = `Effect 1 selected. Choose Effect 2.`;
    detailsList.innerHTML = `
      <li><strong>Effect 2 blocked CompatibilityIDs:</strong> <code>${[...blockedFor2].length ? [...blockedFor2].join(", ") : "None"}</code></li>
    `;
    chosenList.innerHTML =
      renderChosenLine("Effect 1", a2) +
      renderChosenLine("Effect 2", null) +
      renderChosenLine("Effect 3", null);

    updateCounts(2, filtered2.length);
    return;
  }

  if (!c2) {
    statusText.textContent = `Effects 1 & 2 selected. Choose Effect 3.`;
    detailsList.innerHTML = `
      <li><strong>Effect 2 blocked CompatibilityIDs:</strong> <code>${[...blockedFor2].length ? [...blockedFor2].join(", ") : "None"}</code></li>
      <li><strong>Effect 3 blocked CompatibilityIDs:</strong> <code>${[...blockedFor3].length ? [...blockedFor3].join(", ") : "None"}</code></li>
    `;
    chosenList.innerHTML =
      renderChosenLine("Effect 1", a2) +
      renderChosenLine("Effect 2", b2) +
      renderChosenLine("Effect 3", null);

    updateCounts(3, filtered3.length);
    return;
  }

  statusText.textContent = `All 3 effects selected.`;
  detailsList.innerHTML = `
    <li><strong>Effect 2 blocked CompatibilityIDs:</strong> <code>${[...blockedFor2].length ? [...blockedFor2].join(", ") : "None"}</code></li>
    <li><strong>Effect 3 blocked CompatibilityIDs:</strong> <code>${[...blockedFor3].length ? [...blockedFor3].join(", ") : "None"}</code></li>
  `;
  chosenList.innerHTML =
    renderChosenLine("Effect 1", a2) +
    renderChosenLine("Effect 2", b2) +
    renderChosenLine("Effect 3", c2);

  updateCounts(3, filtered3.length);
}

function onAnyFilterChange(reason) {
  updateUI(reason);
}

async function load() {
  statusText.textContent = "Loading data…";
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);

  rows = await res.json();
  byId = new Map(rows.map(r => [String(r.EffectID), r]));

  // Start random color
  pickRandomColor();

  // Fill categories from relic-type filtered list
  const base = baseFilteredByRelicType();
  const cats = categoriesFor(base);
  fillCategorySelect(cat1, cats);
  fillCategorySelect(cat2, cats);
  fillCategorySelect(cat3, cats);

  // Fill Effect 1 list; Effect 2/3 will be filled on updateUI
  fillSelect(sel1, base, "— Effect 1 —");
  fillSelect(sel2, [], "— Effect 2 —");
  fillSelect(sel3, [], "— Effect 3 —");

  // Default relic image for current type
  relicImg.src = relicDefaultPath(selType.value);

  // Wire events
  selType.addEventListener("change", () => onAnyFilterChange("type-change"));
  selColor.addEventListener("change", () => onAnyFilterChange("color-change"));
  showIllegalEl.addEventListener("change", () => onAnyFilterChange("illegal-change"));

  cat1.addEventListener("change", () => onAnyFilterChange("cat-change"));
  cat2.addEventListener("change", () => onAnyFilterChange("cat-change"));
  cat3.addEventListener("change", () => onAnyFilterChange("cat-change"));

  sel1.addEventListener("change", () => onAnyFilterChange("effect-change"));
  sel2.addEventListener("change", () => onAnyFilterChange("effect-change"));
  sel3.addEventListener("change", () => onAnyFilterChange("effect-change"));

  // First render
  updateUI("init");
}

load().catch(err => {
  console.error(err);
  statusText.textContent = "Failed to load reliquary data. Check console.";
  detailsList.innerHTML = `<li><code>${String(err.message || err)}</code></li>`;
  relicImg.src = "";
});
