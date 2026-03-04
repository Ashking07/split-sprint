import React from "react";

const STEPS = ["Import", "Review", "Split", "Send"];

interface ProgressStepperProps {
  currentStep: number; // 0-indexed
}

export function ProgressStepper({ currentStep }: ProgressStepperProps) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-3">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
              style={{
                background: i < currentStep
                  ? "#22C55E"
                  : i === currentStep
                  ? "#22C55E"
                  : "#E5E7EB",
                color: i <= currentStep ? "white" : "#9CA3AF",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {i < currentStep ? (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                  <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: i === currentStep ? 700 : 500,
                color: i <= currentStep ? "#22C55E" : "#9CA3AF",
                marginTop: "3px",
              }}
            >
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="h-0.5 transition-all duration-500 mb-4"
              style={{
                width: "40px",
                background: i < currentStep ? "#22C55E" : "#E5E7EB",
                marginTop: "-4px",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}