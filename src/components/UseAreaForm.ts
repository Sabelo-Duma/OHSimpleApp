// src/hooks/useAreaForm.ts
import { useEffect, useState } from "react";
import { SurveyData, AreaPath } from "./types";

interface UseAreaFormProps<T> {
  data: SurveyData;
  selectedAreaPath?: AreaPath | null;
  initialState: T;
  savedStateByArea?: { [key: string]: T };
  onChange?: (patch: Partial<SurveyData>) => void;
  onSave?: () => void;
}

export function useAreaForm<T>({
  data,
  selectedAreaPath,
  initialState,
  savedStateByArea,
  onChange,
  onSave,
}: UseAreaFormProps<T>) {
  const [formInstanceId, setFormInstanceId] = useState(0); // for remount
  const [formState, setFormState] = useState<T>(initialState);

  const areaKey = selectedAreaPath ? JSON.stringify(selectedAreaPath) : "";

  // Reset / load form whenever area changes
  useEffect(() => {
    setFormInstanceId((prev) => prev + 1); // force remount
    if (!areaKey) return;

    const saved = savedStateByArea?.[areaKey] || initialState;
    setFormState(saved);
  }, [areaKey, savedStateByArea]);

  // Auto-save
  useEffect(() => {
    if (!areaKey) return;
    if (!onChange) return;

    onChange({
      ...savedStateByArea,
      [areaKey]: formState,
    } as any);
    onSave?.();
  }, [formState, areaKey]);

  // Get area display name
  const getAreaName = () => {
    if (!selectedAreaPath) return "No area selected";
    const mainArea = data.areas[selectedAreaPath.main];
    if (!mainArea) return "Unknown Area";

    if (selectedAreaPath.sub !== undefined && mainArea.subAreas) {
      const subArea = mainArea.subAreas[selectedAreaPath.sub];
      if (!subArea) return `Main Area: ${mainArea.name}`;
      if (selectedAreaPath.ss !== undefined && subArea.subAreas) {
        const subSubArea = subArea.subAreas[selectedAreaPath.ss];
        if (subSubArea) return `Sub Sub Area: ${subSubArea.name}`;
      }
      return `Sub Area: ${subArea.name}`;
    }

    return `Main Area: ${mainArea.name}`;
  };

  return { formInstanceId, formState, setFormState, areaKey, getAreaName };
}
export {};
