import { z } from "zod";

const MAX_BASE64_BYTES = 5 * 1024 * 1024; // ~5MB
const MAX_PASTED_CHARS = 50000;

export const parseReceiptRequestSchema = z
  .object({
    imageBase64: z.string().optional(),
    pastedText: z.string().optional(),
    currencyHint: z.string().optional().default("USD"),
  })
  .refine(
    (data) => !!data.imageBase64 || !!data.pastedText,
    { message: "Either imageBase64 or pastedText is required" }
  )
  .refine(
    (data) => !data.imageBase64 || data.imageBase64.length * 0.75 <= MAX_BASE64_BYTES,
    { message: "Image too large (max ~5MB)" }
  )
  .refine(
    (data) => !data.pastedText || data.pastedText.length <= MAX_PASTED_CHARS,
    { message: "Pasted text too long" }
  );

export const parseReceiptItemSchema = z.object({
  name: z.string(),
  qty: z.number().int().min(1),
  unitPriceCents: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

export const parseReceiptResponseSchema = z.object({
  merchant: z.string().nullable(),
  receiptDate: z.string().nullable(),
  currency: z.string(),
  items: z.array(parseReceiptItemSchema),
  taxCents: z.number().int().min(0),
  tipCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
  notes: z.array(z.string()),
});
