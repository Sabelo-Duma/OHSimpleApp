// src/components/common/Field.tsx
import React from "react";

interface FieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  multiline?: boolean;
  readOnly?: boolean;
  error?: string;
  warning?: string;
  info?: string;
  required?: boolean;
  success?: boolean;
  onBlur?: () => void;
}

export default function Field({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  disabled = false,
  multiline = false,
  readOnly = false,
  error = "",
  warning = "",
  info = "",
  required = false,
  success = false,
  onBlur,
}: FieldProps) {
  const isDisabled = disabled || readOnly;
  const hasError = !!error;
  const hasWarning = !!warning && !hasError;
  const hasInfo = !!info && !hasError && !hasWarning;
  const showSuccess = success && !hasError && !hasWarning && value;

  // Determine border color based on state
  let borderColor = "border-gray-300";
  if (hasError) borderColor = "border-red-500";
  else if (hasWarning) borderColor = "border-yellow-500";
  else if (showSuccess) borderColor = "border-green-500";

  // Determine background color for disabled state
  let bgColor = isDisabled ? "bg-gray-100" : "bg-white";
  if (hasError && !isDisabled) bgColor = "bg-red-50";
  else if (hasWarning && !isDisabled) bgColor = "bg-yellow-50";

  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onBlur,
    placeholder,
    disabled: isDisabled,
    className: `w-full rounded-lg border ${borderColor} ${bgColor} px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
      isDisabled ? "text-gray-500 cursor-not-allowed" : ""
    }`
  };

  return (
    <div className="mb-4 w-full">
      <label className="block text-sm font-medium mb-1 text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        {multiline ? (
          <textarea {...commonProps} rows={4} />
        ) : (
          <input type={type} {...commonProps} />
        )}

        {/* Success checkmark */}
        {showSuccess && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold">
            ✓
          </span>
        )}

        {/* Error icon */}
        {hasError && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 font-bold">
            ⚠
          </span>
        )}

        {/* Warning icon */}
        {hasWarning && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-600 font-bold">
            ⚠
          </span>
        )}
      </div>

      {/* Error message */}
      {hasError && (
        <p className="text-red-600 text-sm mt-1 flex items-start">
          <span className="mr-1">⚠️</span>
          <span>{error}</span>
        </p>
      )}

      {/* Warning message */}
      {hasWarning && (
        <p className="text-yellow-700 text-sm mt-1 flex items-start">
          <span className="mr-1">⚠️</span>
          <span>{warning}</span>
        </p>
      )}

      {/* Info message */}
      {hasInfo && (
        <p className="text-blue-600 text-sm mt-1 flex items-start">
          <span className="mr-1">ℹ️</span>
          <span>{info}</span>
        </p>
      )}
    </div>
  );
}
