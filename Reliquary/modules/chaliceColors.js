export function createChaliceColorController(dom, {
  COLOR_SWATCH,
  chaliceColorCache,
  chaliceColorListCache,
  getSelectedChalice,
  getSelectedChaliceId,
  sideInfo
}) {
  function normalizeChaliceColor(value) {
    if (!value) return "#ffffff";
    const trimmed = String(value).trim();
    if (trimmed.startsWith("#")) return trimmed;
    const rgbMatch = trimmed.match(/rgba?\([^)]*\)/i);
    if (rgbMatch) return rgbMatch[0];
    if (trimmed.includes("gradient")) {
      const hexMatch = trimmed.match(/#([0-9a-fA-F]{3,8})/);
      if (hexMatch) return `#${hexMatch[1]}`;
    }
    const probe = document.createElement("div");
    probe.style.display = "none";
    probe.style.color = trimmed;
    document.body.appendChild(probe);
    const resolved = window.getComputedStyle(probe).color;
    probe.remove();
    return resolved || "#ffffff";
  }

  function setChaliceSideColorVar(meta, color) {
    const colEl = document.querySelector(`article.chalice-column[data-side="${meta.key}"]`);
    if (colEl) colEl.style.setProperty("--chalice-side-color", color);
  }

  function renderChaliceColors() {
    if (!dom.chaliceStandardColors || !dom.chaliceDepthColors) return;
    const entry = typeof getSelectedChalice === "function" ? getSelectedChalice() : null;
    const isAllChalices = typeof getSelectedChaliceId === "function" ? getSelectedChaliceId() === "" : !entry;
    const fallbackDots = isAllChalices ? ["#ffffff", "#ffffff", "#ffffff"] : [];
    const stdColors = entry ? [entry.standard1, entry.standard2, entry.standard3].filter(Boolean) : fallbackDots;
    const depthColors = entry ? [entry.depth1, entry.depth2, entry.depth3].filter(Boolean) : fallbackDots;

    const toSwatch = (color) => {
      if (color == null) return "#ffffff";
      const raw = COLOR_SWATCH[color] || color;
      return normalizeChaliceColor(raw);
    };

    const dotHtml = (list) => list.map(color => {
      const swatch = toSwatch(color);
      return `<span class="chalice-color-dot" data-color="${swatch}" style="background:${swatch};"></span>`;
    }).join("");

    const stdSwatches = stdColors.map(toSwatch);
    const depthSwatches = depthColors.map(toSwatch);

    chaliceColorListCache.standard = stdSwatches;
    chaliceColorListCache.depth = depthSwatches;

    chaliceColorCache.standard = stdSwatches.length ? stdSwatches[0] : "#ffffff";
    chaliceColorCache.depth = depthSwatches.length ? depthSwatches[0] : "#ffffff";

    setChaliceSideColorVar(sideInfo("standard"), chaliceColorCache.standard);
    setChaliceSideColorVar(sideInfo("depth"), chaliceColorCache.depth);

    dom.chaliceStandardColors.innerHTML = dotHtml(stdColors);
    dom.chaliceDepthColors.innerHTML = dotHtml(depthColors);
  }

  function chaliceSideColor(meta, index = 0) {
    const list = chaliceColorListCache[meta.key] || [];
    if (list.length) return list[index % list.length] || list[0];
    return chaliceColorCache[meta.key] || "#ffffff";
  }

  return {
    renderChaliceColors,
    chaliceSideColor
  };
}
