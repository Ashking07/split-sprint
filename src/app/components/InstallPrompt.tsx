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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 pb-2 safe-area-inset-top"
        style={{
          background: "linear-gradient(180deg, #1A1A2E 0%, rgba(26,26,46,0.95) 100%)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(34,197,94,0.2)" }}
          >
            <Download size={24} color="#22C55E" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 style={{ fontSize: "15px", fontWeight: 800, color: "white" }}>
              Add SplitSprint to Home Screen
            </h3>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginTop: "2px" }}>
              {isIOS()
                ? "Tap Share, then 'Add to Home Screen' for quick access"
                : "Install for a faster, app-like experience"}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.1)" }}
            aria-label="Dismiss"
          >
            <X size={16} color="white" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleAdd}
            className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #22C55E, #16A34A)",
              color: "white",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            <Download size={18} />
            {isIOS() ? "Show me how" : "Add to Home Screen"}
          </button>
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
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#22C55E", color: "white", fontWeight: 700, fontSize: "12px" }}>1</span>
                  Tap the <strong>Share</strong> button in Safari (square with arrow)
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#22C55E", color: "white", fontWeight: 700, fontSize: "12px" }}>2</span>
                  Scroll down and tap <strong>Add to Home Screen</strong>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#22C55E", color: "white", fontWeight: 700, fontSize: "12px" }}>3</span>
                  Tap <strong>Add</strong> in the top right
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
