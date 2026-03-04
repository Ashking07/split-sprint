/**
 * Server-side settlement (mirrors src/lib/settlement).
 * Deterministic cent rounding. Totals reconcile exactly.
 */

function equalSplitShares(totalCents, participantIds) {
  const n = participantIds.length;
  if (n <= 0) return {};
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  const out = {};
  participantIds.forEach((id, i) => {
    out[id] = base + (i < remainder ? 1 : 0);
  });
  return out;
}

function itemizedSplitShares(items, taxCents, tipCents, participantIds, participantsByItem = {}) {
  const n = participantIds.length;
  if (n <= 0) return {};

  const shares = Object.fromEntries(participantIds.map((id) => [id, 0]));

  for (const item of items) {
    const assigned =
      (participantsByItem[item.id] || []).filter((id) => participantIds.includes(id)) ||
      participantIds;
    if (assigned.length === 0) continue;
    const itemTotal = item.qty * item.unitPriceCents;
    const perPerson = Math.floor(itemTotal / assigned.length);
    const remainder = itemTotal - perPerson * assigned.length;
    assigned.forEach((id, i) => {
      shares[id] = (shares[id] ?? 0) + perPerson + (i < remainder ? 1 : 0);
    });
  }

  const taxTipTotal = taxCents + tipCents;
  const taxTipPerPerson = Math.floor(taxTipTotal / n);
  const taxTipRemainder = taxTipTotal - taxTipPerPerson * n;
  participantIds.forEach((id, i) => {
    shares[id] = (shares[id] ?? 0) + taxTipPerPerson + (i < taxTipRemainder ? 1 : 0);
  });
  return shares;
}

function computeShares(bill, participantIds) {
  const subtotal = (bill.items || []).reduce(
    (s, it) => s + it.qty * it.unitPriceCents,
    0
  );
  const total = subtotal + (bill.taxCents || 0) + (bill.tipCents || 0);

  let shares;
  if (bill.splitMode === "equal") {
    shares = equalSplitShares(total, participantIds);
  } else {
    shares = itemizedSplitShares(
      bill.items || [],
      bill.taxCents || 0,
      bill.tipCents || 0,
      participantIds,
      bill.participantsByItem || {}
    );
  }

  const result = participantIds.map((id) => ({
    participantId: id,
    amountCents: shares[id] ?? 0,
  }));

  const sum = result.reduce((s, r) => s + r.amountCents, 0);
  if (sum !== total && participantIds.length > 0) {
    result[0].amountCents += total - sum;
  }
  return result;
}

function computeWhoOwesPayer(shares, payerId) {
  return shares
    .filter((s) => s.participantId !== payerId && s.amountCents > 0)
    .map((s) => ({ participantId: s.participantId, amountCents: s.amountCents }));
}

export function computeSettlementSnapshot(bill, participantIds, payerId) {
  const shares = computeShares(bill, participantIds);
  const whoOwesPayer = computeWhoOwesPayer(shares, payerId);
  return { shares, whoOwesPayer };
}
