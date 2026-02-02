export function createChaliceGroupingController(dom, {
  sideInfo,
  generateCombosForSide,
  chaliceGroupOrder,
  chaliceSideColor,
  textColorFor,
  installChaliceGroupDrag,
  installChaliceEffectDrag
}) {
  function comboKeyFromIndices(indices) {
    const sorted = Array.isArray(indices) ? [...indices].sort((a, b) => a - b) : [];
    return sorted.join("-");
  }

  function orderedCombosWithSaved(meta, combos) {
    const list = Array.isArray(combos) ? [...combos] : [];
    if (!list.length) return list;

    const saved = Array.isArray(chaliceGroupOrder[meta.key]) ? chaliceGroupOrder[meta.key] : [];
    if (!saved.length) return list;

    const byKey = new Map();
    list.forEach(combo => {
      const key = comboKeyFromIndices(combo.indices || []);
      if (!byKey.has(key)) byKey.set(key, combo);
    });

    const ordered = [];
    saved.forEach(key => {
      if (byKey.has(key)) {
        ordered.push(byKey.get(key));
        byKey.delete(key);
      }
    });

    byKey.forEach(combo => ordered.push(combo));
    return ordered;
  }

  function setSavedGroupOrder(meta, combos) {
    const keys = (Array.isArray(combos) ? combos : []).map(c => comboKeyFromIndices(c.indices || []));
    chaliceGroupOrder[meta.key] = keys;
  }

  function applyChaliceGroupingForSide(meta) {
    const listEl = meta.key === "depth" ? dom.chaliceDepthList : dom.chaliceStandardList;
    if (!listEl) return;

    const priorGroups = Array.from(listEl.querySelectorAll(".chalice-slot-group"));
    priorGroups.forEach(group => {
      const inner = group.querySelector(".chalice-slot-group__list");
      if (inner) {
        Array.from(inner.children).forEach(li => {
          listEl.insertBefore(li, group);
        });
      }
      group.remove();
    });

    const result = generateCombosForSide(meta);
    if (!result.combos.length) {
      installChaliceEffectDrag(listEl, meta);
      return;
    }

    const orderedCombos = orderedCombosWithSaved(meta, result.combos);
    setSavedGroupOrder(meta, orderedCombos);
    const hasMultipleCombos = orderedCombos.length >= 2;

    const slotLiByIdx = new Map();
    listEl.querySelectorAll(".chalice-slot").forEach(slot => {
      const idx = Number(slot.getAttribute("data-slot"));
      if (Number.isInteger(idx)) slotLiByIdx.set(idx, slot.closest("li"));
    });

    const orderedLis = [];
    const usedIdx = new Set();
    orderedCombos.forEach(combo => {
      const indices = [...(combo.indices || [])].sort((a, b) => a - b);
      const members = indices.map(i => slotLiByIdx.get(i)).filter(Boolean);
      if (members.length !== indices.length) return;
      members.forEach(m => {
        orderedLis.push(m);
        usedIdx.add(Number(m.querySelector(".chalice-slot")?.getAttribute("data-slot")));
      });
    });

    slotLiByIdx.forEach((li, idx) => {
      if (!usedIdx.has(idx)) orderedLis.push(li);
    });

    if (orderedLis.length) {
      listEl.innerHTML = "";
      orderedLis.forEach(li => listEl.appendChild(li));
    }

    const used = new Set();

    orderedCombos.forEach((combo) => {
      const indices = [...combo.indices].sort((a, b) => a - b);
      const members = indices.map(i => slotLiByIdx.get(i)).filter(Boolean);
      if (members.length !== indices.length) return;
      if (members.some(node => used.has(node))) return;

      const groupLi = document.createElement("li");
      groupLi.className = "chalice-slot-group";
      const groupKey = comboKeyFromIndices(combo.indices || []);
      groupLi.dataset.chGroupKey = groupKey;
      groupLi.dataset.side = meta.key;

      if (hasMultipleCombos) {
        const handle = document.createElement("div");
        handle.className = "chalice-slot-group__handle";
        handle.setAttribute("aria-hidden", "true");
        groupLi.appendChild(handle);
      }

      const innerList = document.createElement("ol");
      innerList.className = "chalice-slot-group__list";
      groupLi.appendChild(innerList);

      const insertBeforeNode = members[0];
      listEl.insertBefore(groupLi, insertBeforeNode);

      members.forEach(node => {
        used.add(node);
        innerList.appendChild(node);
      });
    });

    const groups = Array.from(listEl.querySelectorAll(".chalice-slot-group"));
    groups.forEach((group, idx) => {
      const color = chaliceSideColor(meta, idx) || "#ffffff";
      group.style.setProperty("--chalice-group-color", color);
      group.style.borderColor = color;
      const handleDot = textColorFor(color);
      group.style.setProperty("--chalice-handle-dot-color", handleDot);
    });

    installChaliceGroupDrag(listEl, meta);
    installChaliceEffectDrag(listEl, meta);
  }

  function applyChaliceGrouping() {
    applyChaliceGroupingForSide(sideInfo("standard"));
    applyChaliceGroupingForSide(sideInfo("depth"));
  }

  return {
    comboKeyFromIndices,
    applyChaliceGrouping
  };
}
