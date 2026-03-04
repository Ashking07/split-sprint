import { describe, it, expect } from "vitest";
import {
  subtotalCents,
  totalCents,
  equalSplitCents,
  itemizedSplitCents,
  computeSettlement,
  type BillItem,
} from "./splitEngine";

describe("splitEngine", () => {
  const items: BillItem[] = [
    { id: "i1", name: "Pizza", qty: 1, unitPriceCents: 1500 },
    { id: "i2", name: "Salad", qty: 2, unitPriceCents: 850 },
  ];

  describe("subtotalCents", () => {
    it("sums qty * unitPriceCents", () => {
      expect(subtotalCents(items)).toBe(1500 + 1700);
    });
    it("returns 0 for empty items", () => {
      expect(subtotalCents([])).toBe(0);
    });
  });

  describe("totalCents", () => {
    it("adds subtotal + tax + tip", () => {
      expect(totalCents(3200, 200, 500)).toBe(3900);
    });
  });

  describe("equalSplitCents", () => {
    it("divides evenly when no remainder", () => {
      const result = equalSplitCents(1000, ["a", "b", "c", "d"]);
      expect(result.a).toBe(250);
      expect(result.b).toBe(250);
      expect(result.c).toBe(250);
      expect(result.d).toBe(250);
    });
    it("distributes remainder to first k participants", () => {
      const result = equalSplitCents(1001, ["a", "b", "c"]);
      expect(result.a).toBe(334);
      expect(result.b).toBe(334);
      expect(result.c).toBe(333);
      expect(result.a + result.b + result.c).toBe(1001);
    });
    it("returns empty for no participants", () => {
      expect(equalSplitCents(100, [])).toEqual({});
    });
  });

  describe("itemizedSplitCents", () => {
    it("splits items among assigned members, prorates tax+tip evenly", () => {
      const input = {
        items,
        taxCents: 200,
        tipCents: 100,
        splitMode: "itemized" as const,
        participantIds: ["a", "b"],
        participantsByItem: {
          i1: ["a"],
          i2: ["a", "b"],
        },
      };
      const result = itemizedSplitCents(input);
      // i1: 1500 -> a only
      // i2: 1700 -> a and b (850 each)
      // a: 1500 + 850 = 2350; b: 850
      // tax+tip: 300 / 2 = 150 each
      // a: 2350 + 150 = 2500; b: 850 + 150 = 1000
      expect(result.a).toBe(2500);
      expect(result.b).toBe(1000);
      expect(result.a + result.b).toBe(3500);
    });
  });

  describe("computeSettlement", () => {
    it("returns equal split for equal mode", () => {
      const result = computeSettlement({
        items,
        taxCents: 200,
        tipCents: 100,
        splitMode: "equal",
        participantIds: ["a", "b"],
      });
      const total = 3200 + 200 + 100;
      expect(result).toHaveLength(2);
      expect(result[0].amountCents + result[1].amountCents).toBe(total);
    });
    it("returns itemized split for itemized mode", () => {
      const result = computeSettlement({
        items,
        taxCents: 200,
        tipCents: 100,
        splitMode: "itemized",
        participantIds: ["a", "b"],
        participantsByItem: { i1: ["a"], i2: ["b"] },
      });
      expect(result.find((r) => r.participantId === "a")?.amountCents).toBe(1500 + 150);
      expect(result.find((r) => r.participantId === "b")?.amountCents).toBe(1700 + 150);
    });
  });
});
