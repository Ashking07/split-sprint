import type { ReceiptItem } from "../app/types";

/**
 * Parse pasted receipt text into line items using regex.
 * Patterns: "Item Name ... $X.XX" or "Item Name  X.XX" or "Item Name $X.XX"
 *
 * Returns items with confidence 0.8 for regex matches, 0.5 for uncertain parses.
 *
 * TODO: OCR integration would plug in here - replace this with OCR output
 * and set confidence based on OCR certainty scores.
 */
export function parseReceipt(text: string): ReceiptItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const items: ReceiptItem[] = [];
  let idCounter = 0;

  // Match: optional leading text, then price at end
  // e.g. "Margherita Pizza    14.99" or "Caesar Salad  $8.50" or "Beer $18.00"
  const pricePattern =
    /^(.+?)\s+[\$]?(\d+\.?\d*)\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip common non-item lines
    if (
      /^(subtotal|tax|tip|total|tota|amount due|balance|change)\s*$/i.test(
        trimmed
      ) ||
      /^[-=*_]+$/.test(trimmed)
    ) {
      continue;
    }

    const match = trimmed.match(pricePattern);
    if (match) {
      const name = match[1].trim();
      const price = parseFloat(match[2]);
      if (isNaN(price) || price <= 0) continue;

      // Check for quantity: "Item x 2" or "Item × 3" or "Item (2)"
      let qty = 1;
      const qtyMatch = name.match(/\s*[x×]\s*(\d+)\s*$/i) || name.match(/\s*\((\d+)\)\s*$/);
      let cleanName = name;
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10) || 1;
        cleanName = name.replace(/\s*[x×]\s*\d+\s*$/i, "").replace(/\s*\(\d+\)\s*$/, "").trim();
      }

      items.push({
        id: `parsed-${++idCounter}`,
        name: cleanName || "Unknown item",
        qty,
        price: qty > 1 ? price / qty : price,
        confidence: 0.8,
        assignedTo: [],
      });
    } else {
      // Could be item without clear price - try to extract number
      const numMatch = trimmed.match(/(.+?)\s+(\d+\.?\d*)\s*$/);
      if (numMatch) {
        const name = numMatch[1].trim();
        const price = parseFloat(numMatch[2]);
        if (!isNaN(price) && price > 0 && price < 10000) {
          items.push({
            id: `parsed-${++idCounter}`,
            name,
            qty: 1,
            price,
            confidence: 0.5,
            uncertain: true,
            assignedTo: [],
          });
        }
      }
    }
  }

  return items;
}
