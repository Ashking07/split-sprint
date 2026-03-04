import React, { useState } from "react";
import { motion } from "motion/react";
import { Copy, Search, ExternalLink } from "lucide-react";
import { NavBar } from "../components/NavBar";
import { Screen } from "../types";
import { useBillStore } from "../../store/billStore";
import { SPLITWISE_PLACEHOLDER_URL } from "../../lib/exportSplitwise";

interface HistoryProps {
  navigate: (screen: Screen) => void;
}

export function History({ navigate }: HistoryProps) {
  const [query, setQuery] = useState("");
  const historyFromStore = useBillStore((s) => s.history);
  const loadBill = useBillStore((s) => s.loadBill);
  const history = historyFromStore;

  const filtered = history.filter(
    (h) =>
      h.title?.toLowerCase().includes(query.toLowerCase()) ||
      h.group?.toLowerCase().includes(query.toLowerCase())
  );

  const totalSent = history.filter((h) => h.status === "sent").reduce((s, h) => s + (h.total ?? 0), 0);

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Bill History"
        subtitle={`${history.length} bills tracked`}
        onBack={() => navigate("home")}
      />

      {/* Stats */}
      <div className="px-5 mb-3 grid grid-cols-3 gap-2">
        {[
          { label: "Total Sent", value: `$${totalSent.toFixed(0)}`, icon: "💸", color: "#22C55E" },
          { label: "This Month", value: `${history.length}`, icon: "📊", color: "#7C3AED" },
          { label: "Drafts", value: `${history.filter((h) => h.status === "draft").length}`, icon: "📝", color: "#F59E0B" },
        ].map(stat => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-3 text-center"
            style={{ background: "white", border: "1.5px solid #F3F4F6" }}
          >
            <div style={{ fontSize: "18px", marginBottom: "2px" }}>{stat.icon}</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: 600 }}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="px-5 mb-3">
        <div className="relative">
          <Search size={16} color="#9CA3AF" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search bills..."
            className="w-full rounded-xl pl-10 pr-4 py-2.5 outline-none"
            style={{
              background: "white",
              border: "1.5px solid #E5E7EB",
              fontSize: "14px",
              color: "#1A1A2E",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <div className="flex flex-col gap-2">
          {filtered.map((bill, i) => (
            <motion.div
              key={bill.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "white", border: "1.5px solid #F3F4F6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center gap-3 p-3.5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: "#F9FAFB" }}
                >
                  {bill.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#1A1A2E" }} className="truncate">
                    {bill.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
                    {bill.date} · {bill.group}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#1A1A2E" }}>
                    ${(bill.total ?? 0).toFixed(2)}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      background: bill.status === "sent" ? "#DCFCE7" : "#FEF9C3",
                      color: bill.status === "sent" ? "#16A34A" : "#CA8A04",
                    }}
                  >
                    {bill.status === "sent" ? "✓ Sent" : "Draft"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div
                className="flex"
                style={{ borderTop: "1px solid #F3F4F6" }}
              >
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors"
                  style={{ fontSize: "12px", fontWeight: 700, color: "#6B7280" }}
                  onClick={async () => {
                    const ok = await loadBill(bill.id, {
                      forDuplicate: bill.status !== "draft",
                    });
                    if (ok) navigate("review");
                  }}
                >
                  {bill.status === "draft" ? "Resume" : "Duplicate"}
                </button>
                <div style={{ width: "1px", background: "#F3F4F6" }} />
                <a
                  href={SPLITWISE_PLACEHOLDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors"
                  style={{ fontSize: "12px", fontWeight: 700, color: "#22C55E", textDecoration: "none" }}
                >
                  <ExternalLink size={13} color="#22C55E" />
                  View in Splitwise
                </a>
              </div>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🧾</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#1A1A2E" }}>No bills found</div>
              <div style={{ fontSize: "13px", color: "#9CA3AF", marginTop: "4px" }}>
                Try a different search term
              </div>
            </div>
          )}
        </div>
        <div className="h-4" />
      </div>

      {/* Add bill FAB */}
      <div className="px-5 pb-4 pt-2 flex-shrink-0"
        style={{ background: "white", borderTop: "1px solid #F3F4F6" }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("import")}
          className="w-full py-3.5 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            color: "white",
            fontSize: "15px",
            fontWeight: 800,
          }}
        >
          + Add New Bill
        </motion.button>
      </div>
    </div>
  );
}
