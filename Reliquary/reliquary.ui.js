import { relicDefaultPath, relicPath, visualRelicType, iconPath } from "./reliquary.assets.js";
import { categoryColorFor, gradientFromTheme, textColorFor } from "./modules/theme.js";

const MOBILE_MAX_WIDTH = 899;

const SELF_STACK_TOKENS = {
  yes: { bg: "linear-gradient(135deg, #103828, #27a06a)", border: "rgba(120, 230, 170, 0.8)", text: "#e9fff5" },
  no: { bg: "linear-gradient(135deg, #3d1318, #9b2f35)", border: "rgba(255, 130, 150, 0.8)", text: "#ffeef2" },
  unknown: { bg: "linear-gradient(135deg, #2e2f36, #4b4e57)", border: "rgba(255, 255, 255, 0.18)", text: "#f5f7ff" }
};

const RELIC_TOKENS = {
  standard: { bg: "linear-gradient(135deg, rgba(71, 115, 180, 0.12), rgba(145, 189, 255, 0.28))", border: "rgba(145, 189, 255, 0.5)", text: "#d5e4ff" },
  depth: { bg: "linear-gradient(135deg, rgba(116, 83, 173, 0.16), rgba(177, 140, 255, 0.32))", border: "rgba(177, 140, 255, 0.55)", text: "#e1d3ff" },
  both: { bg: "linear-gradient(135deg, rgba(56, 140, 120, 0.14), rgba(125, 208, 195, 0.32))", border: "rgba(125, 208, 195, 0.55)", text: "#d3f5ee" }
};

const CHARACTER_TOKEN = { bg: "rgba(255, 255, 255, 0.06)", border: "rgba(255, 255, 255, 0.18)", text: "#f5f7ff" };

// Inline style to guarantee the preview card background shows even if a parent rule competes
const MOBILE_CARD_STYLE = "background: linear-gradient(150deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));" +
  " border: 1px solid rgba(255, 255, 255, 0.10);" +
  " border-radius: 16px;" +
  " padding: 14px;" +
  " box-shadow: 0 14px 36px rgba(0, 0, 0, 0.38);" +
  " color: #f5f7ff;" +
  " min-height: auto;" +
  " height: auto;";

export function isMobileViewport() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

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

export function moveIndicatorHtml(moveDelta, showOk = false) {
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
  const useMobile = opts?.isMobile && isMobileViewport();

  if (useMobile) {
    return renderMobileEffectRow(slotLabel, row, moveDelta, showOk, rowBadge, opts);
  }

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
        <button
          type="button"
          class="icon-btn copy-id-btn"
          aria-label="Copy EffectID ${row.EffectID}"
          title="EffectID ${row.EffectID}"
          data-copy-effect-id="${row.EffectID}"
        >
          <span class="effect-copy-icon" aria-hidden="true"></span>
        </button>
      </div>`
    : effectBtn;

  // Empty slot
  if (!row) {
    const title = slotLabel ? slotLabel : "";

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
            <button
              type="button"
              class="icon-btn copy-id-btn"
              aria-label="Copy CurseID ${curseRow.EffectID}"
              title="CurseID ${curseRow.EffectID}"
              data-copy-curse-id="${curseRow.EffectID}"
            >
              <span class="effect-copy-icon" aria-hidden="true"></span>
            </button>
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

function tokenStyle(token) {
  if (!token) return "";
  const bg = token.bg ? `background:${token.bg};` : "";
  const border = token.border ? `border-color:${token.border};` : "";
  const text = token.text ? `color:${token.text};` : "";
  return `${bg}${border}${text}`;
}

function metaPills(row) {
  if (!row) return [];

  const pills = [];

  const categoryLabel = (row.EffectCategory || "Uncategorized").trim() || "Uncategorized";
  const catTheme = categoryColorFor(categoryLabel);
  const catBg = gradientFromTheme(catTheme);
  const catBorder = catTheme?.border || "rgba(255,255,255,0.14)";
  const catText = catTheme?.text || textColorFor(catTheme?.base || "#f7f9ff");
  pills.push({ label: categoryLabel, style: `background:${catBg};border-color:${catBorder};color:${catText};` });

  const selfStackKey = (row?.SelfStacking || "").toString().toLowerCase();
  const selfStackToken = SELF_STACK_TOKENS[selfStackKey] || SELF_STACK_TOKENS.unknown;
  const selfStackLabel = selfStackKey === "yes" ? "Self-Stacking: Yes" : selfStackKey === "no" ? "Self-Stacking: No" : "Self-Stacking: Unknown";
  pills.push({ label: selfStackLabel, style: tokenStyle(selfStackToken) });

  const characters = (row.Characters || "").trim();
  const isAll = !characters || characters.toLowerCase() === "all";
  if (isAll) {
    pills.push({ label: "All", style: tokenStyle(CHARACTER_TOKEN) });
  } else {
    const names = characters.split(",").map(s => s.trim()).filter(Boolean);
    names.slice(0, 3).forEach(name => {
      pills.push({ label: name, style: tokenStyle(CHARACTER_TOKEN) });
    });
  }

  const relicTypeRaw = (row.RelicType || "Standard").toString().toLowerCase();
  const relicKey = relicTypeRaw.includes("depth") ? "depth" : relicTypeRaw.includes("both") ? "both" : "standard";
  const relicToken = RELIC_TOKENS[relicKey] || RELIC_TOKENS.standard;
  const relicLabel = row.RelicType || "Standard";
  pills.push({ label: relicLabel, style: tokenStyle(relicToken) });

  return pills;
}

function validationPill({ rowBadge, needsCursePick, showOk }) {
  if (rowBadge) return { label: rowBadge, tone: "warn" };
  if (needsCursePick) return { label: "Curse Required", tone: "warn" };
  return { label: showOk ? "Valid" : "Ready", tone: showOk ? "good" : "muted" };
}

function mobileActionFlyout(menuId, entries = []) {
  if (!menuId) return "";
  const items = entries.filter(Boolean).join("");
  if (!items) return "";
  return `
    <span class="mobile-action-menu">
      <button class="mobile-settings-btn" aria-haspopup="true" aria-expanded="false" aria-label="Row actions" data-menu-id="${menuId}">
        <svg class="gear-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M2 7.86677785C3.10540596 8.47421806 3.8545971 9.64961755 3.8545971 11C3.8545971 12.3503825 3.10540596 13.5257819 2 14.1332221C2.12113545 14.481215 2.26188408 14.8200223 2.42092213 15.1483205C3.63198544 14.7963908 4.9926792 15.0978049 5.94743715 16.0525628C6.9021951 17.0073208 7.20360923 18.3680146 6.85167954 19.5790779C7.17997769 19.7381159 7.51878505 19.8788646 7.86677785 20C8.47421806 18.894594 9.64961755 18.1454029 11 18.1454029C12.3503825 18.1454029 13.5257819 18.894594 14.1332221 20C14.481215 19.8788646 14.8200223 19.7381159 15.1483205 19.5790779C14.7963908 18.3680146 15.0978049 17.0073208 16.0525628 16.0525628C17.0073208 15.0978049 18.3680146 14.7963908 19.5790779 15.1483205C19.7381159 14.8200223 19.8788646 14.481215 20 14.1332221C18.894594 13.5257819 18.1454029 12.3503825 18.1454029 11C18.1454029 9.64961755 18.894594 8.47421806 20 7.86677785C19.8788646 7.51878505 19.7381159 7.17997769 19.5790779 6.85167954C18.3680146 7.20360923 17.0073208 6.9021951 16.0525628 5.94743715C15.0978049 4.9926792 14.7963908 3.63198544 15.1483205 2.42092213C14.8200223 2.26188408 14.481215 2.12113545 14.1332221 2C13.5257819 3.10540596 12.3503825 3.8545971 11 3.8545971C9.64961755 3.8545971 8.47421806 3.10540596 7.86677785 2C7.51878505 2.12113545 7.17997769 2.26188408 6.85167954 2.42092213C7.20360923 3.63198544 6.9021951 4.9926792 5.94743715 5.94743715C4.9926792 6.9021951 3.63198544 7.20360923 2.42092213 6.85167954C2.26188408 7.17997769 2.12113545 7.51878505 2 7.86677785Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
          <circle cx="11" cy="11" r="2.2" fill="none" stroke="currentColor" stroke-width="2.4" />
        </svg>
      </button>
      <div class="mobile-action-flyout" data-menu="${menuId}" role="menu">${items}</div>
    </span>
  `;
}

function mobileFlyoutItem({ tone = "muted", label, cls = "", attrs = "", icon = "" }) {
  if (!label && !icon) return "";
  const iconPart = `<span class="flyout-icon${icon ? " " + icon : ""}" data-tone="${tone}">${icon === "copy-icon" ? "" : icon || ""}</span>`;
  const safeLabel = label || "Action";
  return `<button class="flyout-item ${cls}" role="menuitem" data-tone="${tone}" aria-label="${safeLabel}" title="${safeLabel}" ${attrs}>${iconPart}</button>`;
}

function renderMobileEffectRow(slotLabel, row, moveDelta, showOk, rowBadge, opts) {
  const effectSlot = Number.isFinite(opts?.effectSlot) ? opts.effectSlot : null;
  const effectBtnLabel = (opts && opts.effectButtonLabel) ? String(opts.effectButtonLabel) : (row ? "Change Effect" : "Select Effect");
  const effectBtnDisabled = !!(opts && opts.effectButtonDisabled);

  const curseRequired = !!(opts && opts.curseRequired);
  const curseRow = opts && opts.curseRow ? opts.curseRow : null;
  const curseName = curseRow ? (curseRow.EffectDescription ?? `(Effect ${curseRow.EffectID})`) : "";
  const curseSlot = opts && Number.isFinite(opts.curseSlot) ? opts.curseSlot : null;
  const curseBtnLabel = (opts && opts.curseButtonLabel) ? String(opts.curseButtonLabel) : "Select Curse";

  const needsCursePick = curseRequired && !curseName && !!curseBtnLabel;
  const hasCurse = curseRequired && !!curseName;

  const effectInfoParts = row
    ? [
        `EffectID ${row.EffectID}`,
        `Compatibility ${row?.CompatibilityID ?? "∅"}`,
        `RollOrder ${(row?.RollOrder ?? "∅")}`
      ]
    : [];
  const effectInfoTitle = effectInfoParts.join(" • ");
  const curseInfoTitle = cr => cr ? `CurseID ${cr.EffectID} • CurseCompatibility ${cr.CompatibilityID ?? "∅"}` : "";

  const effectMenuId = `effect-menu-${effectSlot ?? "na"}-${row?.EffectID ?? "empty"}`;
  const curseMenuId = hasCurse ? `curse-menu-${curseSlot ?? "na"}-${curseRow?.EffectID ?? "empty"}` : "";

  const validation = validationPill({ rowBadge, needsCursePick, showOk });

  if (!row) {
    return `
      <li class="mobile-effect-card mobile-effect-card--empty" style="${MOBILE_CARD_STYLE}">
        <div class="mobile-row-body">
          <button
            type="button"
            class="mobile-button"
            data-effect-slot="${effectSlot != null ? effectSlot : ""}"
            ${effectBtnDisabled ? "disabled" : ""}
          >${effectBtnLabel}</button>
        </div>
      </li>
    `;
  }

  const pills = metaPills(row);
  const cursePills = curseRow ? metaPills(curseRow) : [];

  const effectFlyout = mobileActionFlyout(effectMenuId, [
    mobileFlyoutItem({ tone: "swap", label: "Change Effect", cls: "swap-btn", attrs: effectSlot != null ? `data-effect-slot="${effectSlot}"` : "", icon: "⇄" }),
    row ? mobileFlyoutItem({ tone: "info", label: "Information", cls: "info-btn", attrs: `data-effect-id="${row.EffectID}" data-info-kind="effect" data-info-raw="${effectInfoTitle}"`, icon: "i" }) : "",
    row ? mobileFlyoutItem({ tone: "danger", label: "Clear Effect", cls: "clear-btn", attrs: effectSlot != null ? `data-effect-clear-slot="${effectSlot}"` : "", icon: "×" }) : "",
    row ? mobileFlyoutItem({ tone: "copy", label: "Copy Effect ID", cls: "copy-id-btn", attrs: `data-copy-effect-id="${row.EffectID}"`, icon: "copy-icon" }) : ""
  ]);

  const curseFlyout = hasCurse
    ? mobileActionFlyout(curseMenuId, [
        mobileFlyoutItem({ tone: "swap", label: "Change Curse", cls: "swap-btn", attrs: curseSlot != null ? `data-curse-slot="${curseSlot}"` : "", icon: "⇄" }),
        mobileFlyoutItem({ tone: "info", label: "Information", cls: "info-btn", attrs: curseRow ? `data-effect-id="${curseRow.EffectID}" data-info-kind="curse" data-info-raw="${curseInfoTitle(curseRow)}"` : "", icon: "i" }),
        mobileFlyoutItem({ tone: "danger", label: "Clear Curse", cls: "clear-btn", attrs: curseSlot != null ? `data-curse-clear-slot="${curseSlot}"` : "", icon: "×" }),
        mobileFlyoutItem({ tone: "copy", label: "Copy Curse ID", cls: "copy-id-btn", attrs: curseRow ? `data-copy-curse-id="${curseRow.EffectID}"` : "", icon: "copy-icon" })
      ])
    : "";

  const metaRow = pills.map(p => `<span class="meta-pill" style="${p.style}">${p.label}</span>`).join("");
  const curseMetaRow = cursePills.map(p => `<span class="meta-pill" style="${p.style}">${p.label}</span>`).join("");

  const curseBlock = curseRequired
    ? hasCurse
      ? `
          <div class="mobile-divider" aria-hidden="true"></div>
          <div class="mobile-row-line">
            <div class="line-header">
              ${curseFlyout}
              <p class="line-title">${curseName}</p>
            </div>
            ${curseRow?.EffectExtendedDescription || curseRow?.RawEffect ? `<p class="subtext">${curseRow?.EffectExtendedDescription || curseRow?.RawEffect}</p>` : ""}
            ${curseMetaRow ? `<div class="meta-row">${curseMetaRow}</div>` : ""}
          </div>
        `
      : `
          <div class="mobile-divider" aria-hidden="true"></div>
          <button type="button" class="mobile-button curse-btn" data-curse-slot="${curseSlot != null ? curseSlot : ""}">${curseBtnLabel}</button>
        `
    : "";

  const moveLabel = Number(moveDelta || 0) !== 0
    ? `<span class="meta-pill" data-kind="move">${moveDelta < 0 ? "Move Up" : "Move Down"} ${Math.min(3, Math.abs(moveDelta))}</span>`
    : "";

  const titlePrefix = row ? "" : (slotLabel ? `${slotLabel}: ` : "");

  return `
    <li class="mobile-effect-card" style="${MOBILE_CARD_STYLE}" data-expanded="false">
      <div class="mobile-row-header">
        <div class="mobile-title">
          ${effectFlyout}
          <span class="mobile-title-text">${row.EffectDescription ?? `(Effect ${row.EffectID})`}</span>
        </div>
        <div class="validation"><span class="pill ${validation.tone}">${validation.label}</span></div>
      </div>
      ${row.EffectExtendedDescription || row.RawEffect ? `<p class="subtext">${row.EffectExtendedDescription || row.RawEffect}</p>` : ""}
      <div class="mobile-row-body">
        ${metaRow ? `<div class="meta-row">${metaRow}${moveLabel}</div>` : ""}
        ${curseBlock}
      </div>
      <div class="mobile-toggle-row">
        <button class="mobile-details-toggle" type="button" aria-expanded="true" aria-label="Collapse details">▴ Less ▴</button>
      </div>
    </li>
  `;
}

export { metaPills as buildMobileMetaPills, mobileActionFlyout, mobileFlyoutItem };
export function installMobileEffectToggles() {
  const cards = document.querySelectorAll(".mobile-effect-card[data-expanded]");
  const expandedText = "▴ Less ▴";
  const collapsedText = "▾ More ▾";

  const enforceHandleFlush = card => {
    // Remove any bottom padding/border that can show under the handle
    card.style.paddingBottom = "0";
    card.style.borderBottom = "0";
    const toggleRow = card.querySelector(".mobile-toggle-row");
    if (toggleRow) {
      toggleRow.style.margin = "12px -14px -1px";
      toggleRow.style.borderRadius = "0 0 16px 16px";
      toggleRow.style.borderBottom = "0";
      toggleRow.style.overflow = "hidden";
    }
  };

  const setToggleState = (card, btn, expanded) => {
    card.setAttribute("data-expanded", expanded ? "true" : "false");
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    btn.textContent = expanded ? expandedText : collapsedText;
    btn.setAttribute("aria-label", expanded ? "Collapse details" : "Expand details");
    enforceHandleFlush(card);
  };

  cards.forEach(card => {
    const btn = card.querySelector(".mobile-details-toggle");
    if (!btn || btn.dataset.toggleInstalled) return;
    btn.dataset.toggleInstalled = "true";
    const startExpanded = card.getAttribute("data-expanded") !== "false";
    setToggleState(card, btn, startExpanded);

    btn.addEventListener("click", () => {
      const isExpanded = card.getAttribute("data-expanded") !== "false";
      setToggleState(card, btn, !isExpanded);
    });
  });
}

let mobileFlyoutListenersInstalled = false;

export function installMobileEffectFlyouts() {
  const flyouts = new Map();
  document.querySelectorAll(".mobile-action-flyout").forEach(f => {
    const key = f.getAttribute("data-menu");
    if (key) flyouts.set(key, f);
  });

  const closeAll = () => {
    flyouts.forEach(f => f.classList.remove("open"));
    document.querySelectorAll(".mobile-settings-btn[aria-expanded='true']").forEach(btn => btn.setAttribute("aria-expanded", "false"));
  };

  document.querySelectorAll(".mobile-settings-btn").forEach(btn => {
    const id = btn.getAttribute("data-menu-id") || "";
    const flyout = flyouts.get(id);
    if (!flyout) return;
    btn.addEventListener("click", evt => {
      evt.stopPropagation();
      const isOpen = flyout.classList.contains("open");
      closeAll();
      if (!isOpen) {
        flyout.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  if (!mobileFlyoutListenersInstalled) {
    document.addEventListener("click", () => closeAll());
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeAll();
    });
    mobileFlyoutListenersInstalled = true;
  }
}