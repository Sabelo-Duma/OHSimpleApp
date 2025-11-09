import React from "react";

export default function ProgressBar({
  step,
  totalSteps,
  steps,
}: {
  step: number;
  totalSteps: number;
  steps?: string[];
}) {
  const percent = (step / totalSteps) * 100;
  const currentStepName = steps && steps[step - 1];

  return (
    <div className="mb-6">
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Desktop: Show all step labels */}
      <div className="hidden md:flex justify-between mt-2 text-xs text-gray-600">
        {steps
          ? steps.map((label, i) => (
              <span
                key={label}
                className={i + 1 === step ? "font-bold text-blue-600" : ""}
              >
                {label}
              </span>
            ))
          : Array.from({ length: totalSteps }).map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
      </div>

      {/* Mobile: Show only current step name */}
      <div className="md:hidden mt-2 text-center">
        <span className="text-xs text-gray-600">
          Step {step} of {totalSteps}
          {currentStepName && <span className="font-bold text-blue-600"> · {currentStepName}</span>}
        </span>
      </div>
    </div>
  );
}
