import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, RotateCcw, Check, Zap, Upload } from "lucide-react";
import { Screen } from "../types";
import { useBillStore } from "../../store/billStore";
import { apiSplitwiseStatus } from "../../lib/api";

interface CameraCaptureProps {
  navigate: (screen: Screen) => void;
}

const PROCESSING_MESSAGES = [
  "Reading your receipt... 🔍",
  "Spotting line items... 🍕",
  "Crunching numbers... 🧮",
  "Almost done! ✨",
];

export function CameraCapture({ navigate }: CameraCaptureProps) {
  const [phase, setPhase] = useState<"capture" | "processing">("capture");
  const [messageIdx, setMessageIdx] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [scanLine, setScanLine] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingBase64Ref = useRef<string | null>(null);
  const pendingImageUrlRef = useRef<string | null>(null);

  const setReceiptImage = useBillStore((s) => s.setReceiptImage);
  const parseReceiptFromImage = useBillStore((s) => s.parseReceiptFromImage);

  useEffect(() => {
    apiSplitwiseStatus()
      .then((s) => { if (!s.connected) navigate("import"); })
      .catch(() => navigate("import"));
  }, [navigate]);

  useEffect(() => {
    if (phase !== "capture") return;
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError("Camera not supported");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setCameraReady(true);
        setCameraError(null);
      } catch (err) {
        console.warn("Camera access failed, falling back to file input:", err);
        setCameraError((err as Error).message);
        setCameraReady(false);
      }
    };
    startCamera();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [phase]);

  useEffect(() => {
    const interval = setInterval(() => {
      setScanLine(prev => (prev + 2) % 100);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (phase === "processing" && pendingBase64Ref.current) {
      let cancelled = false;
      const base64 = pendingBase64Ref.current;
      (async () => {
        setParseError(null);
        const ok = await parseReceiptFromImage(base64);
        if (cancelled) return;
        if (ok) {
          setReceiptImage(pendingImageUrlRef.current || undefined);
          navigate("review");
        } else {
          setParseError("Could not extract items. Try a clearer photo.");
          setPhase("capture");
        }
        pendingBase64Ref.current = null;
        pendingImageUrlRef.current = null;
      })();
      return () => { cancelled = true; };
    }
  }, [phase, parseReceiptFromImage, setReceiptImage, navigate]);

  const processImage = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    pendingImageUrlRef.current = url;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.startsWith("data:") ? result.split(",")[1] : result;
      if (base64) {
        pendingBase64Ref.current = base64;
        setPhase("processing");
      }
    };
    reader.readAsDataURL(blob);
  };

  const handleCapture = async () => {
    if (cameraReady && videoRef.current && streamRef.current) {
      try {
        const video = videoRef.current;
        if (!video.videoWidth || !video.videoHeight) {
          setParseError("Camera not ready. Wait a moment and try again.");
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) processImage(blob);
          },
          "image/jpeg",
          0.9
        );
      } catch (err) {
        console.error("Capture failed:", err);
        setParseError("Could not capture photo. Try again.");
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isHeicFile = file.type.startsWith("image/heic") || file.type.startsWith("image/heif") || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
    if (!file.type.startsWith("image/") && !isHeicFile) return;
    e.target.value = "";

    let blobToRead: Blob = file;
    if (isHeicFile) {
      try {
        const { heicTo } = await import("heic-to");
        blobToRead = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
      } catch (err) {
        console.error("HEIC conversion failed:", err);
        setParseError("Could not convert HEIC image. Try Settings → Camera → Formats → Most Compatible.");
        return;
      }
    }
    processImage(blobToRead);
  };

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      <AnimatePresence mode="wait">
        {phase === "capture" ? (
          <motion.div
            key="capture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {parseError && (
              <div
                className="mx-5 mb-2 rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
              >
                <span style={{ fontSize: "14px" }}>⚠️</span>
                <span style={{ fontSize: "13px", color: "#B91C1C" }}>{parseError}</span>
              </div>
            )}
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3 z-10">
              <button
                onClick={() => navigate("import")}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <ArrowLeft size={18} color="white" />
              </button>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>
                Scan Receipt
              </span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.2)" }}>
                <Zap size={16} color="#22C55E" />
              </div>
            </div>

            {/* Camera viewfinder */}
            <div className="flex-1 flex items-center justify-center px-6 relative overflow-hidden min-h-0">
              {/* Live camera or fallback background */}
              {cameraReady ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : !cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#1a1a1a" }}>
                  <div className="text-center text-white/60 text-sm">Starting camera...</div>
                </div>
              ) : (
                <div
                  className="absolute inset-0 rounded-2xl overflow-hidden"
                  style={{ background: "linear-gradient(160deg, #2a2a2a, #1a1a1a)" }}
                />
              )}

              {/* Dark vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.5) 100%)",
                }}
              />

              {/* Receipt frame overlay */}
              <div
                className="absolute flex items-center justify-center"
                style={{
                  width: "min(260px, 85vw)",
                  height: "min(380px, 55vh)",
                  inset: 0,
                  margin: "auto",
                }}
              >
                <div className="relative w-full h-full">
                  <div
                    className="absolute inset-0 rounded-2xl border-2 border-green-500/60"
                    style={{ boxShadow: "inset 0 0 0 1px rgba(34,197,94,0.3)" }}
                  />
                  {/* Scan line */}
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 pointer-events-none rounded-2xl"
                    style={{
                      top: `${scanLine}%`,
                      background: "linear-gradient(90deg, transparent, #22C55E, #22C55E, transparent)",
                      opacity: 0.8,
                    }}
                  />
                  {/* Corner brackets */}
                  {[
                    { top: 4, left: 4, borderTop: "3px solid #22C55E", borderLeft: "3px solid #22C55E" },
                    { top: 4, right: 4, borderTop: "3px solid #22C55E", borderRight: "3px solid #22C55E" },
                    { bottom: 4, left: 4, borderBottom: "3px solid #22C55E", borderLeft: "3px solid #22C55E" },
                    { bottom: 4, right: 4, borderBottom: "3px solid #22C55E", borderRight: "3px solid #22C55E" },
                  ].map((style, i) => (
                    <div key={i} className="absolute w-6 h-6 rounded" style={style} />
                  ))}
                </div>
              </div>

              {/* Guide text & fallback */}
              <div
                className="absolute bottom-4 left-0 right-0 text-center space-y-2"
                style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}
              >
                <div>{cameraReady ? "Align receipt in frame, then tap capture" : "Or upload a photo"}</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,image/heic,image/heif,.heic,.heif"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 mx-auto py-2 px-4 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "white",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  <Upload size={16} />
                  Upload photo instead
                </button>
              </div>
            </div>

            {/* Bottom controls */}
            <div className="flex items-center justify-around px-8 py-6">
              <button
                onClick={() => navigate("import")}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <RotateCcw size={20} color="white" />
              </button>

              {/* Shutter button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCapture}
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: "white",
                  boxShadow: "0 0 0 4px rgba(255,255,255,0.3)",
                }}
              >
                <div
                  className="w-16 h-16 rounded-full"
                  style={{ background: "white", border: "3px solid #E5E7EB" }}
                />
              </motion.button>

              <button
                onClick={() => navigate("review")}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)" }}
              >
                <Check size={20} color="#22C55E" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full items-center justify-center gap-6 px-8"
          >
            {/* Animated receipt */}
            <motion.div
              animate={{ scale: [1, 1.05, 1], rotate: [0, -2, 2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ fontSize: "64px" }}
            >
              🧾
            </motion.div>

            {/* Spinning indicator */}
            <motion.div
              className="w-12 h-12 rounded-full border-4"
              style={{ borderColor: "rgba(34,197,94,0.2)", borderTopColor: "#22C55E" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />

            {/* Message */}
            <AnimatePresence mode="wait">
              <motion.p
                key={messageIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ fontSize: "18px", fontWeight: 700, color: "white", textAlign: "center" }}
              >
                {PROCESSING_MESSAGES[messageIdx]}
              </motion.p>
            </AnimatePresence>

            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
              Extracting items and prices...
            </p>

            {/* Progress dots */}
            <div className="flex gap-2">
              {PROCESSING_MESSAGES.map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: i <= messageIdx ? "#22C55E" : "rgba(255,255,255,0.2)" }}
                  animate={{ scale: i === messageIdx ? [1, 1.4, 1] : 1 }}
                  transition={{ duration: 0.4, repeat: i === messageIdx ? Infinity : 0 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
