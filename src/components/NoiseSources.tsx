// src/components/NoiseSources.tsx
import React, { useState, useEffect } from "react";
import Field from "./common/Field";
import Button from "./common/Button";
import ConfirmDialog from "./common/ConfirmDialog";
import Section from "./common/Section";
import { SurveyData, NoiseEntry } from "./types";
import { getFieldError, isFieldValid } from "../utils/validation";

export interface NoiseSourcesProps {
  data: SurveyData;
  onChange: (patch: Partial<SurveyData>) => void;
  onNext: () => void;
  onSave: () => void;
  onBackToSurvey: () => void;
  selectedAreaPath?: { main: number; sub?: number; ss?: number } | null;
  readOnly?: boolean;
}

export default function NoiseSources({
  data,
  onChange,
  onNext,
  onSave,
  selectedAreaPath,
  onBackToSurvey,
  readOnly = false
}: NoiseSourcesProps) {
  const [noiseDraft, setNoiseDraft] = useState<NoiseEntry>({
    source: "",
    description: "",
    mit: "",
    type: "",
  });

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<() => void>(() => () => {});

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!selectedAreaPath) return null;
  const areaKey = JSON.stringify(selectedAreaPath);

  // Get current noise sources for this area
  const noiseSources = data.noiseSourcesByArea?.[areaKey] || [];

  // Validate noise source draft in real-time
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    // Source validation
    if (!noiseDraft.source.trim()) {
      newErrors.source = "Noise source is required";
    } else if (noiseDraft.source.length < 2) {
      newErrors.source = "Source name must be at least 2 characters";
    }

    // Description validation
    if (!noiseDraft.description.trim()) {
      newErrors.description = "Description is required";
    } else if (noiseDraft.description.length < 5) {
      newErrors.description = "Description must be at least 5 characters";
    }

    // Type validation (only when normal conditions = "Yes")
    if (data.normalConditions === "Yes") {
      if (!noiseDraft.type.trim()) {
        newErrors.type = "Please elaborate on the normal operating conditions";
      } else if (noiseDraft.type.length < 5) {
        newErrors.type = "Please provide more detail (at least 5 characters)";
      }
    }

    // MIT validation
    if (!noiseDraft.mit.trim()) {
      newErrors.mit = "Measurement time interval is required";
    }

    setErrors(newErrors);
  }, [noiseDraft, data.normalConditions]);

  // Handle field blur
  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  };

  // ✅ Reset form when switching to a new area
  useEffect(() => {
    setNoiseDraft({ source: "", description: "", mit: "", type: "" });
    setEditingIndex(null);
    setTouched({});
  }, [selectedAreaPath]);

  // ✅ ADDED: Cleanup effect to remove noise sources for deleted areas
  useEffect(() => {
    if (!data.noiseSourcesByArea || readOnly) return;

    const updatedNoiseSources = { ...data.noiseSourcesByArea };
    let hasChanges = false;

    // Create a set of valid area keys
    const validAreaKeys = new Set<string>();
    
    // Generate all valid area keys from current area structure
    data.areas.forEach((main, mainIdx) => {
      if (!main) return;
      
      // Main area
      validAreaKeys.add(JSON.stringify({ main: mainIdx }));
      
      // Sub areas
      main.subAreas?.forEach((sub, subIdx) => {
        if (!sub) return;
        validAreaKeys.add(JSON.stringify({ main: mainIdx, sub: subIdx }));
        
        // Sub-sub areas
        sub.subAreas?.forEach((ss, ssIdx) => {
          if (!ss) return;
          validAreaKeys.add(JSON.stringify({ main: mainIdx, sub: subIdx, ss: ssIdx }));
        });
      });
    });

    // Remove noise sources for areas that no longer exist
    Object.keys(updatedNoiseSources).forEach((key) => {
      if (!validAreaKeys.has(key)) {
        delete updatedNoiseSources[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onChange({
        noiseSourcesByArea: updatedNoiseSources,
      });
      onSave();
    }
  }, [data.areas, data.noiseSourcesByArea, onChange, onSave, readOnly]);

  const getAreaName = () => {
    const mainArea = data.areas[selectedAreaPath.main];
    if (!mainArea) return "";

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

  // Handler functions that only work when not in read-only mode
  const handleSourceChange = (val: string) => {
    if (!readOnly) {
      setNoiseDraft((prev) => ({ ...prev, source: val }));
    }
  };

  const handleDescriptionChange = (val: string) => {
    if (!readOnly) {
      setNoiseDraft((prev) => ({ ...prev, description: val }));
    }
  };

  const handleTypeChange = (val: string) => {
    if (!readOnly) {
      setNoiseDraft((prev) => ({ ...prev, type: val }));
    }
  };

  const handleMitChange = (val: string) => {
    if (!readOnly) {
      setNoiseDraft((prev) => ({ ...prev, mit: val }));
    }
  };

  const handleNormalConditionsChange = (opt: "Yes" | "No") => {
    if (!readOnly) {
      onChange({ normalConditions: opt });
    }
  };

  const addNoiseSource = () => {
    if (readOnly) return;

    // Mark all fields as touched
    setTouched({
      source: true,
      description: true,
      mit: true,
      type: true,
    });

    // Check for required fields and validation errors
    if (
      !noiseDraft.source.trim() ||
      !noiseDraft.description.trim() ||
      !noiseDraft.mit.trim() ||
      (data.normalConditions === "Yes" && !noiseDraft.type.trim()) ||
      Object.keys(errors).length > 0
    ) {
      return;
    }

    const updatedNoiseSources = [...noiseSources];

    if (editingIndex !== null) {
      updatedNoiseSources[editingIndex] = noiseDraft;
    } else {
      updatedNoiseSources.push(noiseDraft);
    }

    onChange({
      noiseSourcesByArea: {
        ...(data.noiseSourcesByArea || {}),
        [areaKey]: updatedNoiseSources,
      },
    });

    setNoiseDraft({ source: "", description: "", mit: "", type: "" });
    setEditingIndex(null);
    setTouched({});
    onSave();
  };

  const handleDelete = (index: number) => {
    if (readOnly) return;
    
    setConfirmMessage("Are you sure you want to delete this noise source?");
    setConfirmCallback(() => () => {
      const updated = [...noiseSources];
      updated.splice(index, 1);

      onChange({
        noiseSourcesByArea: {
          ...(data.noiseSourcesByArea || {}),
          [areaKey]: updated,
        },
      });
      onSave();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const handleEdit = (index: number) => {
    if (readOnly) return;
    
    const entry = noiseSources[index];
    setNoiseDraft(entry);
    setEditingIndex(index);
  };

  const isAddEnabled = readOnly ? false : (
    noiseDraft.source.trim() &&
    noiseDraft.description.trim() &&
    noiseDraft.mit.trim() &&
    (data.normalConditions === "No" || noiseDraft.type.trim())
  );

  return (
    <Section title="Noise Sources">
      <p className="text-sm text-gray-500 mb-4">{getAreaName()}</p>

      {/* Normal Conditions */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">
          Did the normal operating conditions prevail on the day of the survey?
        </label>
        <div className="flex gap-4 mb-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              className={`px-3 py-1 rounded border ${
                data.normalConditions === opt ? "bg-blue-500 text-white" : "bg-white"
              } ${readOnly ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={() => handleNormalConditionsChange(opt as "Yes" | "No")}
              disabled={readOnly}
            >
              {opt}
            </button>
          ))}
        </div>
        <Field
          label="Elaborate"
          value={noiseDraft.type}
          onChange={handleTypeChange}
          placeholder={readOnly ? "No elaboration" : "e.g., Equipment was running as usual"}
          disabled={data.normalConditions === "No" || readOnly}
          readOnly={readOnly}
          required={data.normalConditions === "Yes"}
          error={getFieldError("type", errors, touched)}
          success={data.normalConditions === "Yes" && isFieldValid(noiseDraft.type, "type", errors)}
          onBlur={() => handleBlur("type")}
        />
      </div>

      {/* Noise Entry Fields */}
      <Field
        label="Source"
        value={noiseDraft.source}
        onChange={handleSourceChange}
        placeholder={readOnly ? "No source" : "e.g., Compressor, Press Machine"}
        readOnly={readOnly}
        required={true}
        error={getFieldError("source", errors, touched)}
        success={isFieldValid(noiseDraft.source, "source", errors)}
        onBlur={() => handleBlur("source")}
      />
      <Field
        label="Description"
        value={noiseDraft.description}
        onChange={handleDescriptionChange}
        placeholder={readOnly ? "No description" : "e.g., Cyclic pattern, Continuous operation"}
        readOnly={readOnly}
        required={true}
        error={getFieldError("description", errors, touched)}
        success={isFieldValid(noiseDraft.description, "description", errors)}
        onBlur={() => handleBlur("description")}
      />

      {/* Measurement Time Interval */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">
          Measurement Time Interval <span className="text-red-500">*</span>
        </label>
        <select
          className={`w-full border rounded px-3 py-2 ${
            readOnly ? "bg-gray-100 cursor-not-allowed" : ""
          } ${
            touched.mit && !noiseDraft.mit
              ? "border-red-500 bg-red-50"
              : noiseDraft.mit
              ? "border-green-500"
              : "border-gray-300"
          }`}
          value={noiseDraft.mit}
          onChange={(e) => handleMitChange(e.target.value)}
          onBlur={() => handleBlur("mit")}
          disabled={!noiseDraft.source || !noiseDraft.description || readOnly}
        >
          <option value="">Select interval</option>
          <option value="Cycle / Repetition">Cycle / Repetition</option>
          <option value="Representative Period">Representative Period</option>
        </select>
        {touched.mit && errors.mit && (
          <p className="text-red-600 text-sm mt-1 flex items-start">
            <span className="mr-1">⚠️</span>
            <span>{errors.mit}</span>
          </p>
        )}
      </div>

      {/* Long +Add button */}
      {!readOnly && (
        <Button variant="primary" onClick={addNoiseSource} disabled={!isAddEnabled}>
          + Add
        </Button>
      )}

      {noiseSources.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-2">Added Noise Sources</h4>
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1 text-left">Source</th>
                <th className="border px-2 py-1 text-left">Type of Noise</th>
                <th className="border px-2 py-1 text-left">Description</th>
                <th className="border px-2 py-1 text-left">MIT</th>
                {!readOnly && <th className="border px-2 py-1 text-left">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {noiseSources.map((ns: NoiseEntry, idx: number) => (
                <tr key={idx}>
                  <td className="border px-2 py-1">{ns.source}</td>
                  <td className="border px-2 py-1">{ns.type}</td>
                  <td className="border px-2 py-1">{ns.description}</td>
                  <td className="border px-2 py-1">{ns.mit}</td>
                  {!readOnly && (
                    <td className="border px-2 py-1">
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => handleEdit(idx)}>
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => handleDelete(idx)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={onBackToSurvey}>
          Back
        </Button>
        <div className="flex gap-2">
          {!readOnly && (
            <Button
              variant="success"
              onClick={onNext}
              disabled={noiseSources.length === 0}
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
      </div>

      {!readOnly && (
        <ConfirmDialog
          open={confirmOpen}
          title="Confirm"
          message={confirmMessage}
          onConfirm={confirmCallback}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </Section>
  );
}