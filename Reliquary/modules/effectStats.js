// Effect stats and conditional effect helpers
import {
  effectStatsRows,
  setEffectStatsRows,
  effectStatsByEffectId,
  setEffectStatsByEffectId,
  conditionalEffectState,
  conditionalEffectStacks
} from "./state.js";

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

export function statRowsForEffect(effectId) {
  if (!effectId) return [];
  return effectStatsByEffectId.get(String(effectId)) || [];
}

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

export function stackCountForEffect(effectId) {
  const key = String(effectId || "").trim();
  const max = maxStacksForEffect(effectId);
  const current = conditionalEffectStacks.has(key) ? conditionalEffectStacks.get(key) : (max > 1 ? 1 : 1);
  return Math.min(Math.max(1, current), Math.max(1, max));
}

export function setStackCountForEffect(effectId, count) {
  const key = String(effectId || "").trim();
  const max = maxStacksForEffect(effectId);
  const clamped = Math.min(Math.max(1, Number(count) || 1), Math.max(1, max));
  conditionalEffectStacks.set(key, clamped);
}

export function isConditionalEffectEnabled(effectId) {
  const key = String(effectId || "").trim();
  if (!conditionalEffectState.has(key)) conditionalEffectState.set(key, true);
  return conditionalEffectState.get(key);
}

export function setConditionalEffectEnabled(effectId, enabled) {
  const key = String(effectId || "").trim();
  conditionalEffectState.set(key, Boolean(enabled));
  if (enabled && !conditionalEffectStacks.has(key)) {
    setStackCountForEffect(key, 1);
  }
}

export function pruneConditionalEffectState(activeEffectIds) {
  const allowed = new Set((activeEffectIds || []).map(id => String(id)));
  for (const key of conditionalEffectState.keys()) {
    if (!allowed.has(key)) conditionalEffectState.delete(key);
  }
  for (const key of conditionalEffectStacks.keys()) {
    if (!allowed.has(key)) conditionalEffectStacks.delete(key);
  }
}
