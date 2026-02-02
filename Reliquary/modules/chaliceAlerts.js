import { escapeHtml } from "./uiHelpers.js";

export function createChaliceAlertController(dom, {
  alertIconUrl,
  moveIndicatorHtml,
  isAutoSortEnabled,
  getShowIllegalActive,
  lastChaliceIconOffsets,
  setLastChaliceIssues,
  setLastChaliceIssueAssignments,
  lastChaliceIssueAssignments
}) {
  const seenChaliceBadges = new Set();

  function buildChaliceIssueAssignments(issues) {
    const perSlot = new Map();
    const rail = { errors: [], warnings: [] };
    const counters = { error: 0, warning: 0 };

    const process = (arr, severity) => {
      const list = Array.isArray(arr) ? arr : [];
      list.forEach(item => {
        const isObj = typeof item === "object" && item !== null;
        const message = isObj ? (item.message || String(item)) : String(item);
        const slots = isObj && Array.isArray(item.slots) ? item.slots : [];
        const code = isObj ? (item.code || "") : "";
        const badge = { num: ++counters[severity], message, severity, code };

        if (severity === "error") {
          rail.errors.push(badge);
        } else {
          rail.warnings.push(badge);
        }

        slots.forEach(slot => {
          const side = slot?.side || "standard";
          const idx = Number.parseInt(slot?.slot, 10);
          if (!Number.isInteger(idx) || idx < 0) return;
          const key = `${side}:${idx}`;
          if (!perSlot.has(key)) perSlot.set(key, { errors: [], warnings: [] });
          const bucket = severity === "error" ? perSlot.get(key).errors : perSlot.get(key).warnings;
          bucket.push(badge);
        });
      });
    };

    process(issues?.errors, "error");
    process(issues?.warnings, "warning");

    return { rail, perSlot };
  }

  function chaliceBadgeKey(_scope, severity, badge, _side = "", _slotIdx = null) {
    const numPart = Number.isFinite(badge?.num) ? `num:${badge.num}` : "";
    const codePart = badge?.code ? `code:${badge.code}` : "";
    const messagePart = badge?.message ? `msg:${badge.message}` : "";
    return ["badge", severity, numPart || codePart || messagePart].filter(Boolean).join(":");
  }

  function isChaliceBadgeSeen(key) {
    return key ? seenChaliceBadges.has(key) : false;
  }

  function markChaliceBadgeSeen(key, el) {
    if (!key) return;
    if (!seenChaliceBadges.has(key)) {
      seenChaliceBadges.add(key);
    }
    const targets = el ? [el, ...document.querySelectorAll(`[data-badge-key="${CSS.escape(key)}"]`)] : [];
    targets.forEach(node => node.classList.remove("chalice-badge--pulse"));
  }

  function installChaliceBadgeSeenHandlers(root) {
    if (!root) return;
    root.querySelectorAll("[data-badge-key]").forEach(el => {
      const key = el.getAttribute("data-badge-key") || "";
      if (!key) return;
      if (isChaliceBadgeSeen(key)) {
        el.classList.remove("chalice-badge--pulse");
        return;
      }
      const stopPulse = () => markChaliceBadgeSeen(key, el);
      el.addEventListener("pointerenter", stopPulse, { passive: true });
      el.addEventListener("focus", stopPulse, { passive: true });
    });
  }

  function positionCollapsedAlertIcons(warnIcon, errIcon, rail) {
    if (rail) rail.style.paddingTop = "";
    [warnIcon, errIcon].forEach(icon => {
      if (icon) icon.style.top = "";
    });
  }

  function positionChaliceAlertIcons() {
    const rail = dom.chaliceAlertIconStack;
    if (!rail || rail.hidden) return;

    const details = dom.chaliceDetails;
    const isCollapsed = details?.dataset?.detailsState === "collapsed";

    const warnIcon = dom.chaliceAlertIconWarning;
    const errIcon = dom.chaliceAlertIconError;

    if (isCollapsed) {
      positionCollapsedAlertIcons(warnIcon, errIcon, rail);
      return;
    }

    const warnHeader = dom.chaliceAlertPanelWarning?.querySelector(".chalice-alert-panel__header");
    const errHeader = dom.chaliceAlertPanelError?.querySelector(".chalice-alert-panel__header");

    const railRect = rail.getBoundingClientRect();
    if (!railRect || !railRect.height) return;

    const placeIcon = (iconEl, headerEl, key) => {
      if (!iconEl || iconEl.hidden || !headerEl) {
        if (iconEl) iconEl.style.top = "";
        lastChaliceIconOffsets[key] = null;
        return;
      }
      const headerRect = headerEl.getBoundingClientRect();
      const iconHeight = iconEl.getBoundingClientRect().height || 0;
      const targetCenter = headerRect.top + headerRect.height * 0.5;
      const offset = targetCenter - railRect.top - iconHeight * 0.5 - 4;
      const clamped = Math.max(0, offset);
      iconEl.style.top = `${clamped}px`;
      lastChaliceIconOffsets[key] = clamped;
    };

    placeIcon(warnIcon, warnHeader, "warning");
    placeIcon(errIcon, errHeader, "error");
  }

  function positionChaliceAlertCounts() {
    const rail = dom.chaliceAlertIconStack;
    const warnRoot = document.getElementById("chaliceAlertCountsWarning");
    const errRoot = document.getElementById("chaliceAlertCountsError");
    const warnList = dom.chaliceAlertListWarning;
    const errList = dom.chaliceAlertListError;
    const detailsState = dom.chaliceResultsShell?.dataset?.detailsState || dom.chaliceLayout?.dataset?.detailsState || "";
    const isCollapsed = detailsState === "collapsed";

    const resetRoot = (root) => {
      if (!root) return;
      root.style.position = "";
      root.style.top = "";
      root.style.left = "";
      root.style.transform = "";
      root.style.height = "";
      const ol = root.querySelector("ol");
      if (ol) {
        ol.style.position = "";
        Array.from(ol.children).forEach(li => {
          li.style.position = "";
          li.style.top = "";
          li.style.left = "";
          li.style.transform = "";
        });
      }
    };

    if (!rail || rail.hidden || isCollapsed) {
      resetRoot(warnRoot);
      resetRoot(errRoot);
      return;
    }

    const railRect = rail.getBoundingClientRect();
    if (!railRect || !railRect.height) {
      resetRoot(warnRoot);
      resetRoot(errRoot);
      return;
    }

    const placeCounts = (root, listEl) => {
      if (!root || root.hidden) {
        resetRoot(root);
        return;
      }
      const ol = root.querySelector("ol");
      if (!ol || !listEl) {
        resetRoot(root);
        return;
      }
      const items = Array.from(listEl.querySelectorAll(".chalice-alert__item"));
      if (!items.length) {
        resetRoot(root);
        return;
      }

      const badgeItems = Array.from(ol.children);
      const firstRect = items[0].getBoundingClientRect();
      const badgeHeight = badgeItems[0]?.getBoundingClientRect()?.height || 0;
      const baseTop = Math.max(0, firstRect.top - railRect.top);

      root.style.position = "absolute";
      root.style.left = "50%";
      root.style.transform = "translateX(-50%)";
      root.style.top = `${baseTop}px`;

      ol.style.position = "relative";

      let maxOffset = 0;
      badgeItems.forEach((li, idx) => {
        const target = items[idx];
        if (!target) return;
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - firstRect.top;
        maxOffset = Math.max(maxOffset, offset);
        li.style.position = "absolute";
        li.style.left = "50%";
        li.style.transform = "translateX(-50%)";
        li.style.top = `${offset}px`;
      });

      const totalHeight = maxOffset + badgeHeight;
      if (totalHeight > 0) root.style.height = `${totalHeight}px`;
    };

    placeCounts(warnRoot, warnList);
    placeCounts(errRoot, errList);
  }

  function scheduleChaliceAlertLayout() {
    positionChaliceAlertIcons();
    positionChaliceAlertCounts();

    requestAnimationFrame(() => {
      positionChaliceAlertIcons();
      positionChaliceAlertCounts();
    });

    requestAnimationFrame(() => {
      positionChaliceAlertIcons();
      positionChaliceAlertCounts();
    });
  }

  function installChaliceAlertLayoutListeners() {
    const targets = [dom.chaliceDetails, dom.chaliceResultsShell, dom.chaliceLayout].filter(Boolean);
    const events = ["transitionend", "animationend"];

    targets.forEach(target => {
      events.forEach(evt => {
        target.addEventListener(evt, e => {
          const prop = e?.propertyName || "";
          if (prop && !/height|width|top|bottom|left|right|margin|padding|transform|gap/i.test(prop)) return;
          scheduleChaliceAlertLayout();
        });
      });
    });

    const observed = [dom.chaliceAlertListWarning, dom.chaliceAlertListError].filter(Boolean);
    if (observed.length && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => scheduleChaliceAlertLayout());
      observed.forEach(el => ro.observe(el));
    }
  }

  function renderChaliceAlertCounts(counts) {
    const warnRoot = document.getElementById("chaliceAlertCountsWarning");
    const errRoot = document.getElementById("chaliceAlertCountsError");

    const renderList = (root, severity, badges) => {
      if (!root) return;
      const active = Array.isArray(badges) && badges.length > 0;
      root.hidden = !active;
      root.setAttribute("aria-hidden", active ? "false" : "true");
      if (!active) {
        root.innerHTML = "";
        return;
      }
      root.innerHTML = `<ol class="chalice-alert-counts__list">${badges
        .map(b => {
          const badgeKey = chaliceBadgeKey("rail", severity, b);
          const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
          return `<li><span class="chalice-alert-counts__badge is-${severity}${pulseClass}" data-badge-key="${escapeHtml(badgeKey)}" data-tooltip="${escapeHtml(b.message)}" aria-label="${escapeHtml(b.message)}">${b.num}</span></li>`;
        })
        .join("")}</ol>`;
      installChaliceBadgeSeenHandlers(root);
    };

    renderList(warnRoot, "warning", counts?.warnings || []);
    renderList(errRoot, "error", counts?.errors || []);
  }

  function renderIllegalErrorBadge(assignments) {
    const badgeEl = dom.illegalErrorBadge;
    if (!badgeEl) return;

    const errors = assignments?.rail?.errors || [];
    const badge = errors.find(b => b?.code === "show-illegal-on");
    const shouldShow = !!badge && getShowIllegalActive();

    if (!shouldShow) {
      badgeEl.hidden = true;
      badgeEl.setAttribute("aria-hidden", "true");
      badgeEl.textContent = "";
      badgeEl.removeAttribute("data-tooltip");
      badgeEl.removeAttribute("aria-label");
      return;
    }

    const badgeKey = chaliceBadgeKey("rail", "error", badge);
    const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
    const message = badge.message || "Showing illegal combinations; Use with caution.";
    badgeEl.textContent = String(badge.num);
    badgeEl.setAttribute("data-badge-key", badgeKey);
    badgeEl.hidden = false;
    badgeEl.setAttribute("aria-hidden", "false");
    badgeEl.setAttribute("data-tooltip", message);
    badgeEl.setAttribute("aria-label", message);
    badgeEl.classList.toggle("chalice-badge--pulse", !!pulseClass.trim());
    installChaliceBadgeSeenHandlers(badgeEl.parentElement || badgeEl);
  }

  function renderAutoSortWarningBadge(assignments) {
    const badgeEl = dom.autoSortWarningBadge;
    if (!badgeEl) return;

    const warnings = assignments?.rail?.warnings || [];
    const badge = warnings.find(b => b?.code === "auto-sort-off");
    const shouldShow = !!badge && !isAutoSortEnabled();

    if (!shouldShow) {
      badgeEl.hidden = true;
      badgeEl.setAttribute("aria-hidden", "true");
      badgeEl.textContent = "";
      badgeEl.removeAttribute("data-tooltip");
      badgeEl.removeAttribute("aria-label");
      return;
    }

    const badgeKey = chaliceBadgeKey("rail", "warning", badge);
    const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
    const message = badge.message || "Auto-Sort is off. Use with caution.";
    badgeEl.textContent = String(badge.num);
    badgeEl.setAttribute("data-badge-key", badgeKey);
    badgeEl.hidden = false;
    badgeEl.setAttribute("aria-hidden", "false");
    badgeEl.setAttribute("data-tooltip", message);
    badgeEl.setAttribute("aria-label", message);
    badgeEl.classList.toggle("chalice-badge--pulse", !!pulseClass.trim());
    installChaliceBadgeSeenHandlers(badgeEl.parentElement || badgeEl);
  }

  function updateChaliceSlotIssues(assignments = lastChaliceIssueAssignments, validSlots = new Set(), rollMoves = new Map()) {
    const perSlot = assignments?.perSlot && typeof assignments.perSlot.get === "function"
      ? assignments.perSlot
      : new Map();

    document.querySelectorAll(".chalice-slot").forEach(slot => {
      slot.classList.remove("chalice-slot--warning", "chalice-slot--error", "chalice-slot--valid");
      const badgeTarget = slot.querySelector("[data-ch-issue-badges]");
      if (badgeTarget) badgeTarget.innerHTML = "";

      const side = slot.getAttribute("data-side") || "standard";
      const idx = Number.parseInt(slot.getAttribute("data-slot"), 10);
      const key = Number.isInteger(idx) ? `${side}:${idx}` : null;
      const entry = key && perSlot.has(key) ? (perSlot.get(key) || { errors: [], warnings: [] }) : { errors: [], warnings: [] };
      const rollMove = key && rollMoves instanceof Map ? rollMoves.get(key) : null;
      const hasRollIndicator = !!rollMove && !isAutoSortEnabled();
      const hasErrors = Array.isArray(entry.errors) && entry.errors.length > 0;
      const hasWarnings = Array.isArray(entry.warnings) && entry.warnings.length > 0;
      const slotHasEffect = !slot.classList.contains("chalice-slot--empty");
      const isValid = slotHasEffect && !hasErrors && !hasWarnings && key && validSlots instanceof Set && validSlots.has(key);

      if (hasErrors) slot.classList.add("chalice-slot--error");
      else if (hasWarnings) slot.classList.add("chalice-slot--warning");
      else if (isValid) slot.classList.add("chalice-slot--valid");

      if (!badgeTarget) return;
      const badges = [];
      const tooltipParts = [];
      if (hasErrors) {
        entry.errors.forEach(b => {
          if (hasRollIndicator && b?.code === "roll-order") return;
          const badgeKey = chaliceBadgeKey("slot", "error", b, side, idx);
          const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
          badges.push(`<span class="chalice-slot__issue-badge is-error${pulseClass}" data-badge-key="${escapeHtml(badgeKey)}" data-tooltip="${escapeHtml(b.message)}" aria-label="${escapeHtml(b.message)}">${b.num}</span>`);
          tooltipParts.push(b.message || "");
        });
      }
      if (hasWarnings) {
        entry.warnings.forEach(b => {
          if (hasRollIndicator && b?.code === "roll-order") return;
          const badgeKey = chaliceBadgeKey("slot", "warning", b, side, idx);
          const pulseClass = isChaliceBadgeSeen(badgeKey) ? "" : " chalice-badge--pulse";
          badges.push(`<span class="chalice-slot__issue-badge is-warning${pulseClass}" data-badge-key="${escapeHtml(badgeKey)}" data-tooltip="${escapeHtml(b.message)}" aria-label="${escapeHtml(b.message)}">${b.num}</span>`);
          tooltipParts.push(b.message || "");
        });
      }

      if (hasRollIndicator) {
        badges.push(moveIndicatorHtml(rollMove.delta, rollMove.showOk));
      }

      if (!badges.length && isValid) badges.push(renderValidCheck());
      badgeTarget.innerHTML = badges.join("");
      installChaliceBadgeSeenHandlers(badgeTarget);

      const tooltipText = tooltipParts.join(" | ").trim();
      if (tooltipText && !hasRollIndicator) {
        badgeTarget.setAttribute("data-tooltip", tooltipText);
        badgeTarget.setAttribute("aria-label", tooltipText);
      } else {
        badgeTarget.removeAttribute("data-tooltip");
        badgeTarget.removeAttribute("aria-label");
      }
    });
  }

  function renderValidCheck() {
    return `
      <span class="chalice-slot__valid-check" aria-label="Valid effect" title="Valid effect">
        <span class="check-box" aria-hidden="true"></span>
      </span>
    `;
  }

  function renderChaliceAlerts(issues, assignments = lastChaliceIssueAssignments) {
    setLastChaliceIssues(issues || { errors: [], warnings: [] });
    if (!assignments) assignments = buildChaliceIssueAssignments(issues);
    setLastChaliceIssueAssignments(assignments);

    const layout = dom.chaliceLayout;
    const iconStack = dom.chaliceAlertIconStack;
    const iconError = dom.chaliceAlertIconError;
    const iconWarning = dom.chaliceAlertIconWarning;
    const panelWarn = dom.chaliceAlertPanelWarning;
    const panelWarnTitle = dom.chaliceAlertPanelTitleWarning;
    const listWarn = dom.chaliceAlertListWarning;
    const panelErr = dom.chaliceAlertPanelError;
    const panelErrTitle = dom.chaliceAlertPanelTitleError;
    const listErr = dom.chaliceAlertListError;

    if (!panelWarn || !panelErr || !listWarn || !listErr) return;

    const errors = Array.isArray(issues?.errors) ? issues.errors : [];
    const warnings = Array.isArray(issues?.warnings) ? issues.warnings : [];
    const msgText = (entry) => (typeof entry === "object" && entry !== null ? entry.message || String(entry) : String(entry));

    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;
    const hasAny = hasErrors || hasWarnings;

    if (!hasAny) {
      if (layout) layout.classList.remove("has-chalice-alerts");
      panelWarn.hidden = true;
      panelWarn.setAttribute("aria-hidden", "true");
      listWarn.innerHTML = "";
      panelErr.hidden = true;
      panelErr.setAttribute("aria-hidden", "true");
      listErr.innerHTML = "";
      if (iconStack) {
        iconStack.hidden = false;
        iconStack.setAttribute("aria-hidden", "false");
      }
      if (iconError) {
        iconError.hidden = true;
        iconError.removeAttribute("src");
      }
      if (iconWarning) {
        iconWarning.hidden = true;
        iconWarning.removeAttribute("src");
      }
      renderChaliceAlertCounts({ errors: [], warnings: [] });
      positionChaliceAlertCounts();
      return;
    }

    if (layout) layout.classList.add("has-chalice-alerts");
    const showErrorIcon = hasErrors;
    const showWarningIcon = hasWarnings;

    if (iconStack) {
      iconStack.hidden = false;
      iconStack.setAttribute("aria-hidden", "false");
    }

    if (iconError) {
      if (showErrorIcon) {
        iconError.src = alertIconUrl("error");
        iconError.alt = "Errors present";
        iconError.hidden = false;
      } else {
        iconError.hidden = true;
        iconError.removeAttribute("src");
      }
    }

    if (iconWarning) {
      if (showWarningIcon) {
        iconWarning.src = alertIconUrl("warning");
        iconWarning.alt = "Warnings present";
        iconWarning.hidden = false;
      } else {
        iconWarning.hidden = true;
        iconWarning.removeAttribute("src");
      }
    }

    if (hasWarnings) {
      const warningMsg = warnings
        .map(entry => `<li class="chalice-alert__item chalice-alert__item--warning">${escapeHtml(msgText(entry))}</li>`)
        .join("");
      listWarn.innerHTML = warningMsg;
      panelWarn.hidden = false;
      panelWarn.setAttribute("aria-hidden", "false");
      if (panelWarnTitle) {
        panelWarnTitle.textContent = warnings.length > 1 ? "Warnings detected" : "Warning detected";
      }
    } else {
      listWarn.innerHTML = "";
      panelWarn.hidden = true;
      panelWarn.setAttribute("aria-hidden", "true");
    }

    if (hasErrors) {
      const errorMsg = errors
        .map(entry => `<li class="chalice-alert__item chalice-alert__item--error">${escapeHtml(msgText(entry))}</li>`)
        .join("");
      listErr.innerHTML = errorMsg;
      panelErr.hidden = false;
      panelErr.setAttribute("aria-hidden", "false");
      if (panelErrTitle) {
        panelErrTitle.textContent = errors.length > 1 ? "Errors detected" : "Error detected";
      }
    } else {
      listErr.innerHTML = "";
      panelErr.hidden = true;
      panelErr.setAttribute("aria-hidden", "true");
    }

    renderChaliceAlertCounts(assignments?.rail || { errors: [], warnings: [] });
    scheduleChaliceAlertLayout();
  }

  return {
    buildChaliceIssueAssignments,
    renderChaliceAlerts,
    renderIllegalErrorBadge,
    renderAutoSortWarningBadge,
    updateChaliceSlotIssues,
    scheduleChaliceAlertLayout,
    positionChaliceAlertCounts,
    installChaliceAlertLayoutListeners
  };
}
