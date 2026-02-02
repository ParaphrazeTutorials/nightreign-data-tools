// Effect stats and conditional effect helpers
import {
  setEffectStatsRows,
  effectStatsByEffectId,
  setEffectStatsByEffectId,
  conditionalEffectState,
  conditionalEffectStacks
} from "./state.js";

// ==================== Data ====================

/**
 * Ingest effect stat rows and build lookups keyed by EffectID.
 * @param {Array<object>} list Raw effect stat rows from data files.
 */
export function ingestEffectStats(list) {
  const rows = Array.isArray(list) ? list : [];
  const byIdMap = new Map();
  for (const row of rows) {
    const id = String(row?.EffectID ?? "").trim();
    if (!id) continue;
    if (!byIdMap.has(id)) byIdMap.set(id, []);
    byIdMap.get(id).push(row);
  }

  setEffectStatsRows(rows);
  setEffectStatsByEffectId(byIdMap);
}

/**
 * Get all effect stat rows for a specific effect id.
 * @param {string|number} effectId Effect identifier.
 * @returns {Array<object>} Matching stat rows.
 */
export function statRowsForEffect(effectId) {
  if (!effectId) return [];
  return effectStatsByEffectId.get(String(effectId)) || [];
}

// ==================== Helpers ====================

/**
 * Maximum stack count allowed for the given effect id.
 * @param {string|number} effectId Effect identifier.
 * @returns {number} Max stacks (at least 1).
 */
export function maxStacksForEffect(effectId) {
  const rows = statRowsForEffect(effectId);
  let max = 1;
  for (const row of rows) {
    if (String(row?.Stackable ?? "0") !== "1") continue;
    const m = Number.parseInt(row?.MaxStacks ?? "0", 10);
    if (Number.isFinite(m) && m > max) max = m;
  }
  return max;
}

// ==================== State ====================

/**
 * Current stack count for an effect, clamped to valid range.
 * @param {string|number} effectId Effect identifier.
 * @returns {number} Current stack count.
 */
export function stackCountForEffect(effectId) {
  const key = String(effectId || "").trim();
  const max = maxStacksForEffect(effectId);
  const current = conditionalEffectStacks.has(key) ? conditionalEffectStacks.get(key) : (max > 1 ? 1 : 1);
  return Math.min(Math.max(1, current), Math.max(1, max));
}

/**
 * Persist stack count for an effect while respecting limits.
 * @param {string|number} effectId Effect identifier.
 * @param {number} count Desired stack count.
 */
export function setStackCountForEffect(effectId, count) {
  const key = String(effectId || "").trim();
  const max = maxStacksForEffect(effectId);
  const clamped = Math.min(Math.max(1, Number(count) || 1), Math.max(1, max));
  conditionalEffectStacks.set(key, clamped);
}

/**
 * Whether a conditional effect is currently enabled.
 * @param {string|number} effectId Effect identifier.
 * @returns {boolean} True if enabled.
 */
export function isConditionalEffectEnabled(effectId) {
  const key = String(effectId || "").trim();
  if (!conditionalEffectState.has(key)) conditionalEffectState.set(key, true);
  return conditionalEffectState.get(key);
}

/**
 * Toggle a conditional effect on or off and initialize stacks if needed.
 * @param {string|number} effectId Effect identifier.
 * @param {boolean} enabled Desired enabled state.
 */
export function setConditionalEffectEnabled(effectId, enabled) {
  const key = String(effectId || "").trim();
  conditionalEffectState.set(key, Boolean(enabled));
  if (enabled && !conditionalEffectStacks.has(key)) {
    setStackCountForEffect(key, 1);
  }
}

/**
 * Remove state for conditional effects that are no longer active.
 * @param {Array<string|number>} activeEffectIds Allowed effect ids.
 */
export function pruneConditionalEffectState(activeEffectIds) {
  const allowed = new Set((activeEffectIds || []).map(id => String(id)));
  for (const key of conditionalEffectState.keys()) {
    if (!allowed.has(key)) conditionalEffectState.delete(key);
  }
  for (const key of conditionalEffectStacks.keys()) {
    if (!allowed.has(key)) conditionalEffectStacks.delete(key);
  }
}
