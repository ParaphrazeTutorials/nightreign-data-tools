export function showPortalTooltip(target) {
  const el = ensureTooltipPortal();
  const txt = target?.getAttribute("data-tooltip") || target?.dataset?.tooltipText;
  if (!txt) return;
  const rect = target.getBoundingClientRect();
  const placeLeft = !!(target.closest(".chalice-slot__issue-col, .chalice-slot__issue-badges")
    || target.closest('#chaliceDetails[data-details-state="collapsed"]'));
  el.textContent = txt;
  if (placeLeft) {
    el.classList.add("tooltip-portal--left");
    el.style.left = `${rect.left - 8}px`;
    el.style.top = `${rect.top + rect.height / 2}px`;
  } else {
    el.classList.remove("tooltip-portal--left");
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top - 8}px`;
  }
  document.body.classList.add("tooltip-portal-active");
  el.classList.add("is-visible");
}

export function hidePortalTooltip() {
  if (!tooltipPortal) return;
  tooltipPortal.classList.remove("is-visible");
  tooltipPortal.textContent = "";
  document.body.classList.remove("tooltip-portal-active");
}

export function installHoverTooltip(btn) {
  if (!btn || btn.dataset.tooltipHoverInstalled) return;
  const apply = () => {
    const txt = btn.dataset.tooltipText || "";
    if (txt) btn.setAttribute("data-tooltip", txt);
    showPortalTooltip(btn);
  };
  const clear = () => {
    btn.removeAttribute("data-tooltip");
    hidePortalTooltip();
  };
  btn.addEventListener("pointerenter", apply);
  btn.addEventListener("pointerleave", clear);
  btn.addEventListener("blur", clear);
  btn.dataset.tooltipHoverInstalled = "true";
}

export function setHoverTooltip(btn, text) {
  if (!btn) return;
  btn.dataset.tooltipText = text || "";
  btn.removeAttribute("data-tooltip");
  installHoverTooltip(btn);
}

let tooltipPortal;
function ensureTooltipPortal() {
  if (tooltipPortal) return tooltipPortal;
  const el = document.createElement("div");
  el.id = "tooltipPortal";
  el.className = "tooltip-portal";
  document.body.appendChild(el);
  tooltipPortal = el;
  return el;
}
