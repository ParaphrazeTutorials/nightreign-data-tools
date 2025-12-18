import { iconPath, relicDefaultPath, relicPath, visualRelicType } from "./reliquary.assets.js";
import { compatId, normalize } from "./reliquary.logic.js";

export function optionHtml(row) {
  const label = row.EffectDescription ?? `(Effect ${row.EffectID})`;
  return `<option value="${row.EffectID}">${label}</option>`;
}

export function fillSelect(selectEl, options, placeholderText) {
  const first = `<option value="">${placeholderText}</option>`;
  selectEl.innerHTML = first + options.map(optionHtml).join("");
}

export function fillCategorySelect(catEl, categories) {
  const first = `<option value="">— All Categories —</option>`;
  const opts = categories.map(c => `<option value="${c}">${c}</option>`).join("");
  catEl.innerHTML = first + opts;
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

export function installRelicImgFallback(relicImg, getSelectedType) {
  relicImg.addEventListener("error", () => {
    relicImg.src = relicDefaultPath(visualRelicType(getSelectedType()));
  });
}

export function renderChosenLine(slotLabel, row) {
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

export function updateCounts({ count1, count2, count3 }, activeIndex, availableCount) {
  count1.textContent = "";
  count2.textContent = "";
  count3.textContent = "";

  const msg = `(${availableCount} Effects Available based on current selections)`;

  if (activeIndex === 1) count1.textContent = msg;
  if (activeIndex === 2) count2.textContent = msg;
  if (activeIndex === 3) count3.textContent = msg;
}
