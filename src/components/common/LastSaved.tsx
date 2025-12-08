// src/components/common/LastSaved.tsx
import React, { useEffect, useState } from "react";

interface LastSavedProps {
  lastSaved: Date | null;
  isSaving?: boolean;
}

export default function LastSaved({ lastSaved, isSaving = false }: LastSavedProps) {
  const [timeAgo, setTimeAgo] = useState<string>("");

  useEffect(() => {
    if (!lastSaved) return;

    const updateTimeAgo = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastSaved.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);

      if (diffSeconds < 5) {
        setTimeAgo("just now");
      } else if (diffSeconds < 60) {
        setTimeAgo(`${diffSeconds} seconds ago`);
      } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        setTimeAgo(`${minutes} minute${minutes > 1 ? 's' : ''} ago`);
      } else {
        const hours = Math.floor(diffSeconds / 3600);
        setTimeAgo(`${hours} hour${hours > 1 ? 's' : ''} ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [lastSaved]);

  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-600">
        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Saving...</span>
      </div>
    );
  }

  if (!lastSaved) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>💾</span>
        <span>Not saved yet</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-green-600">
      <span>✓</span>
      <span>Last saved: {timeAgo}</span>
    </div>
  );
}
