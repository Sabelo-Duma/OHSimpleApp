// src/components/ExposuresForm.tsx
import React, { useEffect, useState, useRef } from "react";
import SelectField from "./common/SelectField";
import Field from "./common/Field";
import Button from "./common/Button";
import Section from "./common/Section";
import { SurveyData, AreaPath } from "./types";

interface ExposuresFormProps {
  data: SurveyData;
  onChange?: (patch: Partial<SurveyData>) => void;
  onSave?: () => void;
  onPrev: () => void;
  onNext: () => void;
  selectedAreaPath?: AreaPath | null;
  readOnly?: boolean;
}

export default function ExposuresForm({
  data,
  selectedAreaPath,
  onChange,
  onSave,
  onPrev,
  onNext,
  readOnly = false
}: ExposuresFormProps) {
  const [exposures, setExposures] = useState({
    exposure: "",
    exposureDetail: "",
    prohibited: "",
    prohibitedDetail: "",
  });

  const prevAreaRef = useRef<string>("");

  // ✅ Use JSON.stringify like other forms
  const getAreaKey = () => {
    if (!selectedAreaPath) return "";
    return JSON.stringify(selectedAreaPath);
  };

  const getAreaName = () => {
    if (!selectedAreaPath) return "No area selected";
    const mainArea = data.areas[selectedAreaPath.main];
    if (!mainArea) return "Unknown Area";

    if (selectedAreaPath.ss !== undefined && mainArea.subAreas) {
      const subArea = mainArea.subAreas[selectedAreaPath.sub!];
      const subSubArea = subArea?.subAreas?.[selectedAreaPath.ss];
      if (subSubArea) return `Sub Sub Area: ${subSubArea.name}`;
      if (subArea) return `Sub Area: ${subArea.name}`;
    }

    if (selectedAreaPath.sub !== undefined && mainArea.subAreas) {
      const subArea = mainArea.subAreas[selectedAreaPath.sub];
      if (subArea) return `Sub Area: ${subArea.name}`;
    }

    return `Main Area: ${mainArea.name}`;
  };

  // --- Load/reset exposures on area change ---
  useEffect(() => {
    const key = getAreaKey();
    if (!key || prevAreaRef.current === key) return;
    prevAreaRef.current = key;

    const stored = data.exposuresByArea?.[key] || {
      exposure: "",
      exposureDetail: "",
      prohibited: "",
      prohibitedDetail: "",
    };

    setExposures(stored);
  }, [selectedAreaPath, data.exposuresByArea]);

  // ✅ FIXED: Cleanup effect using path-based keys
  useEffect(() => {
    if (!data.exposuresByArea || readOnly) return;

    const updatedExposures = { ...data.exposuresByArea };
    let hasChanges = false;

    // Check each stored exposure key
    Object.keys(updatedExposures).forEach((key) => {
      try {
        const path = JSON.parse(key);
        
        // Verify this path points to a real area
        const mainArea = data.areas[path.main];
        if (!mainArea) {
          delete updatedExposures[key];
          hasChanges = true;
          return;
        }

        if (path.sub !== undefined) {
          const subArea = mainArea.subAreas?.[path.sub];
          if (!subArea) {
            delete updatedExposures[key];
            hasChanges = true;
            return;
          }

          if (path.ss !== undefined) {
            const subSubArea = subArea.subAreas?.[path.ss];
            if (!subSubArea) {
              delete updatedExposures[key];
              hasChanges = true;
            }
          }
        }
      } catch (error) {
        // If key is not valid JSON, remove it
        delete updatedExposures[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onChange?.({
        exposuresByArea: updatedExposures,
      });
      onSave?.();
    }
  }, [data.areas, data.exposuresByArea, onChange, onSave, readOnly]);

  // --- Auto-save exposures ---
  useEffect(() => {
    if (readOnly) return; // Don't auto-save in read-only mode
    
    const key = getAreaKey();
    if (!key) return;

    onChange?.({
      exposuresByArea: {
        ...(data.exposuresByArea || {}),
        [key]: exposures,
      },
    });
    onSave?.();
  }, [exposures, selectedAreaPath, readOnly]);

  // Handle exposure changes only if not in read-only mode
  const handleExposureChange = (val: string) => {
    if (!readOnly) {
      setExposures({ ...exposures, exposure: val });
    }
  };

  const handleExposureDetailChange = (val: string) => {
    if (!readOnly) {
      setExposures({ ...exposures, exposureDetail: val });
    }
  };

  const handleProhibitedChange = (val: string) => {
    if (!readOnly) {
      setExposures({ ...exposures, prohibited: val });
    }
  };

  const handleProhibitedDetailChange = (val: string) => {
    if (!readOnly) {
      setExposures({ ...exposures, prohibitedDetail: val });
    }
  };

  const isNextDisabled = readOnly ? false : (
    !exposures.exposure ||
    !exposures.prohibited ||
    (exposures.exposure === "Yes" && !exposures.exposureDetail.trim()) ||
    (exposures.prohibited === "Yes" && !exposures.prohibitedDetail.trim())
  );

  return (
    <Section title="Concomitant Exposures & Prohibited Actions">
      {selectedAreaPath && <p className="text-sm text-gray-500 mb-4">{getAreaName()}</p>}

      <div className="font-semibold text-gray-800 mb-2">Concomitant Exposures</div>
      <SelectField<"Yes" | "No">
        label="Choose"
        value={exposures.exposure as "Yes" | "No"}
        options={[
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" },
        ]}
        onChange={handleExposureChange}
        disabled={readOnly}
      />
      <Field
        label="If Yes, please elaborate"
        value={exposures.exposureDetail}
        onChange={handleExposureDetailChange}
        disabled={exposures.exposure !== "Yes" || readOnly}
        placeholder="Describe exposure details"
        readOnly={readOnly}
      />

      <div className="font-semibold text-gray-800 mt-4 mb-2">Prohibited Activities</div>
      <SelectField<"Yes" | "No">
        label="Choose"
        value={exposures.prohibited as "Yes" | "No"}
        options={[
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" },
        ]}
        onChange={handleProhibitedChange}
        disabled={readOnly}
      />
      <Field
        label="If Yes, please elaborate"
        value={exposures.prohibitedDetail}
        onChange={handleProhibitedDetailChange}
        disabled={exposures.prohibited !== "Yes" || readOnly}
        placeholder="Describe prohibited actions"
        readOnly={readOnly}
      />

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
        {!readOnly && (
          <Button variant="success" onClick={onNext} disabled={isNextDisabled}>
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