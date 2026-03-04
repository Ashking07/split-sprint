/**
 * Settlement engine: per-member shares and net balances.
 * All amounts in integer cents. Deterministic rounding. Totals reconcile exactly.
 */

export interface SettlementItem {
  id: string;
  name: string;
  qty: number;
  unitPriceCents: number;
}

export interface SettlementInput {
  items: SettlementItem[];
  taxCents: number;
  tipCents: number;
  splitMode: "equal" | "itemized";
  participantIds: string[];
  participantsByItem?: Record<string, string[]>;
}

/** Per-member share in cents (what each person owes) */
export interface MemberShare {
  participantId: string;
  amountCents: number;
}

/** Net balance: positive = owes, negative = owed (from payer's perspective) */
export interface NetBalance {
  participantId: string;
  amountCents: number; // positive: owes payer; negative: payer owes them
}

/** Who owes the payer and how much */
export interface WhoOwesPayer {
  participantId: string;
  amountCents: number;
}

function subtotalCents(items: SettlementItem[]): number {
  return items.reduce((sum, it) => sum + it.qty * it.unitPriceCents, 0);
}

function totalCents(subtotal: number, tax: number, tip: number): number {
  return subtotal + tax + tip;
}

/** Equal split: total / N, remainder to first k participants (+1 cent each) */
function equalSplitShares(totalCents: number, participantIds: string[]): Record<string, number> {
  const n = participantIds.length;
  if (n <= 0) return {};
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  const out: Record<string, number> = {};
  participantIds.forEach((id, i) => {
    out[id] = base + (i < remainder ? 1 : 0);
  });
  return out;
}

/** Itemized: each item split among assigned; tax+tip prorated evenly */
function itemizedSplitShares(input: SettlementInput): Record<string, number> {
  const { items, taxCents, tipCents, participantIds, participantsByItem = {} } = input;
  const n = participantIds.length;
  if (n <= 0) return {};

  const shares: Record<string, number> = Object.fromEntries(
    participantIds.map((id) => [id, 0])
  );

  for (const item of items) {
    const assigned =
      participantsByItem[item.id]?.filter((id) => participantIds.includes(id)) || participantIds;
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

/**
 * Compute per-member shares. Totals reconcile exactly.
 */
export function computeShares(input: SettlementInput): MemberShare[] {
  const subtotal = subtotalCents(input.items);
  const total = totalCents(subtotal, input.taxCents, input.tipCents);

  let shares: Record<string, number>;
  if (input.splitMode === "equal") {
    shares = equalSplitShares(total, input.participantIds);
  } else {
    shares = itemizedSplitShares(input);
  }

  const result = input.participantIds.map((id) => ({
    participantId: id,
    amountCents: shares[id] ?? 0,
  }));

  const sum = result.reduce((s, r) => s + r.amountCents, 0);
  if (sum !== total && input.participantIds.length > 0) {
    const diff = total - sum;
    result[0].amountCents += diff;
  }
  return result;
}

/**
 * Net balances: payer paid total. Each participant owes their share.
 * Positive amountCents = participant owes payer.
 */
export function computeNetBalances(
  shares: MemberShare[],
  payerId: string,
  totalCents: number
): NetBalance[] {
  const payerShare = shares.find((s) => s.participantId === payerId)?.amountCents ?? 0;
  return shares.map((s) => {
    if (s.participantId === payerId) {
      return { participantId: s.participantId, amountCents: totalCents - payerShare };
    }
    return { participantId: s.participantId, amountCents: s.amountCents };
  });
}

/**
 * Who owes the payer: list of participants who owe money (excludes payer).
 */
export function computeWhoOwesPayer(
  shares: MemberShare[],
  payerId: string
): WhoOwesPayer[] {
  return shares
    .filter((s) => s.participantId !== payerId && s.amountCents > 0)
    .map((s) => ({ participantId: s.participantId, amountCents: s.amountCents }));
}

/**
 * Full settlement: shares + who owes payer.
 * @param payerId - The member who paid the bill (typically owner)
 */
export function computeSettlement(input: SettlementInput, payerId: string) {
  const subtotal = subtotalCents(input.items);
  const total = totalCents(subtotal, input.taxCents, input.tipCents);
  const shares = computeShares(input);
  const whoOwesPayer = computeWhoOwesPayer(shares, payerId);
  return { shares, totalCents: total, whoOwesPayer };
}
