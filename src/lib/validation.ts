/**
 * Basic form validation helpers.
 */

export function isValidPrice(value: string | number): boolean {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return !isNaN(n) && n >= 0 && n < 1_000_000;
}

export function isValidQuantity(value: string | number): boolean {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return Number.isInteger(n) && n >= 1 && n <= 999;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
