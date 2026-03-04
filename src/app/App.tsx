import React, { useEffect } from "react";
import { MobileFrame } from "./components/MobileFrame";
import { Home } from "./screens/Home";
import { Login } from "./screens/Login";
import { Signup } from "./screens/Signup";
import { ImportReceipt } from "./screens/ImportReceipt";
import { PasteReceipt } from "./screens/PasteReceipt";
import { CameraCapture } from "./screens/CameraCapture";
import { ReceiptReview } from "./screens/ReceiptReview";
import { ChooseGroup } from "./screens/ChooseGroup";
import { SplitSetup } from "./screens/SplitSetup";
import { Confirmation } from "./screens/Confirmation";
import { Success } from "./screens/Success";
import { History } from "./screens/History";
import { Integrations } from "./screens/Integrations";
import { OAuthSplitwiseLanding } from "./screens/OAuthSplitwiseLanding";
import type { Screen } from "./types";
import { useBillStore } from "../store/billStore";
import { useAuthStore } from "../store/authStore";
import { AnimatePresence, motion } from "motion/react";

export default function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/oauth/splitwise") {
    return <OAuthSplitwiseLanding />;
  }
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

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
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
  }, [navigate]);

  const fetchHistory = useBillStore((s) => s.fetchHistory);

  useEffect(() => {
    if (user && (screen === "login" || screen === "signup")) {
      navigate("home");
    }
  }, [user, screen, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("splitwise") === "error") {
      const msg = params.get("message") || "Connection failed";
      window.history.replaceState({}, "", "/");
      navigate("integrations");
      setTimeout(() => alert(decodeURIComponent(msg)), 100);
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, fetchHistory]);

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
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </MobileFrame>
  );
}
