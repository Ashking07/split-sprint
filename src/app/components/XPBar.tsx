import React from "react";
import { getProgress } from "../../lib/xpUtils";

interface XPBarProps {
  xp: number;
}

export function XPBar({ xp }: XPBarProps) {
  const { level, xpInLevel, maxXpForLevel } = getProgress(xp);
  const progress = maxXpForLevel > 0 ? Math.min((xpInLevel / maxXpForLevel) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center rounded-lg"
        style={{
          background: "linear-gradient(135deg, #7C3AED, #A855F7)",
          width: "28px",
          height: "28px",
          fontSize: "11px",
          fontWeight: 800,
          color: "white",
          flexShrink: 0,
        }}
      >
        {level}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-baseline mb-0.5">
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#7C3AED" }}>
            Level {level}
          </span>
          <span style={{ fontSize: "10px", color: "#9CA3AF" }}>
            {xpInLevel} / {maxXpForLevel} XP
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#EDE9FE" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #7C3AED, #A855F7)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
