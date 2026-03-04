import React from "react";
import { motion } from "motion/react";
import { Clock, Plus, ChevronRight, LogOut, Settings } from "lucide-react";
import { StreakBadge } from "../components/StreakBadge";
import { XPBar } from "../components/XPBar";
import { AppState, Screen } from "../types";
import { useBillStore } from "../../store/billStore";
import { useAuthStore } from "../../store/authStore";
import { HISTORY as FALLBACK_HISTORY } from "../mockData";

interface HomeProps {
  state: AppState;
  navigate: (screen: Screen) => void;
}

export function Home({ state, navigate }: HomeProps) {
  const logout = useAuthStore((s) => s.logout);
  const historyFromStore = useBillStore((s) => s.history);
  const history = historyFromStore.length > 0 ? historyFromStore : FALLBACK_HISTORY;
  const recentBills = history.slice(0, 3);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#1A1A2E", lineHeight: 1.2 }}>
              SplitSprint ⚡
            </h1>
            <p style={{ fontSize: "13px", color: "#6B7280", marginTop: "2px" }}>
              Split bills in under 2 minutes
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("integrations")}
              className="touch-target w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "#F3F4F6" }}
              title="Integrations"
            >
              <Settings size={20} color="#6B7280" />
            </button>
            <button
              onClick={() => logout()}
              className="touch-target w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1A1A2E, #374151)" }}
              title="Sign out"
            >
              <LogOut size={20} color="white" />
            </button>
          </div>
        </div>
      </div>

      {/* Gamification card */}
      <div className="mx-5 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl px-6 py-4"
          style={{ background: "linear-gradient(135deg, #1E1B4B, #312E81)", boxShadow: "0 4px 20px rgba(124,58,237,0.2)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <StreakBadge streak={state.streak} />
            <div className="text-right">
              <span style={{ fontSize: "11px", color: "#A78BFA", fontWeight: 600 }}>THIS WEEK</span>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>3 bills split</div>
            </div>
          </div>
          <XPBar xp={state.xp} maxXP={500} level={3} />
        </motion.div>
      </div>

      {/* Primary CTA */}
      <div className="px-5 mb-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("import")}
          className="w-full rounded-2xl flex items-center justify-center gap-3 py-5 px-6"
          style={{
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            boxShadow: "0 8px 24px rgba(34,197,94,0.35)",
          }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.2)" }}>
            <Plus size={22} color="white" strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <div style={{ fontSize: "17px", fontWeight: 800, color: "white" }}>Add a Bill</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>Usually done in under 2 minutes</div>
          </div>
          <ChevronRight size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: "auto" }} />
        </motion.button>
      </div>

      {/* Secondary CTA */}
      <div className="px-5 mb-5">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("history")}
          className="w-full rounded-2xl flex items-center justify-center gap-3 py-4 px-6 border"
          style={{ background: "white", borderColor: "#E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "#F3F4F6" }}>
            <Clock size={18} color="#6B7280" />
          </div>
          <div className="text-left">
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#1A1A2E" }}>History</div>
            <div style={{ fontSize: "12px", color: "#9CA3AF" }}>View past splits</div>
          </div>
          <ChevronRight size={18} color="#D1D5DB" style={{ marginLeft: "auto" }} />
        </motion.button>
      </div>

      {/* Recent bills */}
      <div className="px-5 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1A1A2E" }}>Recent Bills</h3>
          <button
            onClick={() => navigate("history")}
            style={{ fontSize: "13px", color: "#22C55E", fontWeight: 600 }}
          >
            See all
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {recentBills.map((bill, i) => (
            <motion.div
              key={bill.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#F3F4F6", fontSize: "20px" }}>
                {bill.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A2E" }} className="truncate">
                  {bill.title}
                </div>
                <div style={{ fontSize: "12px", color: "#9CA3AF" }}>{bill.date} · {bill.group}</div>
              </div>
              <div className="text-right">
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#1A1A2E" }}>
                  ${bill.total.toFixed(2)}
                </div>
                <div
                  className="rounded-full px-2 py-0.5 inline-block"
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    background: bill.status === "sent" ? "#DCFCE7" : "#FEF9C3",
                    color: bill.status === "sent" ? "#16A34A" : "#CA8A04",
                  }}
                >
                  {bill.status === "sent" ? "✓ Sent" : "Draft"}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
