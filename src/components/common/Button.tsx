import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "success" | "danger";
  className?: string; // ✅ allow extra classes
}

export default function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "", // default empty
}: ButtonProps) {
  let styles = "";

  switch (variant) {
    case "primary":
      styles = `px-4 py-2 rounded-lg text-white ${
        disabled ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
      }`;
      break;
    case "secondary":
      styles = `px-3 py-1 text-sm rounded-lg border bg-white hover:bg-gray-100`;
      break;
    case "success":
      styles = `px-4 py-2 rounded-lg text-white ${
        disabled ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
      }`;
      break;
    case "danger":
      styles = `px-4 py-2 rounded-lg text-white ${
        disabled ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
      }`;
      break;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${styles} ${className}`} // ✅ merge extra classes
    >
      {children}
    </button>
  );
}
