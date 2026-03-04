import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Camera, Link, Sparkles, Link2, Check } from "lucide-react";
import { NavBar } from "../components/NavBar";
import { Screen } from "../types";
import { apiSplitwiseStatus, apiSplitwiseGroups } from "../../lib/api";

interface ImportReceiptProps {
  navigate: (screen: Screen) => void;
}

export function ImportReceipt({ navigate }: ImportReceiptProps) {
  const [splitwiseConnected, setSplitwiseConnected] = useState(false);
  const [splitwiseGroups, setSplitwiseGroups] = useState<{ id: number; name: string }[]>([]);
  const [swLoading, setSwLoading] = useState(true);

  useEffect(() => {
    apiSplitwiseStatus()
      .then((s) => {
        setSplitwiseConnected(s.connected);
        if (s.connected) {
          return apiSplitwiseGroups().catch(() => []);
        }
        return [];
      })
      .then((g) => setSplitwiseGroups(Array.isArray(g) ? g : (g?.groups ? g.groups : [])))
      .catch(() => setSplitwiseConnected(false))
      .finally(() => setSwLoading(false));
  }, []);

  const handleConnectSplitwise = () => {
    const token = localStorage.getItem("splitsprint-token");
    const base = import.meta.env.VITE_API_URL || "";
    if (token) {
      const params = new URLSearchParams({ token, returnTo: "import", origin: window.location.origin });
      window.location.href = `${base}/api/splitwise/connect?${params.toString()}`;
    } else {
      alert("Please log in first.");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Import Receipt"
        subtitle="Choose how to add your bill"
        onBack={() => navigate("home")}
      />

      {/* Splitwise connect (early, before adding receipt) */}
      <div className="px-5 mb-4">
        <div
          className="rounded-2xl p-4"
          style={{
            background: splitwiseConnected ? "#F0FDF4" : "#FFFBEB",
            border: splitwiseConnected ? "1.5px solid #86EFAC" : "1.5px solid #FDE68A",
          }}
        >
          {swLoading ? (
            <div style={{ fontSize: "14px", color: "#6B7280" }}>Checking Splitwise...</div>
          ) : splitwiseConnected ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "#22C55E" }}
                >
                  <Check size={16} color="white" />
                </div>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#166534" }}>
                  Splitwise connected
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#15803D", marginBottom: "8px" }}>
                Your groups:
              </p>
              <div className="flex flex-wrap gap-2">
                {splitwiseGroups.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-lg px-2.5 py-1"
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      background: "white",
                      border: "1px solid #86EFAC",
                      color: "#166534",
                    }}
                  >
                    {g.name}
                  </span>
                ))}
                {splitwiseGroups.length === 0 && (
                  <span style={{ fontSize: "12px", color: "#15803D" }}>No groups yet</span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link2 size={20} color="#B45309" />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#92400E" }}>
                  Connect Splitwise first
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#92400E", marginBottom: "10px", lineHeight: 1.5 }}>
                Sync expenses to your Splitwise groups. Connect now, then add your receipt.
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConnectSplitwise}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                <Link2 size={16} />
                Connect Splitwise
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Illustration */}
      <div className="flex justify-center mb-4">
        <motion.div
          animate={{ rotate: [0, -3, 3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: "60px" }}
        >
          🧾
        </motion.div>
      </div>

      {/* Cards - only enabled when Splitwise connected */}
      <div className="px-5 flex flex-col gap-3 flex-1">
        <motion.button
          whileTap={splitwiseConnected ? { scale: 0.97 } : {}}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => splitwiseConnected && navigate("camera")}
          disabled={!splitwiseConnected}
          className="w-full rounded-2xl p-5 text-left"
          style={{
            background: splitwiseConnected
              ? "linear-gradient(135deg, #ECFDF5, #D1FAE5)"
              : "#F3F4F6",
            border: splitwiseConnected ? "2px solid #A7F3D0" : "2px solid #E5E7EB",
            boxShadow: splitwiseConnected ? "0 4px 16px rgba(34,197,94,0.1)" : "none",
            opacity: splitwiseConnected ? 1 : 0.7,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)" }}
            >
              <Camera size={26} color="white" />
            </div>
            <div className="flex-1">
              <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1A1A2E" }}>
                Camera Receipt
              </h3>
              <p style={{ fontSize: "13px", color: "#4B5563", marginTop: "4px", lineHeight: 1.5 }}>
                Point your camera at a physical receipt. Our AI extracts items instantly.
              </p>
              <div className="flex items-center gap-1.5 mt-3">
                <Sparkles size={12} color="#22C55E" />
                <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: 700 }}>
                  AI-powered • Fastest option
                </span>
              </div>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileTap={splitwiseConnected ? { scale: 0.97 } : {}}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => splitwiseConnected && navigate("paste")}
          disabled={!splitwiseConnected}
          className="w-full rounded-2xl p-5 text-left"
          style={{
            background: splitwiseConnected
              ? "linear-gradient(135deg, #EFF6FF, #DBEAFE)"
              : "#F3F4F6",
            border: splitwiseConnected ? "2px solid #BFDBFE" : "2px solid #E5E7EB",
            boxShadow: splitwiseConnected ? "0 4px 16px rgba(99,102,241,0.1)" : "none",
            opacity: splitwiseConnected ? 1 : 0.7,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)" }}
            >
              <Link size={26} color="white" />
            </div>
            <div className="flex-1">
              <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1A1A2E" }}>
                Online Receipt
              </h3>
              <p style={{ fontSize: "13px", color: "#4B5563", marginTop: "4px", lineHeight: 1.5 }}>
                Paste a URL, forward an email, or share a screenshot from any app.
              </p>
              <div className="flex items-center gap-1.5 mt-3">
                <Sparkles size={12} color="#6366F1" />
                <span style={{ fontSize: "12px", color: "#4F46E5", fontWeight: 700 }}>
                  Email · URL · Screenshot
                </span>
              </div>
            </div>
          </div>
        </motion.button>

        {/* Tip banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
        >
          <span style={{ fontSize: "18px" }}>⚡</span>
          <p style={{ fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700 }}>Pro tip:</span> Most people finish in under 2 minutes. 
            Your last group is pre-selected!
          </p>
        </motion.div>
      </div>

      <div className="h-6" />
    </div>
  );
}
