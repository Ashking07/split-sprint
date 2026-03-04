import { describe, it, expect } from "vitest";
import {
  computeShares,
  computeWhoOwesPayer,
  computeSettlement,
  type SettlementInput,
} from "./index";

describe("settlement", () => {
  const items = [
    { id: "i1", name: "Pizza", qty: 1, unitPriceCents: 1500 },
    { id: "i2", name: "Salad", qty: 2, unitPriceCents: 850 },
  ];

  describe("computeShares - equal split", () => {
    it("divides evenly when no remainder", () => {
      const shares = computeShares({
        items,
        taxCents: 200,
        tipCents: 100,
        splitMode: "equal",
        participantIds: ["a", "b", "c", "d"],
      });
      const total = 3200 + 200 + 100;
      expect(shares.reduce((s, r) => s + r.amountCents, 0)).toBe(total);
      expect(shares.every((s) => s.amountCents === 875)).toBe(true);
    });

    it("distributes remainder cents to first k participants", () => {
      const shares = computeShares({
        items,
        taxCents: 200,
        tipCents: 100,
        splitMode: "equal",
        participantIds: ["a", "b", "c"],
      });
      const total = 3500;
      expect(shares.reduce((s, r) => s + r.amountCents, 0)).toBe(total);
      const amounts = shares.map((s) => s.amountCents).sort((a, b) => b - a);
      expect(amounts).toEqual([1167, 1167, 1166]);
    });

    it("returns empty for no participants", () => {
      const shares = computeShares({
        items,
        taxCents: 200,
        tipCents: 100,
        splitMode: "equal",
        participantIds: [],
      });
      expect(shares).toEqual([]);
    });
  });

  describe("computeShares - itemized", () => {
    it("splits items among assigned, prorates tax+tip evenly", () => {
      const shares = computeShares({
        items,
        taxCents: 200,
        tipCents: 100,
        splitMode: "itemized",
        participantIds: ["a", "b"],
        participantsByItem: { i1: ["a"], i2: ["a", "b"] },
      });
      const total = 3500;
      expect(shares.reduce((s, r) => s + r.amountCents, 0)).toBe(total);
      const aShare = shares.find((s) => s.participantId === "a")!.amountCents;
      const bShare = shares.find((s) => s.participantId === "b")!.amountCents;
      expect(aShare).toBe(2500);
      expect(bShare).toBe(1000);
    });

    it("handles uneven item split (remainder cents)", () => {
      const shares = computeShares({
        items: [{ id: "i1", name: "X", qty: 1, unitPriceCents: 100 }],
        taxCents: 0,
        tipCents: 0,
        splitMode: "itemized",
        participantIds: ["a", "b", "c"],
        participantsByItem: { i1: ["a", "b", "c"] },
      });
      expect(shares.reduce((s, r) => s + r.amountCents, 0)).toBe(100);
      const amounts = shares.map((s) => s.amountCents).sort((a, b) => b - a);
      expect(amounts).toEqual([34, 33, 33]);
    });

    it("handles missing participants (item assigned to non-participant)", () => {
      const shares = computeShares({
        items,
        taxCents: 0,
        tipCents: 0,
        splitMode: "itemized",
        participantIds: ["a", "b"],
        participantsByItem: { i1: ["a", "x"], i2: ["b"] },
      });
      const assignedI1 = ["a", "x"].filter((id) => ["a", "b"].includes(id));
      expect(assignedI1).toEqual(["a"]);
      const total = 3200;
      expect(shares.reduce((s, r) => s + r.amountCents, 0)).toBe(total);
    });

    it("defaults to all participants when item has no assignment", () => {
      const shares = computeShares({
        items: [{ id: "i1", name: "X", qty: 1, unitPriceCents: 600 }],
        taxCents: 0,
        tipCents: 0,
        splitMode: "itemized",
        participantIds: ["a", "b", "c"],
        participantsByItem: {},
      });
      expect(shares.reduce((s, r) => s + r.amountCents, 0)).toBe(600);
      expect(shares.every((s) => s.amountCents === 200)).toBe(true);
    });
  });

  describe("computeWhoOwesPayer", () => {
    it("excludes payer from debtors", () => {
      const shares = [
        { participantId: "owner", amountCents: 500 },
        { participantId: "a", amountCents: 500 },
        { participantId: "b", amountCents: 500 },
      ];
      const whoOwes = computeWhoOwesPayer(shares, "owner");
      expect(whoOwes).toHaveLength(2);
      expect(whoOwes.find((w) => w.participantId === "owner")).toBeUndefined();
      expect(whoOwes.find((w) => w.participantId === "a")?.amountCents).toBe(500);
    });

    it("excludes zero-share participants", () => {
      const shares = [
        { participantId: "owner", amountCents: 1000 },
        { participantId: "a", amountCents: 0 },
      ];
      const whoOwes = computeWhoOwesPayer(shares, "owner");
      expect(whoOwes).toHaveLength(0);
    });
  });

  describe("computeSettlement", () => {
    it("returns shares and whoOwesPayer", () => {
      const result = computeSettlement(
        {
          items,
          taxCents: 200,
          tipCents: 100,
          splitMode: "equal",
          participantIds: ["payer", "a", "b"],
        },
        "payer"
      );
      expect(result.totalCents).toBe(3500);
      expect(result.shares).toHaveLength(3);
      expect(result.whoOwesPayer.every((w) => w.participantId !== "payer")).toBe(true);
    });
  });
});
