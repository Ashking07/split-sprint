import React from "react";
import { isStandalone } from "../../lib/standalone";

interface MobileFrameProps {
  children: React.ReactNode;
}

export function MobileFrame({ children }: MobileFrameProps) {
  const standalone = isStandalone();

  if (standalone) {
    return (
      <div
        className="min-h-screen flex flex-col bg-[#F7F6FF] ios-app-shell safe-area-pad"
      >
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{children}</div>
        <p
          className="flex-shrink-0 text-center py-2"
          style={{ fontSize: "10px", color: "#9CA3AF" }}
        >
          © 2025 Ashwin Kapile
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center p-4"
      style={{
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="relative bg-[#F7F6FF] overflow-hidden flex flex-col"
        style={{
          width: "min(390px, 100vw)",
          height: "min(844px, 100vh)",
          borderRadius: "min(44px, 8vw)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between px-6 pt-3 pb-1 flex-shrink-0 z-10"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1A1A2E" }}>9:41</span>
          <div className="flex items-center gap-1.5">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
              <rect x="0" y="6" width="3" height="6" rx="1" fill="#1A1A2E" />
              <rect x="4.5" y="4" width="3" height="8" rx="1" fill="#1A1A2E" />
              <rect x="9" y="2" width="3" height="10" rx="1" fill="#1A1A2E" />
              <rect x="13.5" y="0" width="3" height="12" rx="1" fill="#1A1A2E" />
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M8 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" fill="#1A1A2E" />
              <path d="M3.5 6.5A6.5 6.5 0 0 1 12.5 6.5" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M1 4A9.5 9.5 0 0 1 15 4" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#1A1A2E" strokeOpacity="0.35" />
              <rect x="22" y="3.5" width="2.5" height="5" rx="1.25" fill="#1A1A2E" fillOpacity="0.4" />
              <rect x="2" y="2" width="16" height="8" rx="2" fill="#1A1A2E" />
            </svg>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">{children}</div>

        <div
          className="flex flex-col items-center justify-center py-2 flex-shrink-0"
          style={{
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="w-32 h-1 bg-[#1A1A2E] rounded-full opacity-20 mb-2" />
          <p style={{ fontSize: "10px", color: "#9CA3AF" }}>© 2025 Ashwin Kapile</p>
        </div>
      </div>
    </div>
  );
}
