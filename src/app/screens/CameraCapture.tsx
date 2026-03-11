import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Zap,
  Upload,
  Loader2,
  RotateCcw,
  AlertTriangle,
  Check,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { Screen } from "../types";
import { useBillStore } from "../../store/billStore";
import { apiSplitwiseStatus } from "../../lib/api";
import { hapticLight, hapticError as hapticErrorFn } from "../../lib/haptic";

interface CameraCaptureProps {
  navigate: (screen: Screen) => void;
}

type Phase = "capture" | "preview" | "processing" | "error";

const PROCESSING_STEPS = [
  { label: "Uploading image", icon: "📤" },
  { label: "Analyzing receipt", icon: "🔍" },
  { label: "Extracting items & prices", icon: "🧮" },
  { label: "Verifying totals", icon: "✨" },
];

const TIPS = [
  "Lay receipt flat on a dark surface",
  "Avoid shadows and glare",
  "Include the full receipt in frame",
  "Make sure text is sharp and readable",
];

async function compressImage(
  blob: Blob,
  maxDim = 1600,
  quality = 0.82
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && blob.size < 800_000) {
        resolve(blob);
        return;
      }
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(blob);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (result) => resolve(result || blob),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

export function CameraCapture({ navigate }: CameraCaptureProps) {
  const [phase, setPhase] = useState<Phase>("capture");
  const [processingStep, setProcessingStep] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [videoHasFrames, setVideoHasFrames] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [needsUserTap, setNeedsUserTap] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedBlobRef = useRef<Blob | null>(null);

  const setReceiptImage = useBillStore((s) => s.setReceiptImage);
  const parseReceiptFromImage = useBillStore((s) => s.parseReceiptFromImage);

  useEffect(() => {
    apiSplitwiseStatus()
      .then((s) => {
        if (!s.connected) navigate("import");
      })
      .catch(() => navigate("import"));
  }, [navigate]);

  // Camera setup — only active during capture phase
  useEffect(() => {
    if (phase !== "capture") return;
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError("Camera not supported");
          return;
        }
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: "environment",
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: false,
        };
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          video.setAttribute("playsinline", "");
          video.setAttribute("webkit-playsinline", "");
          try {
            await video.play();
            setNeedsUserTap(false);
          } catch {
            setNeedsUserTap(true);
          }
        }
        setCameraReady(true);
        setVideoHasFrames(false);
        setCameraError(null);
      } catch (err) {
        console.warn("Camera access failed:", err);
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

  // Advance processing step indicators
  useEffect(() => {
    if (phase !== "processing") return;
    setProcessingStep(0);
    const timers = [
      setTimeout(() => setProcessingStep(1), 1200),
      setTimeout(() => setProcessingStep(2), 3500),
      setTimeout(() => setProcessingStep(3), 7000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const handleEnableCamera = async () => {
    const video = videoRef.current;
    if (video && streamRef.current && needsUserTap) {
      hapticLight();
      try {
        await video.play();
        setNeedsUserTap(false);
      } catch {
        setCameraError("Could not start camera. Try uploading a photo.");
      }
    }
  };

  const captureToPreview = useCallback((blob: Blob) => {
    capturedBlobRef.current = blob;
    const url = URL.createObjectURL(blob);
    setCapturedUrl(url);
    setPhase("preview");
    setParseError(null);
  }, []);

  const startProcessing = useCallback(async () => {
    const blob = capturedBlobRef.current;
    if (!blob) return;
    setPhase("processing");
    setParseError(null);

    try {
      const compressed = await compressImage(blob);
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.startsWith("data:") ? result.split(",")[1] : result;
          if (b64) resolve(b64);
          else reject(new Error("Empty result"));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(compressed);
      });

      if (capturedUrl) setReceiptImage(capturedUrl);

      const ok = await parseReceiptFromImage(base64);
      if (ok) {
        navigate("review");
      } else {
        hapticErrorFn();
        setParseError("Could not extract items from this receipt.");
        setPhase("error");
      }
    } catch (err) {
      hapticErrorFn();
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setParseError(message);
      setPhase("error");
    }
  }, [capturedUrl, navigate, parseReceiptFromImage, setReceiptImage]);

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    startProcessing();
  }, [startProcessing]);

  const handleRetake = useCallback(() => {
    capturedBlobRef.current = null;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setParseError(null);
    setRetryCount(0);
    setPhase("capture");
  }, [capturedUrl]);

  const handleCapture = async () => {
    if (cameraReady && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      if (!video.videoWidth || !video.videoHeight) {
        setParseError("Camera not ready. Wait a moment or upload a photo.");
        return;
      }
      hapticLight();
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) captureToPreview(blob);
          },
          "image/jpeg",
          0.92
        );
      } catch {
        setParseError("Could not capture photo. Try again.");
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isHeicFile =
      file.type.startsWith("image/heic") ||
      file.type.startsWith("image/heif") ||
      /\.heic$/i.test(file.name) ||
      /\.heif$/i.test(file.name);
    if (!file.type.startsWith("image/") && !isHeicFile) return;
    e.target.value = "";
    setParseError(null);

    let blobToUse: Blob = file;
    if (isHeicFile) {
      try {
        const { heicTo } = await import("heic-to");
        blobToUse = await heicTo({
          blob: file,
          type: "image/jpeg",
          quality: 0.9,
        });
      } catch {
        setParseError(
          "Could not convert HEIC image. Try Settings → Camera → Formats → Most Compatible."
        );
        return;
      }
    }
    captureToPreview(blobToUse);
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A]">
      <AnimatePresence mode="wait">
        {/* ── PREVIEW PHASE ─────────────────────────────────────────── */}
        {phase === "preview" && capturedUrl && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center justify-between px-5 py-4 z-10">
              <button
                onClick={handleRetake}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <ArrowLeft size={20} color="white" />
              </button>
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: "-0.02em",
                }}
              >
                Review Photo
              </span>
              <div className="w-10" />
            </div>

            <div className="flex-1 relative overflow-hidden mx-4 rounded-2xl">
              <img
                src={capturedUrl}
                alt="Captured receipt"
                className="absolute inset-0 w-full h-full object-contain bg-black/50"
              />
              <div
                className="absolute bottom-0 left-0 right-0 px-4 py-3"
                style={{
                  background:
                    "linear-gradient(transparent, rgba(0,0,0,0.85))",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb size={14} color="#FCD34D" />
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#FCD34D",
                      fontWeight: 600,
                    }}
                  >
                    Quick check
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.7)",
                    lineHeight: 1.5,
                  }}
                >
                  Make sure the receipt text is clear, well-lit, and fully
                  visible.
                </p>
              </div>
            </div>

            <div className="px-5 py-5 flex gap-3">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleRetake}
                className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                <RotateCcw size={18} />
                Retake
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={startProcessing}
                className="flex-[2] py-4 rounded-2xl flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #22C55E, #16A34A)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 800,
                  boxShadow: "0 4px 20px rgba(34,197,94,0.3)",
                }}
              >
                <Zap size={18} />
                Scan Receipt
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── PROCESSING PHASE ──────────────────────────────────────── */}
        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full items-center justify-center px-8"
          >
            {capturedUrl && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 rounded-2xl overflow-hidden mb-6 border-2"
                style={{ borderColor: "rgba(34,197,94,0.4)" }}
              >
                <img
                  src={capturedUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </motion.div>
            )}

            <motion.div
              className="w-14 h-14 rounded-full border-[3px] mb-8"
              style={{
                borderColor: "rgba(34,197,94,0.15)",
                borderTopColor: "#22C55E",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />

            <div className="w-full max-w-[280px] space-y-3">
              {PROCESSING_STEPS.map((step, i) => {
                const isActive = i === processingStep;
                const isDone = i < processingStep;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: isDone || isActive ? 1 : 0.3, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDone
                          ? "#22C55E"
                          : isActive
                            ? "rgba(34,197,94,0.2)"
                            : "rgba(255,255,255,0.05)",
                        border: isActive ? "2px solid #22C55E" : "none",
                      }}
                    >
                      {isDone ? (
                        <Check size={14} color="white" />
                      ) : (
                        <span style={{ fontSize: "14px" }}>{step.icon}</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: isActive ? 700 : 500,
                        color: isDone
                          ? "#22C55E"
                          : isActive
                            ? "white"
                            : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {step.label}
                      {isActive && (
                        <motion.span
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        >
                          ...
                        </motion.span>
                      )}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            <p
              className="mt-8"
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.35)",
                textAlign: "center",
              }}
            >
              This usually takes 5–10 seconds
            </p>
          </motion.div>
        )}

        {/* ── ERROR PHASE ───────────────────────────────────────────── */}
        {phase === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center px-5 py-4">
              <button
                onClick={handleRetake}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <ArrowLeft size={20} color="white" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-8">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{ background: "rgba(239,68,68,0.15)" }}
              >
                <AlertTriangle size={28} color="#EF4444" />
              </motion.div>

              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "white",
                  textAlign: "center",
                  marginBottom: "8px",
                }}
              >
                Couldn't read receipt
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.5)",
                  textAlign: "center",
                  lineHeight: 1.6,
                  marginBottom: "24px",
                  maxWidth: "280px",
                }}
              >
                {parseError ||
                  "The image was unclear or didn't contain recognizable receipt data."}
              </p>

              <div
                className="w-full max-w-[300px] rounded-2xl p-4 mb-6"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={14} color="#FCD34D" />
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#FCD34D",
                    }}
                  >
                    Tips for better results
                  </span>
                </div>
                <ul className="space-y-2">
                  {TIPS.map((tip, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2"
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      <span className="mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {retryCount > 0 && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: "16px",
                  }}
                >
                  Attempt {retryCount + 1} of 3
                </p>
              )}
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleRetake}
                className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                <RotateCcw size={18} />
                New photo
              </motion.button>
              {retryCount < 2 && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleRetry}
                  className="flex-[2] py-4 rounded-2xl flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
                    color: "white",
                    fontSize: "15px",
                    fontWeight: 800,
                    boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
                  }}
                >
                  <RefreshCw size={18} />
                  Try again
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── CAPTURE PHASE ─────────────────────────────────────────── */}
        {phase === "capture" && (
          <motion.div
            key="capture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {parseError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-5 mb-2 rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
              >
                <span style={{ fontSize: "14px" }}>⚠️</span>
                <span style={{ fontSize: "13px", color: "#B91C1C" }}>
                  {parseError}
                </span>
              </motion.div>
            )}
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-4 z-10">
              <button
                onClick={() => navigate("import")}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <ArrowLeft size={20} color="white" />
              </button>
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: "-0.02em",
                }}
              >
                Scan Receipt
              </span>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.25)" }}
              >
                <Zap size={18} color="#22C55E" />
              </div>
            </div>

            {/* Camera viewfinder */}
            <div
              className="flex-1 relative overflow-hidden min-h-[280px]"
              style={{ minHeight: "50vh" }}
            >
              {cameraReady ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                    onLoadedData={() => setVideoHasFrames(true)}
                    onError={() => setVideoHasFrames(false)}
                  />
                  {needsUserTap && (
                    <button
                      type="button"
                      onClick={handleEnableCamera}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70"
                    >
                      <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/20">
                        <Zap size={28} color="#22C55E" />
                      </div>
                      <span className="text-white font-semibold text-base px-6 text-center">
                        Tap to enable camera
                      </span>
                      <span className="text-white/70 text-sm px-6 text-center">
                        Your browser requires a tap to show the live view
                      </span>
                    </button>
                  )}
                </>
              ) : !cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                  <Loader2
                    size={28}
                    color="#22C55E"
                    className="animate-spin"
                  />
                  <span className="text-white/80 text-sm">
                    Starting camera...
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#1a1a1a]">
                  <Upload
                    size={32}
                    color="rgba(255,255,255,0.4)"
                  />
                  <p
                    style={{
                      fontSize: "14px",
                      color: "rgba(255,255,255,0.5)",
                      textAlign: "center",
                      padding: "0 2rem",
                    }}
                  >
                    Camera unavailable. Upload a photo of your receipt below.
                  </p>
                </div>
              )}

              {/* Vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse 75% 75% at center, transparent 55%, rgba(0,0,0,0.2) 100%)",
                }}
              />

              {/* Receipt frame overlay */}
              <div
                className="absolute flex items-center justify-center pointer-events-none"
                style={{
                  width: "min(280px, 88vw)",
                  height: "min(400px, 58vh)",
                  inset: 0,
                  margin: "auto",
                }}
              >
                <div className="relative w-full h-full">
                  <div
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      border: "2px solid rgba(255,255,255,0.5)",
                      boxShadow:
                        "0 0 0 1px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(34,197,94,0.4)",
                    }}
                  />
                  {[
                    {
                      top: 0,
                      left: 0,
                      borderTop: "3px solid #22C55E",
                      borderLeft: "3px solid #22C55E",
                    },
                    {
                      top: 0,
                      right: 0,
                      borderTop: "3px solid #22C55E",
                      borderRight: "3px solid #22C55E",
                    },
                    {
                      bottom: 0,
                      left: 0,
                      borderBottom: "3px solid #22C55E",
                      borderLeft: "3px solid #22C55E",
                    },
                    {
                      bottom: 0,
                      right: 0,
                      borderBottom: "3px solid #22C55E",
                      borderRight: "3px solid #22C55E",
                    },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="absolute w-6 h-6 rounded-sm"
                      style={s}
                    />
                  ))}
                </div>
              </div>

              {/* Guide text & upload */}
              <div
                className="absolute bottom-4 left-0 right-0 text-center space-y-2 px-4"
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {!needsUserTap && (
                  <div style={{ fontWeight: 500 }}>
                    {cameraError
                      ? ""
                      : cameraReady && videoHasFrames
                        ? "Align receipt in frame, then tap the shutter"
                        : cameraReady
                          ? "Camera ready"
                          : "Starting camera..."}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,image/heic,image/heif,.heic,.heif"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => {
                    hapticLight();
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center justify-center gap-2 mx-auto py-2.5 px-5 rounded-xl"
                  style={{
                    background: cameraError
                      ? "linear-gradient(135deg, #22C55E, #16A34A)"
                      : "rgba(255,255,255,0.2)",
                    backdropFilter: cameraError ? "none" : "blur(8px)",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  <Upload size={18} />
                  {cameraError
                    ? "Upload receipt photo"
                    : "Upload photo"}
                </button>
              </div>
            </div>

            {/* Bottom controls */}
            <div className="flex items-center justify-around px-8 py-6 gap-4">
              <button
                onClick={() => navigate("import")}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <ArrowLeft size={20} color="white" />
              </button>

              {/* Shutter button */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  hapticLight();
                  handleCapture();
                }}
                className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "white",
                  boxShadow:
                    "0 0 0 5px rgba(255,255,255,0.25), 0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  className="w-16 h-16 rounded-full"
                  style={{
                    background: "white",
                    border: "3px solid #D1D5DB",
                  }}
                />
              </motion.button>

              <button
                onClick={() => {
                  hapticLight();
                  fileInputRef.current?.click();
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(34,197,94,0.25)",
                  border: "1.5px solid rgba(34,197,94,0.5)",
                }}
              >
                <Upload size={20} color="#22C55E" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
