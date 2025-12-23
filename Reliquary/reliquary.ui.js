import { relicDefaultPath, relicPath, visualRelicType } from "./reliquary.assets.js";

export function fillSelect(selectEl, options, placeholderText) {
  const first = `<option value="">${placeholderText}</option>`;
  selectEl.innerHTML = first + options.map(optionHtml).join("");
}

function optionHtml(row) {
  const label = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  return `<option value="${row.EffectID}">${label}</option>`;
}

export function fillCategorySelect(catEl, categories) {
  const first = `<option value="">All</option>`;
  const opts = categories.map(c => `<option value="${c}">${c}</option>`).join("");
  catEl.innerHTML = first + opts;
}

export function updateCounts(dom, activeIndex, availableCount) {
  dom.count1.textContent = "";
  dom.count2.textContent = "";
  dom.count3.textContent = "";

  const msg = `(${availableCount} Effects Available based on current selections)`;

  if (activeIndex === 1) dom.count1.textContent = msg;
  if (activeIndex === 2) dom.count2.textContent = msg;
  if (activeIndex === 3) dom.count3.textContent = msg;
}

export function installRelicImgFallback(relicImg, getSelectedType) {
  relicImg.addEventListener("error", () => {
    relicImg.src = relicDefaultPath(visualRelicType(getSelectedType()));
  });
}

export function setRelicImageForStage({
  relicImg,
  selectedType,
  selectedColor,
  randomColor,
  stage
}) {
  const typeForImages = visualRelicType(selectedType);

  if (stage <= 0) {
    relicImg.src = relicDefaultPath(typeForImages);
    return;
  }

  const color = (selectedColor === "Random") ? randomColor : selectedColor;
  const size = stage === 1 ? "Small" : stage === 2 ? "Medium" : "Large";
  relicImg.src = relicPath(typeForImages, color, size);
}

// Icon folder: Assets/icons/reliquary/{StatusIconID}.png
function iconPath(statusIconId) {
  if (!statusIconId) return "";
  return new URL(`../Assets/icons/reliquary/${statusIconId}.png`, window.location.href).toString();
}

function okIndicatorHtml() {
  return `
    <div class="move-indicator move-ok" aria-label="Correct position" title="Correct position">
      <span class="check-box" aria-hidden="true"></span>
    </div>
  `;
}


function rowBadgeHtml(text, kind = "invalid") {
  const cls = kind === "valid" ? "is-valid" : "is-invalid";
  return `<span class="validity-badge validity-badge--row ${cls}">${text}</span>`;
}

function moveIndicatorHtml(moveDelta, showOk = false) {
  const delta = Number(moveDelta || 0);

  // Only show green check for the special 3-effect case (controlled by caller)
  if (showOk) return okIndicatorHtml();

  if (!Number.isFinite(delta) || delta === 0) return "";

  const count = Math.min(3, Math.abs(delta));
  const dirClass = delta < 0 ? "move-up" : "move-down";

  const label = delta < 0
    ? `Move up ${count} ${count === 1 ? "slot" : "slots"}`
    : `Move down ${count} ${count === 1 ? "slot" : "slots"}`;

  const carrots = Array.from({ length: count })
    .map(() => `<span class="carrot" aria-hidden="true"></span>`)
    .join("");

  return `<div class="move-indicator ${dirClass}" aria-label="${label}" title="${label}">${carrots}</div>`;
}

export function renderChosenLine(slotLabel, row, showRaw, moveDelta = 0, showOk = false, rowBadge = null, opts = null) {
  const prefix = slotLabel ? `${slotLabel}: ` : "";

  // Empty slot
  if (!row) {
    const title = slotLabel
      ? `${prefix}<span class="pill">Empty</span>`
      : `<span class="pill">Empty</span>`;

    if (!showRaw) {
      return `
        <li>
          <div class="effect-row">
          <div class="effect-icon" aria-hidden="true"></div>
          <div class="effect-line">
            <div class="effect-main">
              <div class="title">${title}</div>
            </div>
          </div>
        </li>
      `;
    }

    return `
      <li>
          <div class="effect-row">
        <div class="effect-icon" aria-hidden="true"></div>
        <div class="effect-line">
          <div class="effect-main">
            <div class="title">${title}</div>
            <div class="meta"></div>
          </div>
        </div>
      </li>
    `;
  }

  const name = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  const cid = (row?.CompatibilityID == null) ? "∅" : String(row.CompatibilityID);
  const iconId = (row?.StatusIconID ?? "").toString().trim();
  const roll = (row?.RollOrder == null || String(row.RollOrder).trim() === "") ? "∅" : String(row.RollOrder);


  const curseRequired = !!(opts && opts.curseRequired);
  const curseRow = opts && opts.curseRow ? opts.curseRow : null;
  const curseName = curseRow ? (curseRow.EffectDescription ?? `(Effect ${curseRow.EffectID})`) : "";
  const curseSlot = opts && Number.isFinite(opts.curseSlot) ? opts.curseSlot : null;
  const curseBtnLabel = (opts && opts.curseButtonLabel) ? String(opts.curseButtonLabel) : "Select a Curse";

  const curseBtn = curseRequired && curseSlot != null
    ? `<button type="button" class="curse-btn" data-curse-slot="${curseSlot}">${curseBtnLabel}</button>`
    : "";

  const curseSub = curseRequired && curseName
    ? `<div class="curse-sub">${curseName}</div>`
    : "";


  const src = iconId ? iconPath(iconId) : "";
  const mover = moveIndicatorHtml(moveDelta, showOk);
  const badge = rowBadge ? rowBadgeHtml(rowBadge, "invalid") : "";

  // Curse missing should show the SAME red gradient as other invalid states.
  // We do this by adding a hidden per-row invalid badge that results.css already keys off of.
  const curseMissingFlag = (curseRequired && !curseRow)
    ? `<span class="validity-badge validity-badge--row is-invalid curse-missing-flag" style="display:none"></span>`
    : "";

  const indicators = (badge || mover || curseMissingFlag)
    ? `<div class="row-indicators">${curseMissingFlag}${badge}${mover}</div>`
    : "";

  // Compact
  if (!showRaw) {
    return `
      <li>
          <div class="effect-row">
        <div class="effect-icon" aria-hidden="true">
          ${src ? `<img src="${src}" alt="" onerror="this.remove()" />` : ""}
        </div>
        <div class="effect-line">
          <div class="effect-main">
            <div class="title"><span class="title-text">${prefix}${name}</span>${curseBtn}</div>
            ${curseSub}
          </div>
          ${indicators}
        </div>
      </li>
    `;
  }

  // Raw
  return `
    <li>
          <div class="effect-row">
      <div class="effect-icon" aria-hidden="true">
        ${src ? `<img src="${src}" alt="" onerror="this.remove()" />` : ""}
      </div>
      <div class="effect-line">
        <div class="effect-main effect-main--row">
          <div class="effect-text">
            <div class="title"><span class="title-text">${prefix}${name}</span></div>
            ${curseSub}
          </div>
          ${curseBtn}
          <div class="meta">
            EffectID <code>${row.EffectID}</code>
            • CompatibilityID <code>${cid}</code>
            • RollOrder <code>${roll}</code>
          </div>
        </div>
        ${indicators}
      </div>
    </li>
  `;
}

/* CURSE REQUIRED DETAILS START */
function renderCurseRequiredDetails() {
  return `
    <div class="info-box is-alert">
      <div class="info-line">
        <span>One or more of your effects requires a </span>
        <button class="term-link" type="button" aria-expanded="false">
          Curse
        </button>
      </div>
      <div class="popover" hidden>
        <h4 class="popover-title">Curse Required</h4>
        <div class="popover-body">
          <p>
            One or more selected effects requires a Curse to be chosen before this relic can be finalized.
            This Curse will negatively impact your character in exchange for the selected effect.
          </p>
          <p><em>(Placeholder) Future details about Curse selection will appear here.</em></p>
        </div>
      </div>
    </div>
  `;
}
/* CURSE REQUIRED DETAILS END */
