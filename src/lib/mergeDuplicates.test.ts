import { describe, it, expect } from "vitest";
import { mergeDuplicates, needsReview, NEEDS_REVIEW_THRESHOLD } from "./mergeDuplicates";
import type { ReceiptItem } from "../app/types";

describe("mergeDuplicates", () => {
  it("merges items with same name (case-insensitive)", () => {
    const items: ReceiptItem[] = [
      { id: "1", name: "Pizza", qty: 1, price: 10, assignedTo: [] },
      { id: "2", name: "pizza", qty: 2, price: 12, assignedTo: [] },
    ];
    const merged = mergeDuplicates(items);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("Pizza");
    expect(merged[0].qty).toBe(3);
    expect(merged[0].price).toBeCloseTo((10 + 24) / 3); // weighted avg
  });

  it("merges items with similar name (trimmed)", () => {
    const items: ReceiptItem[] = [
      { id: "1", name: "  Beer  ", qty: 1, price: 5, assignedTo: [] },
      { id: "2", name: "Beer", qty: 2, price: 5, assignedTo: [] },
    ];
    const merged = mergeDuplicates(items);
    expect(merged).toHaveLength(1);
    expect(merged[0].qty).toBe(3);
  });

  it("keeps lowest confidence when merging", () => {
    const items: ReceiptItem[] = [
      { id: "1", name: "Item", qty: 1, price: 10, confidence: 0.9, assignedTo: [] },
      { id: "2", name: "item", qty: 1, price: 10, confidence: 0.5, assignedTo: [] },
    ];
    const merged = mergeDuplicates(items);
    expect(merged[0].confidence).toBe(0.5);
  });

  it("leaves distinct items unchanged", () => {
    const items: ReceiptItem[] = [
      { id: "1", name: "Pizza", qty: 1, price: 10, assignedTo: [] },
      { id: "2", name: "Salad", qty: 1, price: 8, assignedTo: [] },
    ];
    const merged = mergeDuplicates(items);
    expect(merged).toHaveLength(2);
  });
});

describe("needsReview", () => {
  it("returns true when confidence < 0.75", () => {
    expect(needsReview({ id: "1", name: "x", qty: 1, price: 1, confidence: 0.5, assignedTo: [] })).toBe(true);
    expect(needsReview({ id: "1", name: "x", qty: 1, price: 1, confidence: 0.74, assignedTo: [] })).toBe(true);
  });

  it("returns false when confidence >= 0.75", () => {
    expect(needsReview({ id: "1", name: "x", qty: 1, price: 1, confidence: 0.75, assignedTo: [] })).toBe(false);
    expect(needsReview({ id: "1", name: "x", qty: 1, price: 1, confidence: 1, assignedTo: [] })).toBe(false);
  });

  it("returns true when uncertain is true", () => {
    expect(needsReview({ id: "1", name: "x", qty: 1, price: 1, uncertain: true, assignedTo: [] })).toBe(true);
  });

  it("treats undefined confidence as 1 (no review needed)", () => {
    expect(needsReview({ id: "1", name: "x", qty: 1, price: 1, assignedTo: [] })).toBe(false);
  });
});

describe("NEEDS_REVIEW_THRESHOLD", () => {
  it("is 0.75", () => {
    expect(NEEDS_REVIEW_THRESHOLD).toBe(0.75);
  });
});
