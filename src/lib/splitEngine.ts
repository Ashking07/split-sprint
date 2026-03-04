/**
 * Split calculation engine.
 * All amounts in integer cents. No floats.
 *
 * Equal split: totalCents / N, remainder distributed to first k users (+1 cent each).
 * Itemized: each item split among selected members; tax+tip prorated evenly.
 */

export interface BillItem {
  id: string;
  name: string;
  qty: number;
  unitPriceCents: number;
}

export interface SplitInput {
  items: BillItem[];
  taxCents: number;
  tipCents: number;
  splitMode: "equal" | "itemized";
  participantIds: string[];
  participantsByItem?: Record<string, string[]>;
}

export interface SettlementResult {
  participantId: string;
  amountCents: number;
}

/**
 * Compute subtotal in cents: sum(qty * unitPriceCents)
 */
export function subtotalCents(items: BillItem[]): number {
  return items.reduce((sum, it) => sum + it.qty * it.unitPriceCents, 0);
}

/**
 * Compute total in cents: subtotal + tax + tip
 */
export function totalCents(
  subtotalCents: number,
  taxCents: number,
  tipCents: number
): number {
  return subtotalCents + taxCents + tipCents;
}

/**
 * Equal split: divide totalCents by N.
 * Remainder cents go to first k participants (+1 cent each).
 */
export function equalSplitCents(
  totalCents: number,
  participantIds: string[]
): Record<string, number> {
  const n = participantIds.length;
  if (n <= 0) return {};

  const baseCents = Math.floor(totalCents / n);
  const remainder = totalCents - baseCents * n;

  const result: Record<string, number> = {};
  participantIds.forEach((id, i) => {
    result[id] = baseCents + (i < remainder ? 1 : 0);
  });
  return result;
}

/**
 * Itemized split: each item divided among its assigned members.
 * Tax and tip prorated evenly across all participants.
 */
export function itemizedSplitCents(input: SplitInput): Record<string, number> {
  const {
    items,
    taxCents,
    tipCents,
    participantIds,
    participantsByItem = {},
  } = input;

  const n = participantIds.length;
  if (n <= 0) return {};

  const shares: Record<string, number> = Object.fromEntries(
    participantIds.map((id) => [id, 0])
  );

  for (const item of items) {
    const assigned =
      participantsByItem[item.id]?.filter((id) => participantIds.includes(id)) ||
      participantIds;
    const itemTotalCents = item.qty * item.unitPriceCents;
    const perPerson = Math.floor(itemTotalCents / assigned.length);
    const remainder = itemTotalCents - perPerson * assigned.length;

    assigned.forEach((id, i) => {
      shares[id] = (shares[id] || 0) + perPerson + (i < remainder ? 1 : 0);
    });
  }

  const taxTipPerPerson = Math.floor((taxCents + tipCents) / n);
  const taxTipRemainder = taxCents + tipCents - taxTipPerPerson * n;

  participantIds.forEach((id, i) => {
    shares[id] =
      (shares[id] || 0) +
      taxTipPerPerson +
      (i < taxTipRemainder ? 1 : 0);
  });

  return shares;
}

/**
 * Main entry: compute who owes what.
 */
export function computeSettlement(input: SplitInput): SettlementResult[] {
  const subtotal = subtotalCents(input.items);
  const total = totalCents(subtotal, input.taxCents, input.tipCents);

  let shares: Record<string, number>;
  if (input.splitMode === "equal") {
    shares = equalSplitCents(total, input.participantIds);
  } else {
    shares = itemizedSplitCents(input);
  }

  return input.participantIds.map((id) => ({
    participantId: id,
    amountCents: shares[id] ?? 0,
  }));
}
