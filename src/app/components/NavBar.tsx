import React from "react";
import { ChevronLeft } from "lucide-react";
import { hapticLight } from "@/lib/haptic";

interface NavBarProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
}

/**
 * iOS-style navigation bar with large back button and title.
 * Touch target for back is at least 44pt for accessibility.
 */
export function NavBar({ title, subtitle, onBack, rightAction }: NavBarProps) {
  return (
    <div className="flex items-center gap-3 flex-shrink-0 px-5 py-3">
      <button
        onClick={() => {
          hapticLight();
          onBack();
        }}
        className="flex items-center gap-1 min-h-[44px] min-w-[44px] -ml-2 pl-2 pr-1 rounded-xl active:opacity-70 transition-opacity"
        style={{ color: "#007AFF" }}
        aria-label="Back"
      >
        <ChevronLeft size={24} strokeWidth={2.5} />
      </button>
      <div className="flex-1 min-w-0">
        <h2
          className="font-semibold truncate"
          style={{ fontSize: "17px", color: "#1A1A2E", lineHeight: 1.2 }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="truncate"
            style={{ fontSize: "12px", color: "#6B7280", marginTop: "1px" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightAction && <div className="flex-shrink-0">{rightAction}</div>}
    </div>
  );
}
