import { normalizeLower } from "./logic.js";
import {
  relicTypeMenuOpen,
  setRelicTypeMenuOpen,
  relicTypePopoverOpen,
  setRelicTypePopoverOpen,
  pendingRelicType,
  setPendingRelicType,
  pendingRelicColor,
  setPendingRelicColor,
  selectedColor,
  setSelectedColor
} from "./state.js";
import { escapeHtml, swatchForColorName } from "./uiHelpers.js";

export function createRelicTypeController(dom, {
  relicTypes = [],
  colorChoices = [],
  popoverTypes = null,
  clearSelectionsIncompatibleWithType,
  updateUI,
  updateColorChipLabel,
  isDesktopWide
}) {
  const typeChoices = Array.isArray(popoverTypes) && popoverTypes.length
    ? popoverTypes
    : [
        { value: "Standard", label: "Standard", img: "../Assets/relics/default/standard.png" },
        { value: "Depth Of Night", label: "Depth of Night", img: "../Assets/relics/default/depth_of_night.png" }
      ];

  function renderRelicTypeMenu() {
    if (!dom.relicTypeMenu) return;
    const current = (dom.selType?.value ?? "").trim();
    const buttons = relicTypes.map(entry => {
      const isActive = normalizeLower(entry.value) === normalizeLower(current);
      const cls = isActive ? " class=\"is-active\"" : "";
      return `<button type="button" role="menuitemradio" aria-checked="${isActive}" data-relic-type="${escapeHtml(entry.value)}" aria-label="${escapeHtml(entry.label)}"${cls}>${escapeHtml(entry.label)}</button>`;
    });
    dom.relicTypeMenu.innerHTML = buttons.join("");
  }

  function setRelicTypeMenu(open) {
    if (!dom.relicThumb || !dom.relicTypeMenu) return;
    const next = !!open;
    setRelicTypeMenuOpen(next);
    dom.relicThumb.setAttribute("aria-expanded", next ? "true" : "false");
    dom.relicTypeMenu.hidden = !next;
  }

  function renderRelicTypePopover() {
    if (!dom.relicTypePopover) return;
    const currentType = (pendingRelicType || dom.selType?.value || "").trim();
    const currentColor = (pendingRelicColor || selectedColor || "Random").trim() || "Random";

    const typeButtons = typeChoices.map(entry => {
      const isActive = normalizeLower(entry.value) === normalizeLower(currentType);
      return `
      <button type="button" class="relic-type-popover__type-btn${isActive ? " is-active" : ""}" data-relic-type-choice="${escapeHtml(entry.value)}" style="background-image: url('${entry.img}')">
        <span class="relic-type-popover__type-label">${escapeHtml(entry.label)}</span>
      </button>
    `;
    }).join("");

    const colorButtons = colorChoices.map(color => {
      const swatch = swatchForColorName(color);
      const isActive = normalizeLower(color) === normalizeLower(currentColor);
      return `
      <button type="button" class="relic-type-popover__color${isActive ? " is-active" : ""}" data-relic-color-choice="${escapeHtml(color)}" style="--swatch: ${swatch};">
        <span class="sr-only">${escapeHtml(color)}</span>
      </button>
    `;
    }).join("");

    dom.relicTypePopover.innerHTML = `
    <div class="relic-type-popover__types">${typeButtons}</div>
    <div class="relic-type-popover__colors">${colorButtons}</div>
    <div class="relic-type-popover__actions">
      <button type="button" class="secondary" data-relic-popover-cancel>Cancel</button>
      <button type="button" class="primary" data-relic-popover-save>Save</button>
    </div>
  `;
  }

  function updateRelicTypeUI() {
    if (dom.relicThumb) {
      const typeLabel = dom.selType?.value ? dom.selType.value : "Any Type";
      dom.relicThumb.setAttribute("aria-label", `Relic type: ${typeLabel}`);
      const selectionLabel = document.getElementById("relicThumbSelection");
      if (selectionLabel) {
        selectionLabel.textContent = dom.selType?.value ? dom.selType.value : "";
        selectionLabel.hidden = !dom.selType?.value;
      }
      const colorChip = dom.relicThumb.querySelector(".mini-tile__color-chip");
      if (colorChip && dom.relicColorChip) {
        const swatch = dom.relicColorChip.style.getPropertyValue("--chip-swatch") || "";
        colorChip.style.setProperty("--chip-swatch", swatch || "rgba(255,255,255,0.12)");
      }
    }

    if (dom.relicTypeMenu) {
      const current = normalizeLower(dom.selType?.value || "");
      dom.relicTypeMenu.querySelectorAll("[data-relic-type]").forEach(btn => {
        const isActive = normalizeLower(btn.dataset.relicType || "") === current;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-checked", isActive ? "true" : "false");
      });
    }

    renderRelicTypePopover();
  }

  function setSelectedRelicType(next) {
    const normalized = (next ?? "").toString().trim();
    if (dom.selType) dom.selType.value = normalized;
    clearSelectionsIncompatibleWithType(normalized);
    updateUI("type-change");
    renderRelicTypeMenu();
    updateRelicTypeUI();
    setRelicTypeMenu(false);
  }

  function openRelicTypePopover() {
    setPendingRelicType(dom.selType?.value || "");
    setPendingRelicColor(selectedColor || "Random");
    renderRelicTypePopover();
    if (dom.relicTypePopover) dom.relicTypePopover.hidden = false;
    setRelicTypePopoverOpen(true);
  }

  function closeRelicTypePopover() {
    if (dom.relicTypePopover) dom.relicTypePopover.hidden = true;
    setRelicTypePopoverOpen(false);
  }

  function applyRelicTypePopoverSelection() {
    setSelectedRelicType(pendingRelicType || "");
    setSelectedColor(pendingRelicColor || "Random");
    updateColorChipLabel();
    updateUI("color-change");
    closeRelicTypePopover();
  }

  function toggleRelicTypePopover(force) {
    const nextOpen = typeof force === "boolean" ? force : !relicTypePopoverOpen;
    if (nextOpen) {
      openRelicTypePopover();
    } else {
      closeRelicTypePopover();
    }
  }

  function handleThumbClick() {
    if (typeof isDesktopWide === "function" && isDesktopWide()) {
      toggleRelicTypePopover(false);
      setRelicTypeMenu(!relicTypeMenuOpen);
    } else {
      setRelicTypeMenu(false);
      toggleRelicTypePopover();
    }
  }

  function handlePopoverClick(evt) {
    const typeBtn = evt.target.closest?.("[data-relic-type-choice]");
    if (typeBtn) {
      setPendingRelicType(typeBtn.dataset.relicTypeChoice || "");
      setSelectedRelicType(pendingRelicType);
      renderRelicTypePopover();
      return;
    }

    const colorBtn = evt.target.closest?.("[data-relic-color-choice]");
    if (colorBtn) {
      setPendingRelicColor(colorBtn.dataset.relicColorChoice || "Random");
      setSelectedColor(pendingRelicColor);
      updateColorChipLabel();
      updateUI("color-change");
      renderRelicTypePopover();
      return;
    }

    if (evt.target.closest?.("[data-relic-popover-save]")) {
      applyRelicTypePopoverSelection();
      return;
    }

    if (evt.target.closest?.("[data-relic-popover-cancel]")) {
      closeRelicTypePopover();
    }
  }

  function handleMenuClick(evt) {
    const btn = evt.target.closest?.("[data-relic-type]");
    if (!btn) return;
    const next = btn.dataset.relicType || "";
    setSelectedRelicType(next);
  }

  function installRelicTypeHandlers() {
    if (dom.relicThumb) {
      dom.relicThumb.addEventListener("click", evt => {
        evt.preventDefault();
        handleThumbClick();
      });
    }

    if (dom.relicTypePopover) {
      dom.relicTypePopover.addEventListener("click", handlePopoverClick);
    }

    if (dom.relicTypeMenu) {
      dom.relicTypeMenu.addEventListener("click", handleMenuClick);
    }
  }

  function handleOutsidePointer(target) {
    if (relicTypeMenuOpen) {
      if (dom.relicThumb && dom.relicThumb.contains(target)) return;
      if (dom.relicTypeMenu && dom.relicTypeMenu.contains(target)) return;
      setRelicTypeMenu(false);
    }

    if (relicTypePopoverOpen) {
      if (dom.relicThumb && dom.relicThumb.contains(target)) return;
      if (dom.relicTypePopover && dom.relicTypePopover.contains(target)) return;
      closeRelicTypePopover();
    }
  }

  return {
    renderRelicTypeMenu,
    setRelicTypeMenu,
    setSelectedRelicType,
    updateRelicTypeUI,
    toggleRelicTypePopover,
    closeRelicTypePopover,
    installRelicTypeHandlers,
    handleOutsidePointer
  };
}
