import type { ReceiptItem } from "../app/types";

const NEEDS_REVIEW_THRESHOLD = 0.75;

/**
 * Merge items with same/similar name: combine qty, weighted unit price.
 * Keeps the lowest confidence of merged items.
 */
export function mergeDuplicates(items: ReceiptItem[]): ReceiptItem[] {
  const byName = new Map<string, ReceiptItem>();
  for (const it of items) {
    const key = it.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...it });
    } else {
      const totalQty = existing.qty + it.qty;
      const weightedPrice = (existing.price * existing.qty + it.price * it.qty) / totalQty;
      const minConf = Math.min(existing.confidence ?? 1, it.confidence ?? 1);
      byName.set(key, {
        ...existing,
        id: existing.id,
        qty: totalQty,
        price: weightedPrice,
        confidence: minConf,
        uncertain: minConf < NEEDS_REVIEW_THRESHOLD,
      });
    }
  }
  return Array.from(byName.values());
}

export function needsReview(item: ReceiptItem): boolean {
  return item.uncertain || (item.confidence !== undefined && item.confidence < NEEDS_REVIEW_THRESHOLD);
}

export { NEEDS_REVIEW_THRESHOLD };
