import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, X, Share } from "lucide-react";
import {
  getDeferredPrompt,
  triggerInstallPrompt,
  isIOS,
  isStandalone,
  shouldShowInstallPrompt,
} from "../../lib/installPrompt";

const STORAGE_KEY = "splitsprint-install-dismissed";

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const wasDismissed = sessionStorage.getItem(STORAGE_KEY);
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    if (getDeferredPrompt() || isIOS()) {
      setShow(true);
    }

    const onInstallable = () => setShow(true);
    window.addEventListener("splitsprint-installable", onInstallable);
    return () => window.removeEventListener("splitsprint-installable", onInstallable);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("splitsprint-install-prompt-visible", show);
    return () => document.body.classList.remove("splitsprint-install-prompt-visible");
  }, [show]);


  const handleAdd = async () => {
    if (isIOS()) {
      setShow(false);
      setShowIOSModal(true);
      return;
    }
    const accepted = await triggerInstallPrompt();
    if (accepted) {
      setShow(false);
      sessionStorage.setItem(STORAGE_KEY, "1");
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem(STORAGE_KEY, "1");
  };

  if (!show && !showIOSModal) return null;

  return (
    <>
      {show && shouldShowInstallPrompt() && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-50 px-4 pb-4"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))" }}
          >
            <div
              className="mx-auto max-w-lg rounded-2xl overflow-hidden shadow-xl border border-white/10 dark:border-white/5"
              style={{
                background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.24), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(22,163,74,0.15))",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                    }}
                  >
                    <Download size={22} className="text-emerald-400" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-[15px] font-semibold text-white tracking-tight">
                      Add to Home Screen
                    </h3>
                    <p className="text-[13px] text-white/75 mt-0.5 leading-snug">
                      {isIOS()
                        ? "Tap Share → Add to Home Screen for quick access"
                        : "Install for a faster, app-like experience"}
                    </p>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Dismiss"
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  className="w-full mt-3 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-[15px] text-white transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
                    boxShadow: "0 2px 12px rgba(34,197,94,0.35)",
                  }}
                >
                  <Download size={18} strokeWidth={2.5} />
                  {isIOS() ? "Show me how" : "Add to Home Screen"}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <AnimatePresence>
        {showIOSModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-5"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setShowIOSModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl p-6 max-w-sm w-full"
              style={{ background: "white" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "#ECFDF5" }}
                >
                  <Share size={24} color="#22C55E" />
                </div>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#1A1A2E" }}>
                    Add to Home Screen
                  </h3>
                  <p style={{ fontSize: "13px", color: "#6B7280" }}>Follow these steps:</p>
                </div>
              </div>
              <ol className="space-y-3 mb-6" style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>
                <li className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#22C55E", color: "white", fontWeight: 700, fontSize: "12px" }}>1</span>
                  <span>Tap the <strong>Share</strong> button in Safari (square with arrow)</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#22C55E", color: "white", fontWeight: 700, fontSize: "12px" }}>2</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#22C55E", color: "white", fontWeight: 700, fontSize: "12px" }}>3</span>
                  <span>Tap <strong>Add</strong> in the top right</span>
                </li>
              </ol>
              <button
                onClick={() => {
                  setShowIOSModal(false);
                  sessionStorage.setItem(STORAGE_KEY, "1");
                }}
                className="w-full py-3 rounded-xl"
                style={{ background: "#22C55E", color: "white", fontSize: "15px", fontWeight: 700 }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
