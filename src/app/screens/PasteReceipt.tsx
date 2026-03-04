import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { NavBar } from "../components/NavBar";
import { Screen } from "../types";
import { useBillStore } from "../../store/billStore";
import { apiSplitwiseStatus } from "../../lib/api";

interface PasteReceiptProps {
  navigate: (screen: Screen) => void;
}

export function PasteReceipt({ navigate }: PasteReceiptProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const parseReceiptFromText = useBillStore((s) => s.parseReceiptFromText);

  useEffect(() => {
    apiSplitwiseStatus()
      .then((s) => { if (!s.connected) navigate("import"); })
      .catch(() => navigate("import"));
  }, [navigate]);

  const handleParse = async () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Paste your receipt text first");
      return;
    }

    setLoading(true);
    try {
      const ok = await parseReceiptFromText(trimmed);
      if (ok) {
        navigate("review");
      } else {
        setError("Could not extract items. Try pasting lines like 'Item Name  $9.99'");
      }
    } catch {
      setError("Could not extract items. Try pasting lines like 'Item Name  $9.99'");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Paste Receipt"
        subtitle="Paste email, text, or receipt snippet"
        onBack={() => navigate("import")}
      />

      <div className="flex justify-center mb-4">
        <motion.div
          animate={{ rotate: [0, -2, 2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: "48px" }}
        >
          📋
        </motion.div>
      </div>

      <div className="px-5 flex-1 flex flex-col gap-3">
        <div className="flex-1 min-h-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste your receipt here. For example:\n\nMargherita Pizza  14.99\nCaesar Salad  8.50\nCraft Beer × 3  18.00\nSparkling Water  4.00\n\nSubtotal  52.99\nTax  4.28`}
            className="w-full h-full min-h-[200px] rounded-2xl p-4 outline-none resize-none"
            style={{
              background: "white",
              border: "1.5px solid #E5E7EB",
              fontSize: "14px",
              color: "#1A1A2E",
              lineHeight: 1.6,
            }}
          />
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-2"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
          >
            <span style={{ fontSize: "14px" }}>⚠️</span>
            <span style={{ fontSize: "13px", color: "#B91C1C" }}>{error}</span>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}
        >
          <Sparkles size={16} color="#3B82F6" />
          <p style={{ fontSize: "12px", color: "#1E40AF", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700 }}>Tip:</span> Works best with lines
            like "Item Name  $X.XX" or "Item × 2  15.00"
          </p>
        </motion.div>
      </div>

      <div className="px-5 pt-3 pb-4 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleParse}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background:
              text.trim().length > 0 && !loading
                ? "linear-gradient(135deg, #6366F1, #4F46E5)"
                : "#E5E7EB",
            color: text.trim().length > 0 && !loading ? "white" : "#9CA3AF",
            fontSize: "16px",
            fontWeight: 800,
          }}
          disabled={text.trim().length === 0 || loading}
        >
          {loading ? (
            <Loader2 size={20} color="#9CA3AF" className="animate-spin" />
          ) : (
            <FileText size={20} color={text.trim().length > 0 ? "white" : "#9CA3AF"} />
          )}
          {loading ? "Extracting items..." : "Extract items"}
        </motion.button>
      </div>
    </div>
  );
}
