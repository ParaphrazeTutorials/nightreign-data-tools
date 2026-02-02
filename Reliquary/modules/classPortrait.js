export function createClassPortraitController(dom, {
  characters = [],
  getSelectedClass,
  setSelectedClass,
  getMenuOpen,
  setClassPortraitMenuOpen,
  characterPortrait,
  randomPortrait,
  normalizeLower,
  escapeHtml
}) {
  function renderClassPortraitMenu() {
    if (!dom.classPortraitMenu) return;
    const chars = Array.isArray(characters) ? [...new Set(characters)] : [];
    const buttons = chars.map(name => {
      const norm = name || "";
      const portrait = characterPortrait(norm) || "";
      const attrPortrait = portrait ? portrait.replace(/"/g, "'") : "";
      const active = normalizeLower(norm) === normalizeLower(getSelectedClass());
      const bg = attrPortrait ? ` style="background-image: ${attrPortrait};"` : "";
      const cls = active ? " class=\"is-active\"" : "";
      const label = escapeHtml(norm);
      return `<button type="button" role="menuitemradio" aria-checked="${active}" data-class="${label}" aria-label="${label}"${bg}${cls}></button>`;
    });
    dom.classPortraitMenu.innerHTML = buttons.join("");
  }

  function classPortraitBg(name) {
    const portrait = characterPortrait(name) || randomPortrait();
    return portrait || "";
  }

  function updateClassPortraitUI() {
    const selectedClass = getSelectedClass();
    if (dom.classPortraitBtn) {
      const portrait = classPortraitBg(selectedClass);
      dom.classPortraitBtn.style.backgroundImage = portrait || "";
      const isEmpty = !portrait;
      dom.classPortraitBtn.classList.toggle("is-empty", isEmpty);
      dom.classPortraitBtn.setAttribute("aria-label", selectedClass ? `Class: ${selectedClass}` : "All classes");
    }

    if (dom.classPortraitMenu) {
      const normSel = normalizeLower(selectedClass);
      dom.classPortraitMenu.querySelectorAll("[data-class]").forEach(btn => {
        const isActive = normalizeLower(btn.dataset.class || "") === normSel;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        btn.setAttribute("aria-checked", isActive ? "true" : "false");
      });
    }
  }

  function setClassPortraitMenu(open) {
    if (!dom.classPortraitBtn || !dom.classPortraitMenu) return;
    const next = typeof open === "boolean" ? open : !getMenuOpen();
    setClassPortraitMenuOpen(next);
    dom.classPortraitBtn.setAttribute("aria-expanded", next ? "true" : "false");
    dom.classPortraitMenu.hidden = !next;
  }

  function installClassPortraitHandlers() {
    if (dom.classPortraitBtn) {
      dom.classPortraitBtn.addEventListener("click", () => {
        setClassPortraitMenu(!getMenuOpen());
      });
    }

    if (dom.classPortraitMenu) {
      dom.classPortraitMenu.addEventListener("click", evt => {
        const btn = evt.target.closest("button[data-class]");
        if (!btn) return;
        const next = btn.dataset.class || "";
        setSelectedClass(next);
        setClassPortraitMenu(false);
      });
    }
  }

  function handleOutsidePointer(target) {
    if (!getMenuOpen()) return;
    if (dom.classPortraitBtn && dom.classPortraitBtn.contains(target)) return;
    if (dom.classPortraitMenu && dom.classPortraitMenu.contains(target)) return;
    setClassPortraitMenu(false);
  }

  return {
    renderClassPortraitMenu,
    setClassPortraitMenu,
    updateClassPortraitUI,
    installClassPortraitHandlers,
    handleOutsidePointer
  };
}
