import type { ReceiptItem } from "../app/types";

export { formatCents, subtotalCents, totalCents } from "./cents";

/** API bill item shape */
export interface ApiBillItem {
  id: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  confidence?: number;
  source?: "vision" | "text" | "manual";
}

/** API bill shape (from GET /api/bills/:id) */
export interface ApiBill {
  id: string;
  ownerId: string;
  groupId: string;
  groupName?: string;
  merchant: string;
  receiptDate?: string;
  currency: string;
  items: ApiBillItem[];
  taxCents: number;
  tipCents: number;
  totalCents: number;
  splitMode: "equal" | "itemized";
  participantsByItem: Record<string, string[]>;
  status: "draft" | "sent";
  createdAt?: string;
  updatedAt?: string;
}

/** Convert API bill items to ReceiptItem (price in dollars) */
export function apiItemsToReceiptItems(
  items: ApiBillItem[],
  participantsByItem: Record<string, string[]> = {}
): ReceiptItem[] {
  return items.map((it, i) => ({
    id: it.id || `item-${i}`,
    name: it.name,
    qty: it.qty,
    price: it.unitPriceCents / 100,
    confidence: it.confidence,
    source: it.source,
    uncertain: (it.confidence ?? 1) < 0.75,
    assignedTo: participantsByItem[it.id] || [],
  }));
}

/** Convert ReceiptItem to API format (unitPriceCents) */
export function receiptItemsToApiItems(items: ReceiptItem[]): ApiBillItem[] {
  return items.map((it) => ({
    id: it.id,
    name: it.name,
    qty: it.qty,
    unitPriceCents: Math.round(it.price * 100),
    confidence: it.confidence,
    source: it.source || "manual",
  }));
}

/** Convert parse API response to ReceiptItems */
export function parseResultToReceiptItems(
  result: {
    items: { name: string; qty: number; unitPriceCents: number; confidence?: number }[];
    taxCents: number;
    tipCents: number;
    merchant?: string | null;
    receiptDate?: string | null;
    currency?: string;
  },
  source: "vision" | "text"
): ReceiptItem[] {
  return result.items.map((it, i) => ({
    id: `parsed-${source}-${i}-${Date.now()}`,
    name: it.name,
    qty: it.qty,
    price: it.unitPriceCents / 100,
    confidence: it.confidence ?? 0.8,
    source,
    uncertain: (it.confidence ?? 0.8) < 0.75,
    assignedTo: [],
  }));
}

/** Build participantsByItem from ReceiptItem[].assignedTo */
export function buildParticipantsByItem(items: ReceiptItem[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const it of items) {
    if (it.assignedTo?.length) {
      out[it.id] = it.assignedTo;
    }
  }
  return out;
}
