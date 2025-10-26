// src/components/common/Field.tsx
import React from "react";

interface FieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  type?: string;
  disabled?: boolean;
  multiline?: boolean;
  readOnly?: boolean;
}

export default function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  multiline = false,
  readOnly = false,
}: FieldProps) {
  const isDisabled = disabled || readOnly;
  
  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
      onChange(e.target.value),
    placeholder,
    disabled: isDisabled,
    className: `w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
      isDisabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white"
    }`
  };

  return (
    <div className="mb-4 w-full">
      <label className="block text-sm font-medium mb-1 text-gray-700">
        {label}
      </label>
      {multiline ? (
        <textarea {...commonProps} rows={4} />
      ) : (
        <input type={type} {...commonProps} />
      )}
    </div>
  );
}
