import type { ReceiptItem } from "../app/types";
import type { Person } from "../app/types";

/**
 * Generate a shareable text summary for Export to Splitwise.
 * MVP: Copy to clipboard + open placeholder URL.
 * Real Splitwise deep link requires API/partnership - use web URL for now.
 */
export function generateSplitwiseSummary(
  merchant: string,
  date: string,
  items: ReceiptItem[],
  tax: number,
  tip: number,
  total: number,
  people: Person[],
  getPersonShare: (personId: string) => number
): string {
  const lines: string[] = [
    `SplitSprint Bill Summary`,
    `======================`,
    ``,
    `Merchant: ${merchant}`,
    `Date: ${date}`,
    ``,
    `Items:`,
    ...items.map((i) => `  • ${i.name} (×${i.qty}) $${(i.price * i.qty).toFixed(2)}`),
    ``,
    `Tax: $${tax.toFixed(2)}`,
    tip > 0 ? `Tip: $${tip.toFixed(2)}` : null,
    `Total: $${total.toFixed(2)}`,
    ``,
    `Who owes what:`,
    ...people.map((p) => `  ${p.name}: $${getPersonShare(p.id).toFixed(2)}`),
    ``,
    `---`,
    `Export from SplitSprint. Add to Splitwise: https://www.splitwise.com/`,
  ].filter(Boolean);

  return lines.join("\n");
}

/** Placeholder URL - real deep link requires Splitwise API integration */
export const SPLITWISE_PLACEHOLDER_URL = "https://www.splitwise.com/";
