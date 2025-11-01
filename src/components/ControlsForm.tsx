// src/components/ControlsForm.tsx
import React, { useState, useEffect, useRef } from "react";
import Field from "./common/Field";
import Button from "./common/Button";
import Section from "./common/Section";
import { SurveyData, AreaPath } from "./types";

interface ControlsFormProps {
  data: SurveyData;
  selectedAreaPath?: AreaPath | null;
  onNext: () => void;
  onPrev: () => void;
  onChange: (patch: Partial<SurveyData>) => void;
  onSave: () => void;
  readOnly?: boolean;
}

const ADMIN_OPTIONS = [
  "Training",
  "Written Procedures",
  "Reduced Exposure Time",
  "Medical Surveillance",
  "Rotational Procedures",
  "Demarcation & Signage",
];

export default function ControlsForm({
  data,
  selectedAreaPath,
  onNext,
  onPrev,
  onChange,
  onSave,
  readOnly = false
}: ControlsFormProps) {
  const [engineering, setEngineering] = useState("");
  const [adminControls, setAdminControls] = useState<string[]>([]);
  const [customAdmin, setCustomAdmin] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevAreaRef = useRef<string>("");

  // ---------------------
  // Helpers
  // ---------------------

  const getAreaKey = (): string => {
    if (!selectedAreaPath) return "";
    return JSON.stringify(selectedAreaPath);
  };

  const getAreaName = (): string => {
    if (!selectedAreaPath) return "No area selected";
    const main = data.areas[selectedAreaPath.main];
    if (!main) return "Unknown Area";

    const sub = selectedAreaPath.sub !== undefined ? main.subAreas?.[selectedAreaPath.sub] : undefined;
    const ss = selectedAreaPath.ss !== undefined ? sub?.subAreas?.[selectedAreaPath.ss] : undefined;

    if (ss) return `Sub Sub Area: ${ss.name}`;
    if (sub) return `Sub Area: ${sub.name}`;
    return `Main Area: ${main.name}`;
  };

  const areaKey = getAreaKey();
  if (!areaKey) return null;

  // ---------------------
  // Load data when area changes
  // ---------------------
  useEffect(() => {
    if (!areaKey || prevAreaRef.current === areaKey) return;
    prevAreaRef.current = areaKey;

    const stored = data.controlsByArea?.[areaKey];
    setEngineering(stored?.engineering || "");
    setAdminControls(stored?.adminControls || []);
    setCustomAdmin(stored?.customAdmin || "");
    setDropdownOpen(false);
  }, [areaKey]);

  // ---------------------
  // Auto-save on field change
  // ---------------------
  useEffect(() => {
    if (readOnly) return; // Don't auto-save in read-only mode
    
    if (!areaKey) return;
    onChange({
      controlsByArea: {
        ...(data.controlsByArea || {}),
        [areaKey]: { engineering, adminControls, customAdmin },
      },
    });
    onSave();
  }, [engineering, adminControls, customAdmin, readOnly]);

  // ---------------------
  // Clear deleted areas - SIMPLIFIED VERSION
  // ---------------------
  useEffect(() => {
    if (!data.controlsByArea || readOnly) return;

    const updatedControls = { ...data.controlsByArea };
    let hasChanges = false;

    // Check each stored control key
    Object.keys(updatedControls).forEach((key) => {
      try {
        const path = JSON.parse(key);
        
        // Verify this path points to a real area
        const mainArea = data.areas[path.main];
        if (!mainArea) {
          delete updatedControls[key];
          hasChanges = true;
          return;
        }

        if (path.sub !== undefined) {
          const subArea = mainArea.subAreas?.[path.sub];
          if (!subArea) {
            delete updatedControls[key];
            hasChanges = true;
            return;
          }

          if (path.ss !== undefined) {
            const subSubArea = subArea.subAreas?.[path.ss];
            if (!subSubArea) {
              delete updatedControls[key];
              hasChanges = true;
            }
          }
        }
      } catch (error) {
        // If key is not valid JSON, remove it
        delete updatedControls[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onChange({ controlsByArea: updatedControls });
      onSave();
    }
  }, [data.areas, data.controlsByArea, onChange, onSave, readOnly]);

  // ---------------------
  // Close dropdown on outside click
  // ---------------------
  useEffect(() => {
    if (readOnly) return; // Don't set up dropdown listeners in read-only mode
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [readOnly]);

  // Handler functions that only work when not in read-only mode
  const handleEngineeringChange = (value: string) => {
    if (!readOnly) {
      setEngineering(value);
    }
  };

  const handleCustomAdminChange = (value: string) => {
    if (!readOnly) {
      setCustomAdmin(value);
    }
  };

  const toggleOption = (option: string) => {
    if (!readOnly) {
      setAdminControls((prev) =>
        prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
      );
    }
  };

  const handleDropdownToggle = () => {
    if (!readOnly) {
      setDropdownOpen(!dropdownOpen);
    }
  };

  const isNextDisabled = readOnly ? false : (
    !engineering.trim() || (adminControls.length === 0 && !customAdmin.trim())
  );

  // ---------------------
  // Render
  // ---------------------
  return (
    <Section title="Controls">
      {selectedAreaPath && (
        <p className="text-sm text-gray-500 mb-4">{getAreaName()}</p>
      )}

      <Field
        label="Engineering Controls"
        value={engineering}
        onChange={handleEngineeringChange}
        placeholder="e.g., Isolation, Insulation, Attenuation"
        readOnly={readOnly}
      />

      <div className="mb-4 relative" ref={dropdownRef}>
        <label className="block font-semibold mb-1">Administrative Controls</label>
        <button
          type="button"
          className={`w-full border rounded px-3 py-2 text-left bg-white ${
            readOnly ? "cursor-not-allowed opacity-50" : ""
          }`}
          onClick={handleDropdownToggle}
          disabled={readOnly}
        >
          {adminControls.length
            ? adminControls.join(", ")
            : readOnly ? "No administrative controls selected" : "Select administrative controls"}
        </button>
        {dropdownOpen && !readOnly && (
          <div className="absolute z-10 bg-white border rounded mt-1 w-full max-h-60 overflow-y-auto shadow">
            {ADMIN_OPTIONS.map((opt) => (
              <label
                key={opt}
                className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={adminControls.includes(opt)}
                  onChange={() => toggleOption(opt)}
                  className="mr-2"
                />
                {opt}
              </label>
            ))}
          </div>
        )}
      </div>

      <Field
        label="Custom Admin Control"
        value={customAdmin}
        onChange={handleCustomAdminChange}
        placeholder={readOnly ? "No custom admin control" : "Please enter your option here..."}
        readOnly={readOnly}
      />

      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
        {!readOnly && (
          <Button
            variant="success"
            onClick={() => {
              onSave();
              onNext();
            }}
            disabled={isNextDisabled}
          >
            Next
          </Button>
        )}
        {readOnly && (
          <Button variant="secondary" onClick={onNext}>
            Next
          </Button>
        )}
      </div>
    </Section>
  );
}