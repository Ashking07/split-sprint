import React from "react";

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
      style={{
        background: "linear-gradient(135deg, #FFF7ED, #FFEDD5)",
        border: "1.5px solid #FED7AA",
      }}
    >
      <span style={{ fontSize: "16px" }}>🔥</span>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "#EA580C", lineHeight: 1 }}>
          {streak}
        </div>
        <div style={{ fontSize: "9px", color: "#F97316", lineHeight: 1, fontWeight: 600 }}>
          STREAK
        </div>
      </div>
    </div>
  );
}
