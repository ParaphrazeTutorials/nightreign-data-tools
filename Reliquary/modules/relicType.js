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
import { swatchForColorName } from "./uiHelpers.js";

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

  function buildTypeButtons(choices, currentType, variant) {
    const frag = document.createDocumentFragment();
    choices.forEach(entry => {
      const isActive = normalizeLower(entry.value) === normalizeLower(currentType);
      const btn = document.createElement("button");
      btn.type = "button";
      if (variant === "menu") {
        btn.dataset.relicType = entry.value;
        btn.setAttribute("role", "menuitemradio");
        btn.setAttribute("aria-checked", isActive ? "true" : "false");
        btn.setAttribute("aria-label", entry.label);
        btn.className = isActive ? "is-active" : "";
        btn.textContent = entry.label;
      } else {
        btn.dataset.relicTypeChoice = entry.value;
        btn.className = `relic-type-popover__type-btn${isActive ? " is-active" : ""}`;
        btn.style.backgroundImage = `url('${entry.img}')`;
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        const label = document.createElement("span");
        label.className = "relic-type-popover__type-label";
        label.textContent = entry.label;
        btn.appendChild(label);
      }
      frag.appendChild(btn);
    });
    return frag;
  }

  function buildColorButtons(currentColor) {
    const frag = document.createDocumentFragment();
    colorChoices.forEach(color => {
      const swatch = swatchForColorName(color);
      const isActive = normalizeLower(color) === normalizeLower(currentColor);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `relic-type-popover__color${isActive ? " is-active" : ""}`;
      btn.dataset.relicColorChoice = color;
      btn.style.setProperty("--swatch", swatch);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      const sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = color;
      btn.appendChild(sr);
      frag.appendChild(btn);
    });
    return frag;
  }

  function renderRelicTypeMenu() {
    if (!dom.relicTypeMenu) return;
    const current = (dom.selType?.value ?? "").trim();
    const frag = buildTypeButtons(relicTypes, current, "menu");
    dom.relicTypeMenu.replaceChildren(frag);
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

    const frag = document.createDocumentFragment();

    const typesWrap = document.createElement("div");
    typesWrap.className = "relic-type-popover__types";
    typesWrap.appendChild(buildTypeButtons(typeChoices, currentType, "popover"));

    const colorsWrap = document.createElement("div");
    colorsWrap.className = "relic-type-popover__colors";
    colorsWrap.appendChild(buildColorButtons(currentColor));

    const actions = document.createElement("div");
    actions.className = "relic-type-popover__actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary";
    cancel.dataset.relicPopoverCancel = "";
    cancel.textContent = "Cancel";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "primary";
    save.dataset.relicPopoverSave = "";
    save.textContent = "Save";
    actions.appendChild(cancel);
    actions.appendChild(save);

    frag.appendChild(typesWrap);
    frag.appendChild(colorsWrap);
    frag.appendChild(actions);

    dom.relicTypePopover.replaceChildren(frag);
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
