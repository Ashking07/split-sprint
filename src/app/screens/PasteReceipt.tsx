import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Type,
  Upload,
  X,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { NavBar } from "../components/NavBar";
import { Screen } from "../types";
import { useBillStore } from "../../store/billStore";
import { apiSplitwiseStatus } from "../../lib/api";
import { hapticLight } from "../../lib/haptic";

interface PasteReceiptProps {
  navigate: (screen: Screen) => void;
}

type InputMode = "photo" | "text";

export function PasteReceipt({ navigate }: PasteReceiptProps) {
  const [mode, setMode] = useState<InputMode>("photo");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const pendingBlobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseReceiptFromText = useBillStore((s) => s.parseReceiptFromText);
  const parseReceiptFromImage = useBillStore((s) => s.parseReceiptFromImage);
  const setReceiptImage = useBillStore((s) => s.setReceiptImage);

  useEffect(() => {
    apiSplitwiseStatus()
      .then((s) => {
        if (!s.connected) navigate("import");
      })
      .catch(() => navigate("import"));
  }, [navigate]);

  const handleImageFile = async (file: File) => {
    const isHeic =
      file.type.startsWith("image/heic") ||
      file.type.startsWith("image/heif") ||
      /\.heic$/i.test(file.name) ||
      /\.heif$/i.test(file.name);
    if (!file.type.startsWith("image/") && !isHeic) {
      setError("Please select an image file (JPEG, PNG, or screenshot).");
      return;
    }

    setError(null);
    let blob: Blob = file;
    if (isHeic) {
      try {
        const { heicTo } = await import("heic-to");
        blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
      } catch {
        setError(
          "Could not convert HEIC image. Try Settings → Camera → Formats → Most Compatible."
        );
        return;
      }
    }

    pendingBlobRef.current = blob;
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
  };

  const clearImage = () => {
    pendingBlobRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleParseImage = async () => {
    const blob = pendingBlobRef.current;
    if (!blob) return;

    setLoading(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.startsWith("data:") ? result.split(",")[1] : result;
          if (b64) resolve(b64);
          else reject(new Error("Empty"));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      if (previewUrl) setReceiptImage(previewUrl);

      await parseReceiptFromImage(base64);
      navigate("review");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleParseText = async () => {
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
        setError(
          "Could not extract items. Try pasting lines like 'Item Name  $9.99'"
        );
      }
    } catch {
      setError(
        "Could not extract items. Try pasting lines like 'Item Name  $9.99'"
      );
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    mode === "photo" ? !!previewUrl && !loading : text.trim().length > 0 && !loading;

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Add Receipt"
        subtitle="Upload a photo or paste text"
        onBack={() => navigate("import")}
      />

      {/* Mode toggle */}
      <div className="px-5 mb-4">
        <div
          className="flex rounded-xl p-1"
          style={{ background: "#F3F4F6" }}
        >
          {(
            [
              { key: "photo" as InputMode, label: "Photo / Screenshot", icon: ImageIcon },
              { key: "text" as InputMode, label: "Paste Text", icon: Type },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                hapticLight();
                setMode(tab.key);
                setError(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all"
              style={{
                background: mode === tab.key ? "white" : "transparent",
                boxShadow:
                  mode === tab.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                color: mode === tab.key ? "#1A1A2E" : "#6B7280",
                fontSize: "13px",
                fontWeight: mode === tab.key ? 700 : 500,
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === "photo" ? (
          <motion.div
            key="photo"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="px-5 flex-1 flex flex-col gap-3"
          >
            {!previewUrl ? (
              /* Drop zone */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-[200px] rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all"
                style={{
                  background: dragActive
                    ? "rgba(99,102,241,0.08)"
                    : "#FAFAFA",
                  border: dragActive
                    ? "2px dashed #6366F1"
                    : "2px dashed #D1D5DB",
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(79,70,229,0.1))",
                  }}
                >
                  <Upload size={28} color="#6366F1" />
                </div>
                <div className="text-center">
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#1A1A2E",
                    }}
                  >
                    Tap to upload receipt photo
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#6B7280",
                      marginTop: "4px",
                    }}
                  >
                    Screenshot, photo, or bill image
                  </p>
                </div>
                <div className="flex gap-2 mt-1">
                  {["JPG", "PNG", "HEIC", "WebP"].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2 py-0.5 rounded-md"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        background: "#F3F4F6",
                        color: "#6B7280",
                      }}
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,image/heic,image/heif,.heic,.heif"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFile(f);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </div>
            ) : (
              /* Image preview */
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="relative flex-1 rounded-2xl overflow-hidden bg-black/5">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="w-full h-full object-contain"
                    style={{ maxHeight: "45vh" }}
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(0,0,0,0.6)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <X size={16} color="white" />
                  </button>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                  }}
                >
                  <Lightbulb size={16} color="#3B82F6" />
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#1E40AF",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Tip:</span> Clear,
                    well-lit photos with readable text work best.
                  </p>
                </motion.div>
              </div>
            )}

            {error && (
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-2"
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                }}
              >
                <AlertTriangle size={14} color="#B91C1C" />
                <span style={{ fontSize: "13px", color: "#B91C1C" }}>
                  {error}
                </span>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="text"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="px-5 flex-1 flex flex-col gap-3"
          >
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
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                }}
              >
                <AlertTriangle size={14} color="#B91C1C" />
                <span style={{ fontSize: "13px", color: "#B91C1C" }}>
                  {error}
                </span>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}
            >
              <Sparkles size={16} color="#3B82F6" />
              <p
                style={{
                  fontSize: "12px",
                  color: "#1E40AF",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 700 }}>Tip:</span> Works best with
                lines like "Item Name  $X.XX" or "Item × 2  15.00"
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 pt-3 pb-4 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={mode === "photo" ? handleParseImage : handleParseText}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: canSubmit
              ? "linear-gradient(135deg, #6366F1, #4F46E5)"
              : "#E5E7EB",
            color: canSubmit ? "white" : "#9CA3AF",
            fontSize: "16px",
            fontWeight: 800,
          }}
          disabled={!canSubmit}
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : mode === "photo" ? (
            <ImageIcon size={20} />
          ) : (
            <FileText size={20} />
          )}
          {loading
            ? "Extracting items..."
            : mode === "photo"
              ? "Scan Receipt"
              : "Extract items"}
        </motion.button>
      </div>
    </div>
  );
}
