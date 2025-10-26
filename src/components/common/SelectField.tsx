// src/components/common/SelectField.tsx
import React from "react";

interface Option<T> {
  label: string;
  value: T;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value?: T;             // <-- allow undefined
  options: Option<T>[];
  onChange: (val: T) => void;
  disabled?: boolean;
}

export default function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SelectFieldProps<T>) {
  return (
    <div className="mb-4 w-full">
      <label className="block text-sm font-medium mb-1 text-gray-700">
        {label}
      </label>
      <select
        value={value ?? ""}          // <-- fallback to empty string if undefined
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
        className={`w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"
        }`}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}


