import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Check, Edit2, Plus, Trash2, Merge, Loader2 } from "lucide-react";
import { NavBar } from "../components/NavBar";
import { ProgressStepper } from "../components/ProgressStepper";
import { AppState, ReceiptItem, Screen } from "../types";
import { mergeDuplicates, needsReview } from "../../lib/mergeDuplicates";
import { MOCK_RECEIPT_ITEMS, MOCK_TAX } from "../mockData";
import { useBillStore } from "../../store/billStore";
import { hapticLight } from "../../lib/haptic";

interface ReceiptReviewProps {
  state: AppState;
  setState: (s: Partial<AppState>) => void;
  navigate: (screen: Screen) => void;
}

const TIP_PRESETS = [
  { label: "No tip", value: 0 },
  { label: "10%", value: 10 },
  { label: "15%", value: 15 },
  { label: "20%", value: 20 },
  { label: "Custom", value: -1 },
];

export function ReceiptReview({ state, setState, navigate }: ReceiptReviewProps) {
  const items = state.items.length ? state.items : MOCK_RECEIPT_ITEMS;
  const tax = state.tax ?? MOCK_TAX;
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [filter, setFilter] = useState<"all" | "needs_review">("all");
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tipAmount = state.tipPreset === -1
    ? parseFloat(state.customTip || "0")
    : (subtotal * state.tipPreset) / 100;
  const total = subtotal + tax + tipAmount;

  const startEdit = (item: ReceiptItem) => {
    setEditingItem(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toFixed(2));
  };

  const saveEdit = (itemId: string) => {
    const updated = items.map(it =>
      it.id === itemId
        ? {
            ...it,
            name: editName,
            price: parseFloat(editPrice) || it.price,
            uncertain: false,
            confidence: 1,
          }
        : it
    );
    setState({ items: updated });
    setEditingItem(null);
  };

  const selectTip = (preset: number) => {
    const newTip = preset === -1 ? parseFloat(state.customTip || "0") : (subtotal * preset) / 100;
    setState({ tipPreset: preset, tip: newTip });
    if (preset === -1) setShowCustomTip(true);
    else setShowCustomTip(false);
  };

  const isUncertain = needsReview;
  const uncertainCount = items.filter(isUncertain).length;
  const filteredItems = filter === "needs_review" ? items.filter(isUncertain) : items;

  const addItem = () => {
    const newItem: ReceiptItem = {
      id: `manual-${Date.now()}`,
      name: "New item",
      qty: 1,
      price: 0,
      confidence: 1,
      source: "manual",
      uncertain: false,
      assignedTo: [],
    };
    setState({ items: [...items, newItem] });
    setEditingItem(newItem.id);
    setEditName(newItem.name);
    setEditPrice("0");
  };

  const deleteItem = (id: string) => {
    setState({ items: items.filter((it) => it.id !== id) });
    if (editingItem === id) setEditingItem(null);
  };

  const handleMergeDuplicates = () => {
    const merged = mergeDuplicates(items);
    setState({ items: merged });
  };
  const receiptImageUrl = useBillStore((s) => s.receiptImageUrl);
  const saveDraftFromReview = useBillStore((s) => s.saveDraftFromReview);

  // Debounced save to API (draft persistence)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (items.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDraftFromReview();
      saveTimeoutRef.current = null;
    }, 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [items, tax, tipAmount, saveDraftFromReview]);

  const subtitle =
    uncertainCount > 0
      ? `${uncertainCount} item${uncertainCount > 1 ? "s" : ""} need review`
      : undefined;

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Review Receipt"
        subtitle={subtitle}
        onBack={() => navigate("import")}
      />
      <ProgressStepper currentStep={1} />

      {/* Scrollable items */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        {/* Receipt image thumbnail (when uploaded from camera) */}
        {receiptImageUrl && (
          <div className="rounded-2xl overflow-hidden mb-3" style={{ border: "1.5px solid #E5E7EB" }}>
            <img
              src={receiptImageUrl}
              alt="Receipt"
              className="w-full h-32 object-cover object-top"
            />
          </div>
        )}
        {/* Restaurant header */}
        <div className="rounded-2xl p-4 mb-3 text-center"
          style={{ background: "linear-gradient(135deg, #1E1B4B, #312E81)" }}>
          <div style={{ fontSize: "20px", marginBottom: "4px" }}>🍽️</div>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "white" }}>
            {state.merchant || "Receipt"}
          </div>
          <div style={{ fontSize: "11px", color: "#A78BFA" }}>
            {state.receiptDate
              ? new Date(state.receiptDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </div>
        </div>

        {/* Filter chips + quick actions */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => setFilter("all")}
            className="rounded-full px-3 py-1.5 text-sm font-600"
            style={{
              background: filter === "all" ? "#1E1B4B" : "#F3F4F6",
              color: filter === "all" ? "white" : "#4B5563",
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter("needs_review")}
            className="rounded-full px-3 py-1.5 text-sm font-600 flex items-center gap-1"
            style={{
              background: filter === "needs_review" ? "#F59E0B" : "#F3F4F6",
              color: filter === "needs_review" ? "white" : "#4B5563",
            }}
          >
            Needs review {uncertainCount > 0 && `(${uncertainCount})`}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleMergeDuplicates}
            className="rounded-full px-3 py-1.5 text-sm font-600 flex items-center gap-1"
            style={{ background: "#F3F4F6", color: "#4B5563" }}
          >
            <Merge size={14} />
            Merge duplicates
          </button>
          <button
            onClick={addItem}
            className="rounded-full px-3 py-1.5 text-sm font-600 flex items-center gap-1"
            style={{ background: "#22C55E", color: "white" }}
          >
            <Plus size={14} />
            Add item
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {filteredItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              className="rounded-xl overflow-hidden"
              style={{
                background: "white",
                border: isUncertain(item) ? "1.5px solid #FDE68A" : "1.5px solid #F3F4F6",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              {editingItem === item.id ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 flex flex-col gap-2"
                >
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="rounded-lg px-3 py-2 w-full outline-none"
                    style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", fontSize: "14px" }}
                    placeholder="Item name"
                  />
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ fontSize: "14px", color: "#6B7280" }}>$</span>
                      <input
                        value={editPrice}
                        onChange={e => setEditPrice(e.target.value)}
                        type="number"
                        className="rounded-lg pl-7 pr-3 py-2 w-full outline-none"
                        style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", fontSize: "14px" }}
                      />
                    </div>
                    <button
                      onClick={() => saveEdit(item.id)}
                      className="px-4 rounded-lg"
                      style={{ background: "#22C55E", color: "white", fontSize: "13px", fontWeight: 700 }}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A2E" }} className="truncate">
                        {item.name}
                      </span>
                      {isUncertain(item) && (
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 flex-shrink-0"
                          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
                        >
                          <AlertTriangle size={10} color="#F59E0B" />
                          <span style={{ fontSize: "10px", color: "#D97706", fontWeight: 700 }}>
                            Needs review
                          </span>
                        </motion.div>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "2px" }}>
                      Qty: {item.qty}
                    </div>
                  </div>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#1A1A2E" }}>
                    ${(item.price * item.qty).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "#FEF2F2" }}
                    >
                      <Trash2 size={14} color="#B91C1C" />
                    </button>
                    <button
                      onClick={() => startEdit(item)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "#F3F4F6" }}
                    >
                      <Edit2 size={14} color="#6B7280" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Tip section */}
        <div className="mt-4 rounded-2xl p-4"
          style={{ background: "white", border: "1.5px solid #F3F4F6" }}>
          <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1A2E", marginBottom: "12px" }}>
            Add a Tip?
          </h4>
          <div className="grid grid-cols-5 gap-1.5">
            {TIP_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => selectTip(preset.value)}
                className="py-2 rounded-xl text-center transition-all"
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  background: state.tipPreset === preset.value
                    ? "#22C55E"
                    : "#F3F4F6",
                  color: state.tipPreset === preset.value ? "white" : "#4B5563",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {showCustomTip && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ fontSize: "14px", color: "#6B7280" }}>$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={state.customTip}
                    onChange={e => {
                      const v = e.target.value;
                      const tipVal = parseFloat(v || "0");
                      setState({ customTip: v, tip: tipVal });
                    }}
                    className="w-full rounded-xl pl-7 pr-3 py-3 outline-none"
                    style={{ background: "#F9FAFB", border: "1.5px solid #E5E7EB", fontSize: "15px" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-2" />
      </div>

      {/* Sticky totals bar */}
      <div
        className="px-5 pt-3 pb-4 flex-shrink-0"
        style={{
          background: "white",
          borderTop: "1px solid #F3F4F6",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex flex-col gap-1 mb-3">
          {[
            { label: "Subtotal", value: subtotal },
            { label: "Tax", value: tax },
            ...(tipAmount > 0 ? [{ label: `Tip (${state.tipPreset === -1 ? "custom" : state.tipPreset + "%"})`, value: tipAmount }] : []),
          ].map(row => (
            <div key={row.label} className="flex justify-between">
              <span style={{ fontSize: "13px", color: "#6B7280" }}>{row.label}</span>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>${row.value.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1" style={{ borderTop: "1px dashed #E5E7EB" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#1A1A2E" }}>Total</span>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#1A1A2E" }}>${total.toFixed(2)}</span>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: saving ? 1 : 0.97 }}
          onClick={async () => {
            if (saving) return;
            hapticLight();
            setSaving(true);
            setState({ items, tax, tip: tipAmount });
            try {
              await useBillStore.getState().saveDraftFromReview();
              navigate("group");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: saving ? "#9CA3AF" : "linear-gradient(135deg, #22C55E, #16A34A)",
            color: "white",
            fontSize: "16px",
            fontWeight: 800,
          }}
        >
          {saving ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Saving...
            </>
          ) : (
            "Next: Choose Group →"
          )}
        </motion.button>
      </div>
    </div>
  );
}