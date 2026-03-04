import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./app/App.tsx";
import { InstallPrompt } from "./app/components/InstallPrompt";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import "./styles/index.css";
import { setDeferredPrompt } from "./lib/installPrompt";

// Warm up the API immediately so cold start happens while user sees the loading spinner
fetch("/api/health").catch(() => {});

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setDeferredPrompt(e as Parameters<typeof setDeferredPrompt>[0]);
  window.dispatchEvent(new CustomEvent("splitsprint-installable"));
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <InstallPrompt />
    <App />
    <Analytics />
  </ErrorBoundary>
);
  