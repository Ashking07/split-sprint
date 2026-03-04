import type { ReceiptItem } from "../app/types";

/**
 * Sum of all item totals (price * qty).
 */
export function subtotal(items: ReceiptItem[]): number {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

/**
 * Total = subtotal + tax + tip.
 */
export function total(subtotalAmount: number, tax: number, tip: number): number {
  return subtotalAmount + tax + tip;
}

/**
 * Equal split: total / n, rounded to cents.
 * Uses banker's rounding for fairness.
 */
export function equalSplit(totalAmount: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((totalAmount * 100) / n) / 100;
  const remainder = Math.round((totalAmount - base * n) * 100);
  const shares: number[] = [];
  for (let i = 0; i < n; i++) {
    const extra = i < remainder ? 0.01 : 0;
    shares.push(Math.round((base + extra) * 100) / 100);
  }
  return shares;
}

/**
 * Itemized split: distribute each item among assigned members,
 * then prorate tax + tip evenly across all participants.
 *
 * participantsByItem: Record<itemId, memberId[]>
 * memberIds: ordered list of all participants (for share index)
 */
export function itemizedSplit(
  items: ReceiptItem[],
  participantsByItem: Record<string, string[]>,
  tax: number,
  tip: number,
  memberIds: string[]
): Record<string, number> {
  const n = memberIds.length;
  if (n === 0) return {};

  const shares: Record<string, number> = Object.fromEntries(
    memberIds.map((id) => [id, 0])
  );

  // Distribute each item among its assigned participants
  for (const item of items) {
    const assigned = participantsByItem[item.id] ?? memberIds;
    const itemTotal = item.price * item.qty;
    const perPerson = itemTotal / assigned.length;
    for (const mid of assigned) {
      if (shares[mid] !== undefined) {
        shares[mid] += Math.round(perPerson * 100) / 100;
      }
    }
  }

  // Prorate tax + tip evenly
  const taxTipPerPerson = (tax + tip) / n;
  for (const mid of memberIds) {
    shares[mid] = Math.round((shares[mid] + taxTipPerPerson) * 100) / 100;
  }

  return shares;
}
