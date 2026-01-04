import { relicDefaultPath, relicPath, visualRelicType } from "./reliquary.assets.js";

export function fillSelect(selectEl, options, placeholderText) {
  const first = `<option value="">${placeholderText}</option>`;
  selectEl.innerHTML = first + options.map(optionHtml).join("");
}

function optionHtml(row) {
  const label = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  return `<option value="${row.EffectID}">${label}</option>`;
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
  // Only prepend the slot label when the slot is empty; selected rows should just show the effect name
  const prefix = (!row && slotLabel) ? `${slotLabel}: ` : "";

  const effectSlot = opts && Number.isFinite(opts.effectSlot) ? opts.effectSlot : null;
  const effectBtnLabel = (opts && opts.effectButtonLabel) ? String(opts.effectButtonLabel) : "Select Effect";
  const effectBtnDisabled = !!(opts && opts.effectButtonDisabled);

  const effectBtn = effectSlot != null
    ? `<button type="button" class="effect-btn" data-effect-slot="${effectSlot}" ${effectBtnDisabled ? "disabled" : ""}>${effectBtnLabel}</button>`
    : "";

  // Precompute effect meta fields (used in tooltip and meta block)
  const name = row?.EffectDescription ?? (row ? `(Effect ${row.EffectID})` : "");
  const cid = row?.CompatibilityID == null ? "∅" : String(row.CompatibilityID);
  const iconId = row?.StatusIconID ? row.StatusIconID.toString().trim() : "";
  const roll = (row?.RollOrder == null || String(row.RollOrder).trim() === "") ? "∅" : String(row.RollOrder);

  const effectInfoParts = row
    ? [
        `EffectID ${row.EffectID}`,
        `Compatibility ${cid}`,
        `RollOrder ${roll}`,
        ...(opts && opts.curseRow ? [`CurseID ${opts.curseRow.EffectID}`, `CurseCompatibility ${opts.curseRow.CompatibilityID ?? "∅"}`] : [])
      ]
    : [];
  const effectInfoTitle = effectInfoParts.join(" • ");
  const curseInfoTitle = cr => cr ? `CurseID ${cr.EffectID} • CurseCompatibility ${cr.CompatibilityID ?? "∅"}` : "";

  const effectControls = (effectSlot != null && row)
    ? `<div class="control-cluster effect-controls" data-effect-controls="${effectSlot}">
        <button type="button" class="icon-btn swap-btn" data-effect-slot="${effectSlot}" aria-label="Change Effect" title="Change Effect">⇄</button>
        <button
          type="button"
          class="icon-btn info-btn"
          aria-label="Show Effect Info"
          data-effect-id="${row.EffectID}"
          data-info-kind="effect"
          data-info-raw="${effectInfoTitle}"
        >i</button>
        <button type="button" class="icon-btn clear-btn" data-effect-clear-slot="${effectSlot}" aria-label="Clear Effect" title="Clear Effect">×</button>
      </div>`
    : effectBtn;

  // Empty slot
  if (!row) {
    const title = slotLabel ? slotLabel : "";

    if (!showRaw) {
      return `
        <li>
          <div class="effect-row">
          <div class="effect-icon" aria-hidden="true"></div>
          <div class="effect-line">
            <div class="effect-main">
              <div class="title">${title}</div>
              ${effectBtn}
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
            <div class="effect-main effect-main--row">
              <div class="effect-text">
                <div class="title">${title}</div>
              </div>
              ${effectBtn}
            </div>
          </div>
        </div>
      </li>
    `;
  }

  const curseRequired = !!(opts && opts.curseRequired);
  const curseRow = opts && opts.curseRow ? opts.curseRow : null;
  const curseName = curseRow ? (curseRow.EffectDescription ?? `(Effect ${curseRow.EffectID})`) : "";
  const curseSlot = opts && Number.isFinite(opts.curseSlot) ? opts.curseSlot : null;
  const curseBtnLabel = (opts && opts.curseButtonLabel) ? String(opts.curseButtonLabel) : "Select a Curse";

  const curseBtn = curseRequired && curseSlot != null
    ? `<button type="button" class="curse-btn" data-curse-slot="${curseSlot}">${curseBtnLabel}</button>`
    : "";

  const curseSub = curseRequired && curseName
    ? `<span class="curse-sub">${curseName}</span>`
    : "";

  const needsCursePick = curseRequired && !curseName && curseBtn;
  const hasCurse = curseRequired && !!curseName;

  const curseLine = needsCursePick
    ? `<div class="curse-line"><span class="curse-required">Curse Required</span>${curseBtn}</div>`
    : hasCurse
      ? `<div class="curse-line">${curseSub}
          <div class="control-cluster curse-controls" data-curse-controls="${curseSlot != null ? curseSlot : ""}">
            <button type="button" class="icon-btn swap-btn" data-curse-slot="${curseSlot}" aria-label="Change Curse" title="Change Curse">⇄</button>
            <button
              type="button"
              class="icon-btn info-btn"
              aria-label="Show Curse Info"
              data-effect-id="${curseRow.EffectID}"
              data-info-kind="curse"
              data-info-raw="${curseInfoTitle(curseRow)}"
            >i</button>
            <button type="button" class="icon-btn clear-btn" data-curse-clear-slot="${curseSlot}" aria-label="Clear Curse" title="Clear Curse">×</button>
          </div>
        </div>`
      : "";


  const src = iconId ? iconPath(iconId) : "";
  const mover = moveIndicatorHtml(moveDelta, showOk);
  const badge = rowBadge ? rowBadgeHtml(rowBadge, "invalid") : "";
  const indicators = (badge || mover) ? `<div class="row-indicators">${badge}${mover}</div>` : "";

  // Compact
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
            </div>
            ${effectControls}
          </div>
          ${curseLine}
          ${indicators}
        </div>
      </div>
    </li>
  `;
}