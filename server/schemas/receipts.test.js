import { describe, it, expect } from "vitest";
import {
  parseReceiptRequestSchema,
  parseReceiptResponseSchema,
} from "./receipts.js";

describe("parseReceiptRequestSchema", () => {
  it("accepts imageBase64 only", () => {
    const result = parseReceiptRequestSchema.safeParse({
      imageBase64: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts pastedText only", () => {
    const result = parseReceiptRequestSchema.safeParse({
      pastedText: "Pizza 14.99\nSalad 8.50",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when neither imageBase64 nor pastedText", () => {
    const result = parseReceiptRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects when both empty", () => {
    const result = parseReceiptRequestSchema.safeParse({
      imageBase64: "",
      pastedText: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects imageBase64 too large when > ~5MB", () => {
    const large = "a".repeat(7 * 1024 * 1024); // ~7MB base64
    const result = parseReceiptRequestSchema.safeParse({
      imageBase64: large,
    });
    expect(result.success).toBe(false);
  });

  it("rejects pastedText too long", () => {
    const long = "x".repeat(60000);
    const result = parseReceiptRequestSchema.safeParse({
      pastedText: long,
    });
    expect(result.success).toBe(false);
  });

  it("defaults currencyHint to USD", () => {
    const result = parseReceiptRequestSchema.safeParse({
      pastedText: "Pizza 10",
    });
    expect(result.success).toBe(true);
    expect(result.data.currencyHint).toBe("USD");
  });
});

describe("parseReceiptResponseSchema", () => {
  it("accepts valid response", () => {
    const result = parseReceiptResponseSchema.safeParse({
      merchant: "Test Store",
      receiptDate: "2026-03-02",
      currency: "USD",
      items: [
        { name: "Pizza", qty: 1, unitPriceCents: 1499, confidence: 0.9 },
      ],
      taxCents: 120,
      tipCents: 0,
      totalCents: 1619,
      notes: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts null merchant and receiptDate", () => {
    const result = parseReceiptResponseSchema.safeParse({
      merchant: null,
      receiptDate: null,
      currency: "USD",
      items: [
        { name: "Item", qty: 1, unitPriceCents: 1000, confidence: 0.8 },
      ],
      taxCents: 0,
      tipCents: 0,
      totalCents: 1000,
      notes: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when items have invalid confidence", () => {
    const result = parseReceiptResponseSchema.safeParse({
      merchant: null,
      receiptDate: null,
      currency: "USD",
      items: [
        { name: "Item", qty: 1, unitPriceCents: 1000, confidence: 1.5 },
      ],
      taxCents: 0,
      tipCents: 0,
      totalCents: 1000,
      notes: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects when qty < 1", () => {
    const result = parseReceiptResponseSchema.safeParse({
      merchant: null,
      receiptDate: null,
      currency: "USD",
      items: [
        { name: "Item", qty: 0, unitPriceCents: 1000, confidence: 0.8 },
      ],
      taxCents: 0,
      tipCents: 0,
      totalCents: 1000,
      notes: [],
    });
    expect(result.success).toBe(false);
  });
});
