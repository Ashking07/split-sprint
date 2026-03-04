/**
 * Helpers for money in integer cents.
 * Rule: Store and compute in cents; format for display only.
 */

/** Format cents as dollar string (e.g. 1234 -> "$12.34") */
export function formatCents(cents: number, currency = "USD"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const c = abs % 100;
  const pad = c < 10 ? "0" : "";
  return `${sign}$${dollars}.${pad}${c}`;
}

/** Parse dollar string to cents (e.g. "12.34" -> 1234) */
export function parseToCents(value: string): number {
  const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/** Convert dollars to cents */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert cents to dollars */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Compute subtotal from items: sum(qty * unitPriceCents) */
export function subtotalCents(
  items: { qty: number; unitPriceCents: number }[]
): number {
  return items.reduce((sum, it) => sum + it.qty * it.unitPriceCents, 0);
}

/** Compute total: subtotal + tax + tip */
export function totalCents(
  subtotalCents: number,
  taxCents: number,
  tipCents: number
): number {
  return subtotalCents + taxCents + tipCents;
}
