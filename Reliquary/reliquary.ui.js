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

export function renderChosenLine(slotLabel, row, showRaw) {
  // Empty slot
  if (!row) {
    if (!showRaw) {
      return `
        <li>
          <div class="effect-icon" aria-hidden="true"></div>
          <div class="effect-line">
            <div class="title">${slotLabel}: <span class="pill">Empty</span></div>
          </div>
        </li>
      `;
    }

    return `
      <li>
        <div class="effect-icon" aria-hidden="true"></div>
        <div class="effect-line">
          <div class="title">${slotLabel}: <span class="pill">Empty</span></div>
          <div class="meta"></div>
        </div>
      </li>
    `;
  }

  const name = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  const cid = (row?.CompatibilityID == null) ? "∅" : String(row.CompatibilityID);
  const iconId = (row?.StatusIconID ?? "").toString().trim();
  const roll = (row?.RollOrder == null || String(row.RollOrder).trim() === "") ? "∅" : String(row.RollOrder);

  const src = iconId ? iconPath(iconId) : "";

  // Compact
  if (!showRaw) {
    return `
      <li>
        <div class="effect-icon" aria-hidden="true">
          ${src ? `<img src="${src}" alt="" onerror="this.remove()" />` : ""}
        </div>
        <div class="effect-line">
          <div class="title">${slotLabel}: ${name}</div>
        </div>
      </li>
    `;
  }

  // Raw
  return `
    <li>
      <div class="effect-icon" aria-hidden="true">
        ${src ? `<img src="${src}" alt="" onerror="this.remove()" />` : ""}
      </div>
      <div class="effect-line">
        <div class="title">${slotLabel}: ${name}</div>
        <div class="meta">
          RollOrder <code>${roll}</code>
          • EffectID <code>${row.EffectID}</code>
          • Compatibility <code>${cid}</code>
          ${iconId ? `• Icon <code>${iconId}</code>` : ``}
        </div>
      </div>
    </li>
  `;
}
