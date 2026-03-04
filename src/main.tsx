import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { InstallPrompt } from "./app/components/InstallPrompt";
import "./styles/index.css";
import { setDeferredPrompt } from "./lib/installPrompt";

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setDeferredPrompt(e as Parameters<typeof setDeferredPrompt>[0]);
  window.dispatchEvent(new CustomEvent("splitsprint-installable"));
});

createRoot(document.getElementById("root")!).render(
  <>
    <InstallPrompt />
    <App />
  </>
);
  