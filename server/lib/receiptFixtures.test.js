import { describe, it, expect } from "vitest";
import { parseReceiptFromText } from "./openaiReceiptParser.js";

const RECEIPT_FIXTURES = [
  `Pizza Margherita  14.99
Caesar Salad  8.50
Craft Beer × 3  18.00
Subtotal  52.99
Tax  4.28
TOTAL  57.27`,
  `COFFEE SHOP
Espresso  2.50
Latte  4.00
Croissant  3.50
---
Total  10.00`,
  `Item A $5.99
Item B $12.99
Tax $1.50`,
];

describe.skipIf(!process.env.OPENAI_API_KEY)(
  "Receipt text fixtures - parse does not crash (requires OPENAI_API_KEY)",
  () => {
  it.each(RECEIPT_FIXTURES)("parses fixture without throwing", async (text) => {
    const result = await parseReceiptFromText(text, "USD");
    expect(result).toBeDefined();
    expect(result.items).toBeInstanceOf(Array);
    expect(result.currency).toBe("USD");
    expect(result.taxCents).toBeGreaterThanOrEqual(0);
    expect(result.tipCents).toBeGreaterThanOrEqual(0);
    expect(result.totalCents).toBeGreaterThanOrEqual(0);
    expect(result.notes).toBeInstanceOf(Array);
  });
});
