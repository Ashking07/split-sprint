import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { NavBar } from "../components/NavBar";
import { ProgressStepper } from "../components/ProgressStepper";
import { AppState, Person, ReceiptItem, Screen } from "../types";
import { MOCK_RECEIPT_ITEMS } from "../mockData";
import { computeShares } from "../../lib/settlement";
import { formatCents } from "../../lib/cents";
import { useAuthStore } from "../../store/authStore";
import { hapticLight } from "../../lib/haptic";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../components/ui/drawer";

interface SplitSetupProps {
  state: AppState;
  setState: (s: Partial<AppState>) => void;
  navigate: (screen: Screen) => void;
}

export function SplitSetup({ state, setState, navigate }: SplitSetupProps) {
  const items = state.items.length ? state.items : MOCK_RECEIPT_ITEMS;
  const selectedGroup = state.selectedGroup;
  const people = state.selectedPeople?.length
    ? state.selectedPeople
    : selectedGroup?.members ?? [];
  const splitMode = state.splitMode || "equal";
  const payerId = useAuthStore((s) => s.user?.id) ?? people[0]?.id ?? "";

  const [itemAssignments, setItemAssignments] = useState<Record<string, Set<string>>>(
    () =>
      Object.fromEntries(
        items.map((it) => [it.id, new Set(people.map((p) => p.id))])
      )
  );

  const tax = state.tax || 0;
  const tip = state.tip || 0;
  const taxCents = Math.round(tax * 100);
  const tipCents = Math.round(tip * 100);

  const settlementInput = useMemo(
    () => ({
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
              items.map((it) => [
                it.id,
                Array.from(itemAssignments[it.id] || new Set(people.map((p) => p.id))),
              ])
            )
          : {},
    }),
    [items, taxCents, tipCents, splitMode, people, itemAssignments]
  );

  const shares = useMemo(
    () => (people.length > 0 ? computeShares(settlementInput) : []),
    [settlementInput, people.length]
  );

  const shareByPerson = Object.fromEntries(shares.map((s) => [s.participantId, s.amountCents]));

  const togglePersonForItem = (itemId: string, personId: string) => {
    setItemAssignments((prev) => {
      const set = new Set(prev[itemId]);
      if (set.has(personId)) {
        if (set.size > 1) set.delete(personId);
      } else {
        set.add(personId);
      }
      return { ...prev, [itemId]: set };
    });
  };

  const [continuing, setContinuing] = useState(false);

  const handleContinue = () => {
    if (continuing) return;
    hapticLight();
    setContinuing(true);
    const updatedItems = items.map((item) => ({
      ...item,
      assignedTo: Array.from(itemAssignments[item.id] || new Set(people.map((p) => p.id))),
    }));
    setState({ items: updatedItems, splitMode });
    navigate("confirm");
  };

  if (!selectedGroup || people.length < 2) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-5">
        <p style={{ fontSize: "14px", color: "#6B7280" }}>
          Select a group with 2+ people first.
        </p>
        <button
          onClick={() => navigate("group")}
          className="mt-4 px-4 py-2 rounded-xl"
          style={{ background: "#22C55E", color: "white", fontWeight: 700 }}
        >
          Choose Group
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Split Setup"
        subtitle={`${selectedGroup.name} · ${people.length} people`}
        onBack={() => navigate("group")}
      />
      <ProgressStepper currentStep={2} />

      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <div
          className="rounded-2xl p-1 mb-4 flex"
          style={{ background: "#F3F4F6" }}
        >
          {[
            { key: "equal", label: "Split Equally", icon: "⚖️" },
            { key: "itemized", label: "By Item", icon: "🎯" },
          ].map((mode) => (
            <button
              key={mode.key}
              onClick={() =>
                setState({ splitMode: mode.key as "equal" | "itemized" })
              }
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all"
              style={{
                background: splitMode === mode.key ? "white" : "transparent",
                fontSize: "13px",
                fontWeight: 700,
                color: splitMode === mode.key ? "#1A1A2E" : "#9CA3AF",
                boxShadow:
                  splitMode === mode.key ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <span>{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>

        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: "white", border: "1.5px solid #F3F4F6" }}
        >
          <h4
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#1A1A2E",
              marginBottom: "12px",
            }}
          >
            {splitMode === "equal" ? "Each Person Pays" : "Share Preview"}
          </h4>
          <div className="flex flex-col gap-2">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: person.color,
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "white",
                  }}
                >
                  {person.avatar}
                </div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#1A1A2E",
                    flex: 1,
                  }}
                >
                  {person.name}
                </span>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 800,
                    color: "#22C55E",
                  }}
                >
                  {formatCents(shareByPerson[person.id] ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {splitMode === "itemized" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <h4
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#1A1A2E",
                  marginBottom: "10px",
                }}
              >
                Assign Items
              </h4>
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const assigned =
                    itemAssignments[item.id] ||
                    new Set(people.map((p) => p.id));

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: "white",
                        border: "1.5px solid #F3F4F6",
                      }}
                    >
                      <Drawer direction="bottom">
                        <DrawerTrigger asChild>
                          <button
                            className="w-full flex items-center gap-3 p-3 text-left"
                          >
                            <div className="flex-1">
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "#1A1A2E",
                                }}
                              >
                                {item.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "#9CA3AF",
                                }}
                              >
                                ${(item.price * item.qty).toFixed(2)} ·{" "}
                                {assigned.size} sharing
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {people
                                .filter((p) => assigned.has(p.id))
                                .slice(0, 3)
                                .map((p) => (
                                  <div
                                    key={p.id}
                                    className="w-6 h-6 rounded-full flex items-center justify-center"
                                    style={{
                                      background: p.color,
                                      fontSize: "9px",
                                      fontWeight: 700,
                                      color: "white",
                                    }}
                                  >
                                    {p.avatar}
                                  </div>
                                ))}
                              {assigned.size > 3 && (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{
                                    background: "#E5E7EB",
                                    fontSize: "9px",
                                    color: "#6B7280",
                                  }}
                                >
                                  +{assigned.size - 3}
                                </div>
                              )}
                            </div>
                            <ChevronDown size={16} color="#9CA3AF" />
                          </button>
                        </DrawerTrigger>
                        <DrawerContent
                          className="max-h-[70vh]"
                          style={{ background: "white" }}
                        >
                          <DrawerHeader>
                            <DrawerTitle style={{ fontSize: "16px" }}>
                              Who had {item.name}?
                            </DrawerTitle>
                          </DrawerHeader>
                          <div className="flex flex-wrap gap-2 px-4 pb-6 overflow-y-auto">
                            {people.map((person) => {
                              const isAssigned = (
                                itemAssignments[item.id] ??
                                new Set(people.map((p) => p.id))
                              ).has(person.id);
                              return (
                                <button
                                  key={person.id}
                                  onClick={() =>
                                    togglePersonForItem(item.id, person.id)
                                  }
                                  className="flex items-center gap-2 rounded-full px-4 py-2 transition-all"
                                  style={{
                                    background: isAssigned
                                      ? person.color
                                      : "#F3F4F6",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: isAssigned ? "white" : "#6B7280",
                                    border: `2px solid ${
                                      isAssigned ? person.color : "#E5E7EB"
                                    }`,
                                  }}
                                >
                                  {isAssigned && (
                                    <Check size={14} color="white" />
                                  )}
                                  <span
                                    className="w-7 h-7 rounded-full flex items-center justify-center"
                                    style={{
                                      background: isAssigned
                                        ? "rgba(255,255,255,0.3)"
                                        : "#E5E7EB",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: isAssigned ? "white" : "#6B7280",
                                    }}
                                  >
                                    {person.avatar}
                                  </span>
                                  {person.name}
                                </button>
                              );
                            })}
                          </div>
                        </DrawerContent>
                      </Drawer>
                    </motion.div>
                  );
                })}
              </div>
              <div className="h-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        className="px-5 pt-3 pb-4 flex-shrink-0"
        style={{
          background: "white",
          borderTop: "1px solid #F3F4F6",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex justify-between mb-3">
          <span style={{ fontSize: "13px", color: "#6B7280" }}>
            Total to split
          </span>
          <span
            style={{
              fontSize: "15px",
              fontWeight: 800,
              color: "#1A1A2E",
            }}
          >
            {formatCents(
              shares.reduce((s, r) => s + r.amountCents, 0)
            )}
          </span>
        </div>
        <motion.button
          whileTap={{ scale: continuing ? 1 : 0.97 }}
          onClick={handleContinue}
          disabled={continuing}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: continuing ? "#9CA3AF" : "linear-gradient(135deg, #22C55E, #16A34A)",
            color: "white",
            fontSize: "16px",
            fontWeight: 800,
          }}
        >
          {continuing ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Loading...
            </>
          ) : (
            "Review & Send →"
          )}
        </motion.button>
      </div>
    </div>
  );
}
