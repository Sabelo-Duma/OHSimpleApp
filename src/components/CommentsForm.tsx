// src/components/CommentsForm.tsx
import React, { useEffect, useState, useRef } from "react";
import Section from "./common/Section";
import Field from "./common/Field";
import Button from "./common/Button";
import { SurveyData, AreaPath } from "./types";

interface CommentsFormProps {
  data: SurveyData;
  onChange?: (patch: Partial<SurveyData>) => void;
  onPrev: () => void;
  onFinishArea: (path: AreaPath, fullAreaData: Partial<SurveyData>) => void;
  currentStep: number;
  totalSteps: number;
  currentAreaPath: AreaPath;
  onSave?: () => void;
  readOnly?: boolean;
}

export default function CommentsForm({
  data,
  onChange,
  onPrev,
  onFinishArea,
  currentStep,
  totalSteps,
  currentAreaPath,
  onSave,
  readOnly = false
}: CommentsFormProps) {
  const [comments, setComments] = useState("");
  const prevAreaRef = useRef<string>("");

  const getAreaKey = () => JSON.stringify(currentAreaPath);

  const getAreaName = () => {
    const mainArea = data.areas[currentAreaPath.main];
    if (!mainArea) return "Unknown Area";

    if (currentAreaPath.ss !== undefined && mainArea.subAreas) {
      const subArea = mainArea.subAreas[currentAreaPath.sub!];
      const subSubArea = subArea?.subAreas?.[currentAreaPath.ss];
      if (subSubArea) return `Sub Sub Area: ${subSubArea.name}`;
      if (subArea) return `Sub Area: ${subArea.name}`;
    }

    if (currentAreaPath.sub !== undefined && mainArea.subAreas) {
      const subArea = mainArea.subAreas[currentAreaPath.sub];
      if (subArea) return `Sub Area: ${subArea.name}`;
    }

    return `Main Area: ${mainArea.name}`;
  };

  const areaKey = getAreaKey();

  // --- Load comments on area change ---
  useEffect(() => {
    if (prevAreaRef.current === areaKey) return;
    prevAreaRef.current = areaKey;

    setComments(data.commentsByArea?.[areaKey] || "");
  }, [areaKey, data.commentsByArea]);

  // ✅ ADDED: Cleanup effect to remove comments for deleted areas
  useEffect(() => {
    if (!data.commentsByArea || readOnly) return;

    const updatedComments = { ...data.commentsByArea };
    let hasChanges = false;

    // Check each stored comment key
    Object.keys(updatedComments).forEach((key) => {
      try {
        const path = JSON.parse(key);
        
        // Verify this path points to a real area
        const mainArea = data.areas[path.main];
        if (!mainArea) {
          delete updatedComments[key];
          hasChanges = true;
          return;
        }

        if (path.sub !== undefined) {
          const subArea = mainArea.subAreas?.[path.sub];
          if (!subArea) {
            delete updatedComments[key];
            hasChanges = true;
            return;
          }

          if (path.ss !== undefined) {
            const subSubArea = subArea.subAreas?.[path.ss];
            if (!subSubArea) {
              delete updatedComments[key];
              hasChanges = true;
            }
          }
        }
      } catch (error) {
        // If key is not valid JSON, remove it
        delete updatedComments[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onChange?.({
        commentsByArea: updatedComments,
      });
      onSave?.();
    }
  }, [data.areas, data.commentsByArea, onChange, onSave, readOnly]);

  // --- Auto-save comments ---
  useEffect(() => {
    if (readOnly) return; // Don't auto-save in read-only mode
    
    const updatedCommentsByArea = {
      ...(data.commentsByArea || {}),
      [areaKey]: comments,
    };
    onChange?.({ commentsByArea: updatedCommentsByArea });
    onSave?.();
  }, [comments, areaKey, readOnly]);

  const handleFinishArea = () => {
    if (readOnly) {
      // In read-only mode, just go back without saving
      onFinishArea(currentAreaPath, data);
      return;
    }

    const areaData: Partial<SurveyData> = {
      ...data,
      commentsByArea: {
        ...(data.commentsByArea || {}),
        [areaKey]: comments,
      },
    };
    onFinishArea(currentAreaPath, areaData);
  };

  // Handle comment changes only if not in read-only mode
  const handleCommentChange = (value: string) => {
    if (!readOnly) {
      setComments(value);
    }
  };

  return (
    <Section title="Comments">
      <p className="text-sm text-gray-500 mb-4">{getAreaName()}</p>

      <Field
        label="Comments for this area"
        value={comments}
        onChange={handleCommentChange}
        placeholder={readOnly ? "No comments" : "Add any observations or notes"}
        multiline={true}
        readOnly={readOnly}
      />

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
        {!readOnly && (
          <Button variant="success" onClick={handleFinishArea}>
            Finish Area
          </Button>
        )}
        {readOnly && (
          <Button variant="secondary" onClick={handleFinishArea}>
            Back to Survey
          </Button>
        )}
      </div>
    </Section>
  );
}