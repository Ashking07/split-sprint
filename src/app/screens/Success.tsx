import React, { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ExternalLink, Home } from "lucide-react";
import confetti from "canvas-confetti";
import { AppState, Screen } from "../types";
import { GROUPS } from "../mockData";
import { useBillStore } from "../../store/billStore";
import { SPLITWISE_PLACEHOLDER_URL } from "../../lib/exportSplitwise";
import { getProgress } from "../../lib/xpUtils";

interface SuccessProps {
  state: AppState;
  setState: (s: Partial<AppState>) => void;
  navigate: (screen: Screen) => void;
}

export function Success({ state, setState, navigate }: SuccessProps) {
  const fired = useRef(false);
  const selectedGroup = state.selectedGroup || GROUPS[0];
  const { level, xpInLevel, maxXpForLevel } = getProgress(state.xp);
  const people = state.selectedPeople?.length ? state.selectedPeople : selectedGroup.members;

  const items = state.items;
  const tax = state.tax ?? 0;
  const tip = state.tip || 0;
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0) || 52.99;
  const total = subtotal + tax + tip;
  const splitMode = state.splitMode || "equal";

  const getPersonShare = (personId: string): number => {
    if (splitMode === "equal") return total / people.length;
    let share = 0;
    items.forEach((item) => {
      const assigned = item.assignedTo?.length ? item.assignedTo : people.map((p) => p.id);
      if (assigned.includes(personId)) {
        share += (item.price * item.qty) / assigned.length;
      }
    });
    share += (tax + tip) / people.length;
    return share;
  };

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const duration = 2500;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#22C55E", "#7C3AED", "#F59E0B", "#EF4444", "#3B82F6"],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#22C55E", "#7C3AED", "#F59E0B", "#EF4444", "#3B82F6"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const resetDraft = useBillStore((s) => s.resetDraft);

  const handleDone = () => {
    // XP/streak already added in Confirmation; just reset draft and go home
    resetDraft();
    navigate("home");
  };

  return (
    <div
      className="flex flex-col h-full items-center px-5 overflow-y-auto"
      style={{
        paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 1rem))",
      }}
    >
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", boxShadow: "0 16px 40px rgba(34,197,94,0.4)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          style={{ fontSize: "42px" }}
        >
          ✅
        </motion.div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ fontSize: "24px", fontWeight: 900, color: "#1A1A2E", textAlign: "center", marginBottom: "4px" }}
      >
        Added to Splitwise!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ fontSize: "14px", color: "#6B7280", textAlign: "center", marginBottom: "24px" }}
      >
        ${total.toFixed(2)} split between {people.length} people in {selectedGroup.name}
      </motion.p>

      {/* XP reward */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 400 }}
        className="rounded-2xl px-8 py-4 flex items-center gap-4 mb-5 w-full"
        style={{
          background: "linear-gradient(135deg, #1E1B4B, #312E81)",
          boxShadow: "0 8px 24px rgba(124,58,237,0.25)",
        }}
      >
        <motion.div
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 0.8, delay: 0.6 }}
          style={{ fontSize: "36px" }}
        >
          ⚡
        </motion.div>
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            style={{ fontSize: "28px", fontWeight: 900, color: "#A78BFA", lineHeight: 1 }}
          >
            +{state.xpGained ?? 25} XP
          </motion.div>
          <div style={{ fontSize: "13px", color: "#C4B5FD", marginTop: "2px" }}>
            Level {level} · {xpInLevel} / {maxXpForLevel} XP
          </div>
        </div>
        <div className="ml-auto text-right">
          <div style={{ fontSize: "20px" }}>🔥</div>
          <div style={{ fontSize: "11px", color: "#F97316", fontWeight: 800 }}>{state.streak} STREAK</div>
        </div>
      </motion.div>

      {/* Streak nudge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="rounded-xl px-4 py-3 flex items-center gap-3 w-full mb-6"
        style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}
      >
        <span style={{ fontSize: "18px" }}>🎯</span>
        <p style={{ fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>Keep your streak alive!</span> Add 1 more bill this week to reach 5🔥
        </p>
      </motion.div>

      {/* People cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="w-full rounded-2xl overflow-hidden mb-6"
        style={{ background: "white", border: "1.5px solid #F3F4F6" }}
      >
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #F3F4F6" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#1A1A2E" }}>Notified</span>
          <div className="flex gap-1 ml-auto">
            {people.slice(0, 4).map(p => (
              <div
                key={p.id}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: p.color, fontSize: "11px", fontWeight: 700, color: "white" }}
              >
                {p.avatar}
              </div>
            ))}
          </div>
        </div>
        {people.map((person, i) => {
          const share = getPersonShare(person.id);
          return (
            <div
              key={person.id}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: i < people.length - 1 ? "1px solid #F9FAFB" : "none" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: person.color, fontSize: "11px", fontWeight: 700, color: "white" }}
              >
                {person.avatar}
              </div>
              <span style={{ fontSize: "13px", color: "#4B5563", flex: 1 }}>{person.name}</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#22C55E" }}>
                ${share.toFixed(2)}
              </span>
              <span className="rounded-full px-2 py-0.5"
                style={{ fontSize: "10px", fontWeight: 700, background: "#DCFCE7", color: "#16A34A" }}>
                Notified ✓
              </span>
            </div>
          );
        })}
      </motion.div>

      {/* CTAs */}
      <div
        className="flex flex-col gap-2.5 w-full"
        style={{
          paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))",
        }}
      >
        <motion.a
          href={SPLITWISE_PLACEHOLDER_URL}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            color: "white",
            fontSize: "15px",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          <ExternalLink size={16} color="white" />
          View in Splitwise
        </motion.a>
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          onClick={handleDone}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: "white",
            border: "2px solid #E5E7EB",
            color: "#1A1A2E",
            fontSize: "15px",
            fontWeight: 700,
          }}
        >
          <Home size={16} color="#6B7280" />
          Done
        </motion.button>
      </div>
    </div>
  );
}
