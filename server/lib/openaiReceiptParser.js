/**
 * Server-only OpenAI receipt parser.
 * Uses vision for images, text for pasted content.
 * Structured outputs ensure valid JSON matching our schema.
 */

import OpenAI from "openai";

const RECEIPT_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "receipt_parse",
    strict: true,
    schema: {
      type: "object",
      properties: {
        merchant: { type: ["string", "null"] },
        receiptDate: { type: ["string", "null"] },
        currency: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              qty: { type: "integer" },
              unitPriceCents: { type: "integer" },
              confidence: { type: "number" },
            },
            required: ["name", "qty", "unitPriceCents", "confidence"],
            additionalProperties: false,
          },
        },
        taxCents: { type: "integer" },
        tipCents: { type: "integer" },
        totalCents: { type: "integer" },
        notes: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["merchant", "receiptDate", "currency", "items", "taxCents", "tipCents", "totalCents", "notes"],
      additionalProperties: false,
    },
  },
};

const JUNK_PATTERNS = [
  /^SUBTOTAL$/i,
  /^TOTAL$/i,
  /^TAX$/i,
  /^TIP$/i,
  /^VISA\s*\*+/i,
  /^MC\s*\*+/i,
  /^AMEX\s*\*+/i,
  /^DISCOVER\s*\*+/i,
  /^THANK YOU/i,
  /^CARD\s*#/i,
  /^CHANGE$/i,
  /^CASH$/i,
  /^BALANCE$/i,
  /^AMOUNT DUE$/i,
  /^REF#/i,
  /^CHIP\s|CONTACTLESS/i,
  /^[-=*_]{3,}$/,
];

const RECEIPT_SYSTEM_PROMPT = `You are an expert receipt parser. Extract structured data from ANY receipt: grocery, restaurant, retail, gas, convenience store, etc.

RULES (apply to all receipt types):

1. SOURCE: Extract ONLY from the receipt itself. Ignore app UI, overlays, "Who owes what", export buttons, or any text not printed on the receipt.

2. MERCHANT: Use the store/restaurant/brand name from the header (e.g. "Smart&Final", "Chipotle", "Walmart", "Shell"). Never use "Bill", "Receipt", or placeholders. If unclear, use the most prominent business name.

3. DATE: receiptDate as yyyy-mm-dd ONLY if a date is clearly printed. Otherwise null. Do not infer or guess.

4. ITEMS - handle all formats:
   - Count: "3 @ $0.99" → qty=3, unitPriceCents=99
   - WEIGHT-BASED (lb, kg, oz): "Bananas 2.66 lb @ 0.59/lb" or "2.66 lb @ 0.59 USD/lb" with total $1.57 → qty=1, unitPriceCents=157 (use the TOTAL as unitPriceCents; do NOT use price-per-pound). Same for produce, meat, deli—weight items get qty=1 and unitPriceCents=total in cents.
   - Single: "Coffee $3.50" → qty=1, unitPriceCents=350
   - Repeated lines: 3× "Yogurt $1.69" → one item qty=3, unitPriceCents=169
   - Use actual item names (e.g. "Paper Bag"), NOT category headers (e.g. "General", "Produce", "Dairy")
   - Match each item to ITS OWN price—never mix up adjacent items
   - Use the final/discounted price when "Regular Price" or sale price is shown (e.g. "Reg $4.99" then "$4.69 F" → use 469 cents)
   - Exclude: SUBTOTAL, TOTAL, TAX, TIP, card numbers, THANK YOU, payment method

5. TAX: Use taxCents=0 when receipt shows 0% tax, 0.000% tax, $0.00 tax, or "0.00" on the tax line. NEVER guess or use a tax amount from another receipt. Only use the exact tax number printed on THIS receipt. If tax line shows zero, taxCents=0.

6. TIP: Use tipCents=0 unless a tip line is present (common on restaurant receipts).

7. TOTAL: Must match the receipt TOTAL exactly. This is the final amount paid.

8. CONFIDENCE: 0-1 per item. Lower for blurry text, unusual formats, or ambiguous prices.

9. NOTES: Add parsing caveats (e.g. "Weight-based item approximated", "Discount applied") when relevant.

All amounts in integer cents. Currency from hint or receipt.`;

function isJunk(name) {
  const t = String(name || "").trim();
  return JUNK_PATTERNS.some((p) => p.test(t)) || t.length < 2;
}

function normalizeParsedOutput(raw) {
  const items = (raw.items || [])
    .filter((it) => !isJunk(it.name))
    .map((it, i) => ({
      name: String(it.name || "Unknown").trim() || "Unknown",
      qty: Math.max(1, Math.floor(Number(it.qty)) || 1),
      unitPriceCents: Math.max(0, Math.floor(Number(it.unitPriceCents)) || 0),
      confidence: Math.min(1, Math.max(0, Number(it.confidence) ?? 0.8)),
    }))
    .filter((it) => it.name !== "Unknown" || it.unitPriceCents > 0);

  const taxCents = Math.max(0, Math.floor(Number(raw.taxCents) ?? 0));
  const tipCents = Math.max(0, Math.floor(Number(raw.tipCents) ?? 0));
  const totalCents = Math.max(0, Math.floor(Number(raw.totalCents) ?? 0));
  const notes = [...(raw.notes || [])];

  const computedSubtotal = items.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);
  const computedTotal = computedSubtotal + taxCents + tipCents;
  if (Math.abs(computedTotal - totalCents) > 1) {
    notes.push(`Totals may be inconsistent: computed ${computedTotal} vs parsed ${totalCents} cents`);
  }

  return {
    merchant: raw.merchant != null ? String(raw.merchant).trim() || null : null,
    receiptDate: raw.receiptDate != null ? String(raw.receiptDate).trim() || null : null,
    currency: String(raw.currency || "USD").trim() || "USD",
    items,
    taxCents,
    tipCents,
    totalCents,
    notes,
  };
}

export async function parseReceiptFromImage(imageBase64, currencyHint = "USD") {
  const apiKey = process.env.OPENAI_API_KEY;
  // gpt-4o-mini is fast/cheap; set OPENAI_RECEIPT_MODEL=gpt-4o for complex receipts
  const model = process.env.OPENAI_RECEIPT_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });

  const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `${RECEIPT_SYSTEM_PROMPT}\n\nCurrency hint: ${currencyHint}. Output valid JSON matching the schema.`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    response_format: RECEIPT_SCHEMA,
  });

  const text = completion.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from OpenAI");
  const parsed = JSON.parse(text);
  return normalizeParsedOutput(parsed);
}

export async function parseReceiptFromText(pastedText, currencyHint = "USD") {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_RECEIPT_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `${RECEIPT_SYSTEM_PROMPT}\n\nCurrency hint: ${currencyHint}. Output valid JSON matching the schema.`,
      },
      {
        role: "user",
        content: pastedText,
      },
    ],
    response_format: RECEIPT_SCHEMA,
  });

  const text = completion.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from OpenAI");
  const parsed = JSON.parse(text);
  return normalizeParsedOutput(parsed);
}
