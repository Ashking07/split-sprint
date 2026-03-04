import React, { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { ExternalLink, Copy, Check, Share2, Loader2 } from "lucide-react";
import { NavBar } from "../components/NavBar";
import { ProgressStepper } from "../components/ProgressStepper";
import { AppState, Screen } from "../types";
import { MOCK_RECEIPT_ITEMS } from "../mockData";
import { useBillStore } from "../../store/billStore";
import { useAuthStore } from "../../store/authStore";
import { hapticLight } from "../../lib/haptic";
import { format } from "date-fns";
import {
  generateSplitwiseSummary,
  SPLITWISE_PLACEHOLDER_URL,
} from "../../lib/exportSplitwise";
import {
  apiSplitwiseStatus,
  apiSplitwiseCreateExpense,
} from "../../lib/api";
import { computeSettlement } from "../../lib/settlement";
import { formatCents } from "../../lib/cents";

interface ConfirmationProps {
  state: AppState;
  setState: (s: Partial<AppState>) => void;
  navigate: (screen: Screen) => void;
}

export function Confirmation({ state, setState, navigate }: ConfirmationProps) {
  const items = state.items.length ? state.items : MOCK_RECEIPT_ITEMS;
  const selectedGroup = state.selectedGroup;
  const people = state.selectedPeople?.length
    ? state.selectedPeople
    : selectedGroup?.members ?? [];
  const splitMode = state.splitMode || "equal";
  const payerId = useAuthStore((s) => s.user?.id) ?? people[0]?.id ?? "";

  const tax = state.tax || 0;
  const tip = state.tip || 0;
  const taxCents = Math.round(tax * 100);
  const tipCents = Math.round(tip * 100);

  const settlement = useMemo(() => {
    if (people.length === 0) return null;
    return computeSettlement(
      {
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          qty: it.qty,
          unitPriceCents: Math.round(it.price * 100),
        })),
        taxCents,
        tipCents,
        splitMode,
        participantIds: people.map((p) => p.id),
        participantsByItem:
          splitMode === "itemized"
            ? Object.fromEntries(
                items.map((it) => [it.id, it.assignedTo?.length ? it.assignedTo : people.map((p) => p.id)])
              )
            : {},
      },
      payerId
    );
  }, [items, taxCents, tipCents, splitMode, people, payerId]);

  const shareByPerson = settlement
    ? Object.fromEntries(settlement.shares.map((s) => [s.participantId, s.amountCents]))
    : {};
  const getPersonShareDollars = (personId: string) =>
    (shareByPerson[personId] ?? 0) / 100;

  const saveBillAndFinalize = useBillStore((s) => s.saveBillAndFinalize);
  const [copied, setCopied] = useState(false);
  const [splitwiseConnected, setSplitwiseConnected] = useState(false);
  const [creatingInSplitwise, setCreatingInSplitwise] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiSplitwiseStatus()
      .then((s) => setSplitwiseConnected(s.connected))
      .catch(() => setSplitwiseConnected(false));
  }, []);

  const getSummary = () =>
    generateSplitwiseSummary(
      state.merchant || "Bill",
      format(new Date(), "MMM d, yyyy"),
      items,
      tax,
      tip,
      settlement ? settlement.totalCents / 100 : 0,
      people,
      getPersonShareDollars
    );

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(getSummary());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "SplitSprint Bill Summary",
          text: getSummary(),
          url: window.location.href,
        });
      } else {
        await handleCopySummary();
      }
    } catch {
      await handleCopySummary();
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      setState({ xp: state.xp + 25, streak: state.streak + 1 });
      const billId = await saveBillAndFinalize();
      if (billId) {
        navigate("success");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCreateInSplitwise = async () => {
    if (creatingInSplitwise) return;
    setCreatingInSplitwise(true);
    try {
      let billId = useBillStore.getState().currentBillId;
      if (!billId) {
        billId = await saveBillAndFinalize();
      } else {
        await saveBillAndFinalize();
      }
      if (!billId) return;
      const res = await apiSplitwiseCreateExpense(billId, selectedGroup?.id);
      setState({ xp: state.xp + 25, streak: state.streak + 1 });
      if (res.expenseUrl) {
        window.open(res.expenseUrl, "_blank");
      }
      navigate("success");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreatingInSplitwise(false);
    }
  };

  const canCreateInSplitwise =
    splitwiseConnected && selectedGroup?.splitwiseGroupId && people.length >= 2;

  const total = settlement ? settlement.totalCents / 100 : 0;
  const payerName = people.find((p) => p.id === payerId)?.name ?? "You";

  if (!selectedGroup || people.length < 2) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-5">
        <p style={{ fontSize: "14px", color: "#6B7280" }}>
          Complete split setup first.
        </p>
        <button
          onClick={() => navigate("split")}
          className="mt-4 px-4 py-2 rounded-xl"
          style={{ background: "#22C55E", color: "white", fontWeight: 700 }}
        >
          Back to Split
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Confirm & Send"
        subtitle="Review before creating in Splitwise"
        onBack={() => navigate("split")}
      />
      <ProgressStepper currentStep={3} />

      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-4 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, #1E1B4B, #312E81)",
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            {selectedGroup.emoji}
          </div>
          <div className="flex-1">
            <div
              style={{
                fontSize: "11px",
                color: "#A78BFA",
                fontWeight: 600,
              }}
            >
              SPLITWISE GROUP
            </div>
            <div
              style={{ fontSize: "16px", fontWeight: 800, color: "white" }}
            >
              {selectedGroup.name}
            </div>
            <div style={{ fontSize: "12px", color: "#C4B5FD" }}>
              {people.length} members · USD
            </div>
          </div>
          <ExternalLink size={16} color="#A78BFA" />
        </motion.div>

        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ background: "white", border: "1.5px solid #F3F4F6" }}
        >
          <div
            className="px-4 py-3"
            style={{ borderBottom: "1px solid #F3F4F6" }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1A1A2E",
              }}
            >
              Bill Summary
            </span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: "1px solid #F9FAFB" }}
            >
              <span style={{ fontSize: "13px", color: "#4B5563" }}>
                {item.name}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#1A1A2E",
                }}
              >
                ${(item.price * item.qty).toFixed(2)}
              </span>
            </div>
          ))}
          <div
            className="px-4 py-2.5 flex justify-between"
            style={{ borderBottom: "1px solid #F9FAFB" }}
          >
            <span style={{ fontSize: "13px", color: "#6B7280" }}>Tax</span>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>
              ${tax.toFixed(2)}
            </span>
          </div>
          {tip > 0 && (
            <div
              className="px-4 py-2.5 flex justify-between"
              style={{ borderBottom: "1px solid #F9FAFB" }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Tip</span>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>
                ${tip.toFixed(2)}
              </span>
            </div>
          )}
          <div
            className="px-4 py-3 flex justify-between"
            style={{ background: "#F9FAFB" }}
          >
            <span
              style={{
                fontSize: "15px",
                fontWeight: 800,
                color: "#1A1A2E",
              }}
            >
              Total
            </span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 800,
                color: "#1A1A2E",
              }}
            >
              {formatCents(settlement?.totalCents ?? 0)}
            </span>
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ background: "white", border: "1.5px solid #F3F4F6" }}
        >
          <div
            className="px-4 py-3"
            style={{ borderBottom: "1px solid #F3F4F6" }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1A1A2E",
              }}
            >
              Member Shares
            </span>
          </div>
          {people.map((person, i) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderBottom:
                  i < people.length - 1 ? "1px solid #F9FAFB" : "none",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: person.color,
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "white",
                }}
              >
                {person.avatar}
              </div>
              <div className="flex-1">
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#1A1A2E",
                  }}
                >
                  {person.name}
                </div>
                <div style={{ fontSize: "11px", color: "#9CA3AF" }}>
                  {splitMode === "equal" ? "Equal share" : "Custom split"}
                </div>
              </div>
              <div className="text-right">
                <div
                  style={{
                    fontSize: "17px",
                    fontWeight: 800,
                    color: "#22C55E",
                  }}
                >
                  {formatCents(shareByPerson[person.id] ?? 0)}
                </div>
                <div style={{ fontSize: "10px", color: "#9CA3AF" }}>
                  {total > 0
                    ? `${(
                        ((shareByPerson[person.id] ?? 0) / 100 / total) *
                        100
                      ).toFixed(0)}% of total`
                    : ""}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {settlement && settlement.whoOwesPayer.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden mb-4"
            style={{
              background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
              border: "1.5px solid #86EFAC",
            }}
          >
            <div
              className="px-4 py-3"
              style={{ borderBottom: "1px solid rgba(34,197,94,0.3)" }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#166534",
                }}
              >
                Who owes {payerName}
              </span>
            </div>
            {settlement.whoOwesPayer.map((w) => {
              const person = people.find((p) => p.id === w.participantId);
              return (
                <div
                  key={w.participantId}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid rgba(34,197,94,0.2)" }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: person?.color ?? "#9CA3AF",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "white",
                      }}
                    >
                      {person?.avatar ?? "?"}
                    </div>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#166534",
                      }}
                    >
                      {person?.name ?? w.participantId}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#15803D",
                    }}
                  >
                    {formatCents(w.amountCents)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl overflow-hidden mb-2 flex gap-2"
          style={{
            background: "white",
            border: "1.5px solid #F3F4F6",
          }}
        >
          <button
            onClick={handleCopySummary}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4"
            style={{ fontSize: "13px", fontWeight: 700, color: "#6B7280" }}
          >
            {copied ? (
              <>
                <Check size={16} color="#22C55E" />
                <span style={{ color: "#22C55E" }}>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} color="#6B7280" />
                Copy summary
              </>
            )}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4"
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#6B7280",
              borderLeft: "1px solid #F3F4F6",
            }}
          >
            <Share2 size={16} color="#6B7280" />
            Share
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl px-4 py-3 flex items-center gap-3 mb-2"
          style={{
            background: "#F5F3FF",
            border: "1.5px solid #DDD6FE",
          }}
        >
          <span style={{ fontSize: "20px" }}>✨</span>
          <div>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#7C3AED",
              }}
            >
              +25 XP
            </span>
            <span style={{ fontSize: "13px", color: "#6D28D9" }}>
              {" "}
              for completing this bill!
            </span>
          </div>
        </motion.div>

        <div className="h-2" />
      </div>

      <div
        className="px-5 pt-3 pb-4 flex-shrink-0"
        style={{
          background: "white",
          borderTop: "1px solid #F3F4F6",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        }}
      >
        {canCreateInSplitwise ? (
          <motion.button
            whileTap={{ scale: creatingInSplitwise ? 1 : 0.97 }}
            onClick={async () => {
              hapticLight();
              await handleCreateInSplitwise();
            }}
            disabled={creatingInSplitwise}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
            style={{
              background: creatingInSplitwise ? "#9CA3AF" : "linear-gradient(135deg, #22C55E, #16A34A)",
              color: "white",
              fontSize: "16px",
              fontWeight: 800,
              boxShadow: creatingInSplitwise ? "none" : "0 8px 24px rgba(34,197,94,0.3)",
            }}
          >
            {creatingInSplitwise ? (
              <Loader2 size={18} color="white" className="animate-spin" />
            ) : (
              <ExternalLink size={18} color="white" />
            )}
            <span>{creatingInSplitwise ? "Creating in Splitwise..." : "Create in Splitwise"}</span>
            {!creatingInSplitwise && <span style={{ fontSize: "18px" }}>🚀</span>}
          </motion.button>
        ) : !splitwiseConnected ? (
          <div className="space-y-2">
            <p style={{ fontSize: "13px", color: "#6B7280", textAlign: "center", marginBottom: "8px" }}>
              Connect Splitwise to create expenses automatically
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => useBillStore.getState().navigate("integrations")}
              className="w-full py-3 rounded-2xl"
              style={{ background: "#F3F4F6", color: "#4B5563", fontSize: "14px", fontWeight: 700 }}
            >
              Connect Splitwise
            </motion.button>
            <motion.button
              whileTap={{ scale: creating ? 1 : 0.97 }}
              onClick={async () => {
                hapticLight();
                await handleCopySummary();
                window.open(SPLITWISE_PLACEHOLDER_URL, "_blank");
                await handleCreate();
              }}
              disabled={creating}
              className="w-full py-3 rounded-2xl flex items-center justify-center gap-2"
              style={{
                background: creating ? "#9CA3AF" : "#E5E7EB",
                color: "#6B7280",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Copy summary & open Splitwise"
              )}
            </motion.button>
          </div>
        ) : (
          <div className="space-y-2">
            <p style={{ fontSize: "13px", color: "#6B7280", textAlign: "center", marginBottom: "8px" }}>
              Link this group to a Splitwise group to create automatically
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => useBillStore.getState().navigate("group")}
              className="w-full py-3 rounded-2xl"
              style={{ background: "#F3F4F6", color: "#4B5563", fontSize: "14px", fontWeight: 700 }}
            >
              Link Splitwise group
            </motion.button>
            <motion.button
              whileTap={{ scale: creating ? 1 : 0.97 }}
              onClick={async () => {
                hapticLight();
                await handleCopySummary();
                window.open(SPLITWISE_PLACEHOLDER_URL, "_blank");
                await handleCreate();
              }}
              disabled={creating}
              className="w-full py-3 rounded-2xl flex items-center justify-center gap-2"
              style={{
                background: creating ? "#9CA3AF" : "#E5E7EB",
                color: "#6B7280",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Copy summary & open Splitwise"
              )}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
