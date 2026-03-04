import React, { useEffect, useRef } from "react";
import { MobileFrame } from "../components/MobileFrame";
import { useAuthStore } from "../../store/authStore";
import { apiSplitwiseStatus } from "../../lib/api";
import { prefetchGroups } from "../../lib/groupsCache";
import type { Screen } from "../types";

const VALID_RETURN_TO: Screen[] = [
  "home",
  "import",
  "camera",
  "paste",
  "review",
  "group",
  "split",
  "confirm",
  "integrations",
];

export function OAuthSplitwiseLanding() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const isChecked = useAuthStore((s) => s.isChecked);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const hasRun = useRef(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!hasHydrated || !isChecked || hasRun.current) return;

    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo") || "integrations";
    const screen: Screen = VALID_RETURN_TO.includes(returnTo as Screen) ? (returnTo as Screen) : "integrations";

    const run = async () => {
      hasRun.current = true;

      const token = typeof localStorage !== "undefined" ? localStorage.getItem("splitsprint-token") : null;
      if (!token) {
        window.location.replace("/");
        return;
      }

      try {
        let st = await apiSplitwiseStatus();
        if (!st.connected) {
          await new Promise((r) => setTimeout(r, 500));
          st = await apiSplitwiseStatus();
        }
        if (st.connected) {
          prefetchGroups(); // Prefetch groups + Splitwise now that user just connected
          window.location.replace(`/?screen=${encodeURIComponent(screen)}`);
          return;
        }
        window.location.replace("/?screen=integrations&splitwise_error=not_detected");
      } catch {
        window.location.replace("/?screen=integrations&splitwise_error=verify_failed");
      }
    };

    run();
  }, [hasHydrated, isChecked]);

  return (
    <MobileFrame>
      <div className="flex flex-col h-full items-center justify-center px-6">
        <div className="w-10 h-10 rounded-full border-4 border-[#22C55E] border-t-transparent animate-spin mb-4" />
        <p style={{ fontSize: "14px", color: "#6B7280" }}>Completing Splitwise connection...</p>
      </div>
    </MobileFrame>
  );
}
