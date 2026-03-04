import { persist } from "zustand/middleware";
import { create } from "zustand";
import type { AppState, HistoryEntry, Screen } from "../app/types";
import {
  apiGetHistory,
  apiGetBill,
  apiGetGroup,
  apiCreateBill,
  apiUpdateBill,
  apiFinalizeBill,
  apiParseReceipt,
} from "../lib/api";
import {
  apiItemsToReceiptItems,
  receiptItemsToApiItems,
  buildParticipantsByItem,
  parseResultToReceiptItems,
} from "../lib/billConversion";
import { hapticSuccess, hapticError } from "../lib/haptic";

const INITIAL_STATE: Omit<AppState, "screen"> & { screen: Screen } = {
  screen: "home",
  items: [],
  tax: 0,
  tip: 0,
  tipPreset: 0,
  customTip: "",
  selectedGroup: null,
  selectedPeople: [],
  splitMode: "equal",
  xp: 325,
  streak: 4,
};

interface BillStore extends AppState {
  receiptImageUrl?: string;
  rawReceipt?: { imageBase64?: string; pastedText?: string };
  history: HistoryEntry[];
  currentBillId: string | null;
  navigate: (screen: Screen) => void;
  updateState: (partial: Partial<AppState> & { receiptImageUrl?: string }) => void;
  resetDraft: () => void;
  setReceiptImage: (url: string | undefined) => void;
  fetchHistory: () => Promise<void>;
  setHistory: (history: HistoryEntry[]) => void;
  loadBill: (id: string, options?: { forDuplicate?: boolean }) => Promise<boolean>;
  saveBillAsDraft: () => Promise<string | null>;
  saveDraftFromReview: () => Promise<string | null>;
  setBillGroup: (groupId: string) => Promise<void>;
  saveBillAndFinalize: () => Promise<string | null>;
  applyParseResult: (
    result: {
      merchant: string | null;
      receiptDate: string | null;
      currency: string;
      items: { name: string; qty: number; unitPriceCents: number; confidence?: number }[];
      taxCents: number;
      tipCents: number;
      notes: string[];
    },
    source: "vision" | "text",
    rawReceipt?: { imageBase64?: string; pastedText?: string }
  ) => void;
  parseReceiptFromImage: (imageBase64: string) => Promise<boolean>;
  parseReceiptFromText: (pastedText: string) => Promise<boolean>;
}


export const useBillStore = create<BillStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      history: [],
      currentBillId: null,

      navigate: (screen) => set((state) => ({ ...state, screen })),

      updateState: (partial) =>
        set((state) => ({ ...state, ...partial })),

      resetDraft: () =>
        set((state) => ({
          ...state,
          screen: "home",
          merchant: undefined,
          receiptDate: undefined,
          rawReceipt: undefined,
          items: [],
          tax: 0,
          tip: 0,
          tipPreset: 0,
          customTip: "",
          selectedGroup: null,
          selectedPeople: [],
          splitMode: "equal",
          receiptImageUrl: undefined,
          currentBillId: null,
        })),

      loadBill: async (id, options) => {
        try {
          const bill = await apiGetBill(id);
          if (!bill) return false;
          const items = apiItemsToReceiptItems(bill.items, bill.participantsByItem);
          let group = null;
          if (bill.groupId) {
            const g = await apiGetGroup(bill.groupId);
            group = g
              ? {
                  id: g.id,
                  name: g.name,
                  emoji: g.emoji || "👥",
                  members: g.members || [],
                  lastUsed: false,
                }
              : {
                  id: bill.groupId,
                  name: bill.groupName || "Group",
                  emoji: "👥",
                  members: [],
                  lastUsed: false,
                };
          }
          const selectedPeople = group?.members?.length ? group.members : [];
          const forDuplicate = options?.forDuplicate ?? false;
          set((state) => ({
            ...state,
            currentBillId: forDuplicate ? null : bill.id,
            merchant: bill.merchant || state.merchant,
            receiptDate: bill.receiptDate,
            items,
            tax: (bill.taxCents || 0) / 100,
            tip: (bill.tipCents || 0) / 100,
            splitMode: bill.splitMode || "equal",
            selectedGroup: group,
            selectedPeople,
          }));
          return true;
        } catch {
          return false;
        }
      },

      saveBillAsDraft: async () => {
        const state = useBillStore.getState();
        const { items, tax, tip, splitMode, selectedGroup, currentBillId } = state;
        if (!items.length) return null;
        if (!selectedGroup) return useBillStore.getState().saveDraftFromReview();
        const payload: Record<string, unknown> = {
          groupId: selectedGroup.id,
          merchant: state.merchant || items[0]?.name || "Bill",
          receiptDate: state.receiptDate || undefined,
          items: receiptItemsToApiItems(items),
          taxCents: Math.round(tax * 100),
          tipCents: Math.round(tip * 100),
          splitMode,
          participantsByItem: buildParticipantsByItem(items),
        };
        if (!currentBillId && state.rawReceipt) payload.rawReceipt = state.rawReceipt;
        try {
          if (currentBillId) {
            await apiUpdateBill(currentBillId, payload);
            return currentBillId;
          }
          const created = await apiCreateBill(payload);
          set((s) => ({ ...s, currentBillId: created.id }));
          return created.id;
        } catch {
          return null;
        }
      },

      saveDraftFromReview: async () => {
        const state = useBillStore.getState();
        const { items, tax, tip, splitMode, currentBillId } = state;
        if (!items.length) return null;
        const payload: Record<string, unknown> = {
          merchant: state.merchant || items[0]?.name || "Bill",
          receiptDate: state.receiptDate,
          items: receiptItemsToApiItems(items),
          taxCents: Math.round(tax * 100),
          tipCents: Math.round(tip * 100),
          splitMode,
          participantsByItem: buildParticipantsByItem(items),
        };
        if (!currentBillId && state.rawReceipt) payload.rawReceipt = state.rawReceipt;
        try {
          if (currentBillId) {
            await apiUpdateBill(currentBillId, payload);
            return currentBillId;
          }
          const created = await apiCreateBill(payload);
          set((s) => ({ ...s, currentBillId: created.id }));
          await useBillStore.getState().fetchHistory();
          return created.id;
        } catch {
          return null;
        }
      },

      setBillGroup: async (groupId: string) => {
        const billId = useBillStore.getState().currentBillId;
        if (!billId) return;
        try {
          await apiUpdateBill(billId, { groupId });
        } catch {
          // ignore
        }
      },

      applyParseResult: (result, source, rawReceipt) => {
        const items = parseResultToReceiptItems(result, source);
        set((state) => ({
          ...state,
          merchant: result.merchant || state.merchant,
          receiptDate: result.receiptDate || undefined,
          items,
          tax: result.taxCents / 100,
          tip: result.tipCents / 100,
          rawReceipt: rawReceipt || state.rawReceipt,
        }));
      },

      parseReceiptFromImage: async (imageBase64) => {
        try {
          const result = await apiParseReceipt({ imageBase64, currencyHint: "USD" });
          useBillStore.getState().applyParseResult(result, "vision", { imageBase64 });
          hapticSuccess();
          return true;
        } catch {
          hapticError();
          return false;
        }
      },

      parseReceiptFromText: async (pastedText) => {
        try {
          const result = await apiParseReceipt({ pastedText, currencyHint: "USD" });
          useBillStore.getState().applyParseResult(result, "text", { pastedText });
          hapticSuccess();
          return true;
        } catch {
          hapticError();
          return false;
        }
      },

      saveBillAndFinalize: async () => {
        let billId = useBillStore.getState().currentBillId;
        if (!billId) {
          billId = await useBillStore.getState().saveBillAsDraft();
        } else {
          await useBillStore.getState().saveBillAsDraft();
        }
        if (!billId) return null;
        try {
          await apiFinalizeBill(billId);
          set((s) => ({ ...s, currentBillId: null }));
          await useBillStore.getState().fetchHistory();
          hapticSuccess();
          return billId;
        } catch {
          hapticError();
          return null;
        }
      },

      setReceiptImage: (receiptImageUrl) =>
        set((state) => ({ ...state, receiptImageUrl })),

      fetchHistory: async () => {
        try {
          const data = await apiGetHistory();
          set((state) => ({ ...state, history: data }));
        } catch {
          // Keep existing history on error
        }
      },

      setHistory: (history) =>
        set((state) => ({ ...state, history })),
    }),
    {
      name: "splitsprint-store",
      skipHydration: true,
      partialize: (state) => ({
        screen: state.screen,
        merchant: state.merchant,
        receiptDate: state.receiptDate,
        items: state.items,
        tax: state.tax,
        tip: state.tip,
        tipPreset: state.tipPreset,
        customTip: state.customTip,
        selectedGroup: state.selectedGroup,
        selectedPeople: state.selectedPeople,
        splitMode: state.splitMode,
        xp: state.xp,
        streak: state.streak,
        receiptImageUrl: state.receiptImageUrl,
        history: state.history,
      }),
    }
  )
);

