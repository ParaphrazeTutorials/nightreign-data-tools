// Pure roll order helpers shared with UI and tests

export function getRollValue(row) {
  const raw = row?.RollOrder;
  const val = Number(raw);
  if (raw === "" || raw == null || !Number.isFinite(val)) return Number.POSITIVE_INFINITY;
  return val;
}

export function computeRollOrderIssue(a, b, c) {
  const original = [a, b, c];
  const picked = original.filter(Boolean);

  if (picked.length <= 1) {
    return {
      hasIssue: false,
      sorted: original,
      movedSlots: [false, false, false],
      moveDeltaBySlot: [0, 0, 0]
    };
  }

  const sortedPicked = [...picked].sort((x, y) => getRollValue(x) - getRollValue(y));

  const slotToPickedIndex = [-1, -1, -1];
  let k = 0;
  for (let i = 0; i < original.length; i++) {
    if (!original[i]) continue;
    slotToPickedIndex[i] = k;
    k++;
  }

  const idToSortedIndex = new Map(sortedPicked.map((r, idx) => [String(r.EffectID), idx]));

  const movedSlots = [false, false, false];
  const moveDeltaBySlot = [0, 0, 0];

  for (let i = 0; i < original.length; i++) {
    const row = original[i];
    if (!row) continue;

    const cur = slotToPickedIndex[i];
    const want = idToSortedIndex.get(String(row.EffectID));
    if (want == null || cur == null || cur < 0) continue;

    const delta = want - cur;
    moveDeltaBySlot[i] = delta;
    movedSlots[i] = delta !== 0;
  }

  const sortedSlots = original.slice();
  let j = 0;
  for (let i = 0; i < sortedSlots.length; i++) {
    if (!sortedSlots[i]) continue;
    sortedSlots[i] = sortedPicked[j];
    j++;
  }

  const hasIssue = movedSlots.some(Boolean);

  return {
    hasIssue,
    sorted: sortedSlots,
    movedSlots,
    moveDeltaBySlot
  };
}
