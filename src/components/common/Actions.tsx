// src/components/common/Actions.tsx
import React from "react";

export default function Actions({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex justify-between items-center ${className}`}>
      {children}
    </div>
  );
}
