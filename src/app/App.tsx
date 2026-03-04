import React, { useEffect, lazy, Suspense } from "react";
import { MobileFrame } from "./components/MobileFrame";
import { Home } from "./screens/Home";
import { Login } from "./screens/Login";
import { Signup } from "./screens/Signup";
import { OAuthSplitwiseLanding } from "./screens/OAuthSplitwiseLanding";
import type { Screen } from "./types";

const ImportReceipt = lazy(() => import("./screens/ImportReceipt").then((m) => ({ default: m.ImportReceipt })));
const PasteReceipt = lazy(() => import("./screens/PasteReceipt").then((m) => ({ default: m.PasteReceipt })));
const CameraCapture = lazy(() => import("./screens/CameraCapture").then((m) => ({ default: m.CameraCapture })));
const ReceiptReview = lazy(() => import("./screens/ReceiptReview").then((m) => ({ default: m.ReceiptReview })));
import { ChooseGroup } from "./screens/ChooseGroup";
const SplitSetup = lazy(() => import("./screens/SplitSetup").then((m) => ({ default: m.SplitSetup })));
const Confirmation = lazy(() => import("./screens/Confirmation").then((m) => ({ default: m.Confirmation })));
const Success = lazy(() => import("./screens/Success").then((m) => ({ default: m.Success })));
const History = lazy(() => import("./screens/History").then((m) => ({ default: m.History })));
const Integrations = lazy(() => import("./screens/Integrations").then((m) => ({ default: m.Integrations })));

import type { Screen } from "./types";
import { useBillStore } from "../store/billStore";
import { useAuthStore } from "../store/authStore";
import { useStoresHydrated } from "../lib/useStoresHydrated";
import { AnimatePresence, motion } from "motion/react";

function LoadingSpinner() {
  return (
    <MobileFrame>
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-4 border-[#22C55E] border-t-transparent animate-spin" />
      </div>
    </MobileFrame>
  );
}

export default function App() {
  const hydrated = useStoresHydrated();
  const user = useAuthStore((s) => s.user);
  const isChecked = useAuthStore((s) => s.isChecked);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  const {
    screen,
    navigate,
    updateState,
    items,
    tax,
    tip,
    tipPreset,
    customTip,
    selectedGroup,
    selectedPeople,
    splitMode,
    xp,
    streak,
  } = useBillStore();

  const fetchHistory = useBillStore((s) => s.fetchHistory);

  useEffect(() => {
    if (!hydrated) return;
    checkAuth();
  }, [hydrated, checkAuth]);

  useEffect(() => {
    if (!hydrated || !user) return;
    if (screen === "home" || screen === "import" || screen === "camera" || screen === "paste" || screen === "review") {
      import("../lib/groupsCache").then((m) => m.prefetchGroups());
    }
    if (screen === "group") import("./screens/SplitSetup");
    if (screen === "split") import("./screens/Confirmation");
    if (screen === "confirm") import("./screens/Success");
  }, [hydrated, screen, user]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("splitwise_error");
    if (err === "not_detected" || err === "verify_failed") {
      window.history.replaceState({}, "", "/");
      navigate("integrations");
      setTimeout(
        () =>
          alert(
            err === "not_detected"
              ? "Splitwise connection not detected. Please try connecting again."
              : "Could not verify Splitwise connection. Please try again."
          ),
        100
      );
      return;
    }
    const screenParam = params.get("screen");
    const validScreens = ["home", "import", "camera", "paste", "review", "group", "split", "confirm", "integrations"];
    if (screenParam && validScreens.includes(screenParam)) {
      navigate(screenParam as Screen);
      window.history.replaceState({}, "", "/");
    }
  }, [hydrated, navigate]);

  useEffect(() => {
    if (!hydrated) return;
    if (user && (screen === "login" || screen === "signup")) {
      navigate("home");
    }
  }, [hydrated, user, screen, navigate]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("splitwise") === "error") {
      const msg = params.get("message") || "Connection failed";
      window.history.replaceState({}, "", "/");
      navigate("integrations");
      setTimeout(() => alert(decodeURIComponent(msg)), 100);
    }
  }, [hydrated, navigate]);

  useEffect(() => {
    if (!hydrated || !user) return;
    fetchHistory();
  }, [hydrated, user, fetchHistory]);

  const state = {
    screen,
    items,
    tax,
    tip,
    tipPreset,
    customTip,
    selectedGroup,
    selectedPeople,
    splitMode,
    xp,
    streak,
  };

  if (!hydrated) return <LoadingSpinner />;

  if (typeof window !== "undefined" && window.location.pathname === "/oauth/splitwise") {
    return <OAuthSplitwiseLanding />;
  }

  if (!isChecked) {
    return (
      <MobileFrame>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 rounded-full border-4 border-[#22C55E] border-t-transparent animate-spin" />
        </div>
      </MobileFrame>
    );
  }

  if (!user) {
    return (
      <MobileFrame>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex flex-col h-full"
          >
            {screen === "signup" ? (
              <Signup onLogin={() => navigate("login")} />
            ) : (
              <Login onSignup={() => navigate("signup")} />
            )}
          </motion.div>
        </AnimatePresence>
      </MobileFrame>
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case "home":
        return <Home state={state} navigate={navigate} />;
      case "import":
        return <ImportReceipt navigate={navigate} />;
      case "paste":
        return <PasteReceipt navigate={navigate} />;
      case "camera":
        return <CameraCapture navigate={navigate} />;
      case "review":
        return (
          <ReceiptReview state={state} setState={updateState} navigate={navigate} />
        );
      case "group":
        return (
          <ChooseGroup state={state} setState={updateState} navigate={navigate} />
        );
      case "split":
        return (
          <SplitSetup state={state} setState={updateState} navigate={navigate} />
        );
      case "confirm":
        return (
          <Confirmation state={state} setState={updateState} navigate={navigate} />
        );
      case "success":
        return (
          <Success state={state} setState={updateState} navigate={navigate} />
        );
      case "history":
        return <History navigate={navigate} />;
      case "integrations":
        return <Integrations navigate={navigate} />;
      default:
        return <Home state={state} navigate={navigate} />;
    }
  };

  const screenFallback = (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 rounded-full border-4 border-[#22C55E] border-t-transparent animate-spin" />
    </div>
  );

  return (
    <MobileFrame>
      <Suspense fallback={screenFallback}>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex flex-col h-full"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </MobileFrame>
  );
}
