// src/components/MeasurementForm.tsx
import React, { useState, useEffect } from "react";
import Button from "./common/Button";
import ConfirmDialog from "./common/ConfirmDialog";
import Section from "./common/Section";
import Field from "./common/Field";
import { SurveyData, Measurement } from "./types";
import { validateNoiseMeasurement, validateExposureTime, getFieldError, isFieldValid } from "../utils/validation";

interface MeasurementFormProps {
  data: SurveyData;
  selectedAreaPath: { main: number; sub?: number; ss?: number } | null;
  equipmentOptions: { label: string; value: string }[];
  onNext: () => void;
  onPrev: () => void;
  onChange: (patch: Partial<SurveyData>) => void;
  onSave: () => void;
  readOnly?: boolean;
}

export default function MeasurementForm({
  data,
  selectedAreaPath,
  equipmentOptions,
  onNext,
  onPrev,
  onChange,
  onSave,
  readOnly = false
}: MeasurementFormProps) {
  const [measurementDraft, setMeasurementDraft] = useState<Measurement>({
    shiftDuration: "",
    exposureTime: "",
    slmId: "",
    calibratorId: "",
    measurementCount: "0",
    areaLeq: [],
    readings: [],
    files: [],
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<() => void>(() => () => {});
  const [formInstanceId, setFormInstanceId] = useState<number>(0);

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [readingErrors, setReadingErrors] = useState<Record<number, string>>({});

  // Validate measurements in real-time
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    // Validate exposure time
    if (measurementDraft.shiftDuration && measurementDraft.exposureTime) {
      const exposureValidation = validateExposureTime(
        measurementDraft.exposureTime,
        measurementDraft.shiftDuration
      );
      if (exposureValidation.errors.exposureTime) {
        newErrors.exposureTime = exposureValidation.errors.exposureTime;
      }
    }

    // Validate each reading
    const newReadingErrors: Record<number, string> = {};
    measurementDraft.readings.forEach((reading, idx) => {
      if (reading.trim()) {
        const noiseValidation = validateNoiseMeasurement(reading);
        if (noiseValidation.errors.noiseLevel) {
          newReadingErrors[idx] = noiseValidation.errors.noiseLevel;
        } else if (noiseValidation.errors.noiseLevelInfo) {
          newReadingErrors[idx] = noiseValidation.errors.noiseLevelInfo;
        }
      }
    });

    setErrors(newErrors);
    setReadingErrors(newReadingErrors);
  }, [measurementDraft]);

  // Handle field blur
  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  };

  if (!selectedAreaPath) return null;

  // ✅ Use JSON.stringify like NoiseSources
  const areaKey = JSON.stringify(selectedAreaPath);

  // ✅ Get the actual area object to verify it exists
  const getCurrentArea = () => {
    const mainArea = data.areas[selectedAreaPath.main];
    if (!mainArea) return null;

    if (selectedAreaPath.sub !== undefined) {
      const subArea = mainArea.subAreas?.[selectedAreaPath.sub];
      if (!subArea) return null;
      
      if (selectedAreaPath.ss !== undefined) {
        const subSubArea = subArea.subAreas?.[selectedAreaPath.ss];
        if (!subSubArea) return null;
        return subSubArea;
      }
      return subArea;
    }
    return mainArea;
  };

  const currentArea = getCurrentArea();

  // ✅ Only get measurements if the area actually exists at this path
  const measurements: Measurement[] = currentArea ? (data.measurementsByArea?.[areaKey] || []) : [];

  // ✅ Reset draft when switching areas OR when area doesn't exist
  useEffect(() => {
    if (!currentArea) {
      // If area doesn't exist at this path, clear everything
      setMeasurementDraft({
        shiftDuration: "",
        exposureTime: "",
        slmId: "",
        calibratorId: "",
        measurementCount: "0",
        areaLeq: [],
        readings: [],
        files: [],
      });
      setEditingIndex(null);
    } else {
      // Normal reset when switching to a valid area
      setMeasurementDraft({
        shiftDuration: "",
        exposureTime: "",
        slmId: "",
        calibratorId: "",
        measurementCount: "0",
        areaLeq: [],
        readings: [],
        files: [],
      });
      setEditingIndex(null);
      setFormInstanceId((prev) => prev + 1);
    }
  }, [areaKey, currentArea]);

  // ✅ SIMPLIFIED cleanup: Remove measurements for paths that don't have valid areas
  useEffect(() => {
    if (!data.measurementsByArea || readOnly) return;

    const updatedMeasurements = { ...data.measurementsByArea };
    let hasChanges = false;

    // Check each stored measurement key
    Object.keys(updatedMeasurements).forEach((key) => {
      try {
        const path = JSON.parse(key);
        
        // Verify this path points to a real area
        const mainArea = data.areas[path.main];
        if (!mainArea) {
          delete updatedMeasurements[key];
          hasChanges = true;
          return;
        }

        if (path.sub !== undefined) {
          const subArea = mainArea.subAreas?.[path.sub];
          if (!subArea) {
            delete updatedMeasurements[key];
            hasChanges = true;
            return;
          }

          if (path.ss !== undefined) {
            const subSubArea = subArea.subAreas?.[path.ss];
            if (!subSubArea) {
              delete updatedMeasurements[key];
              hasChanges = true;
              return;
            }
          }
        }
      } catch (error) {
        // If key is not valid JSON, remove it
        delete updatedMeasurements[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onChange({ measurementsByArea: updatedMeasurements });
      onSave();
    }
  }, [data.areas, onChange, onSave, readOnly]);

  // ✅ Get display name for UI
  const getAreaName = () => {
    if (!currentArea) return "Area not found";
    
    const mainArea = data.areas[selectedAreaPath.main];
    if (selectedAreaPath.ss !== undefined) {
      return `Sub Sub Area: ${currentArea.name}`;
    }
    if (selectedAreaPath.sub !== undefined) {
      return `Sub Area: ${currentArea.name}`;
    }
    return `Main Area: ${currentArea.name}`;
  };

  const saveMeasurementsArray = (updatedArr: Measurement[]) => {
    if (readOnly) return; // Don't save in read-only mode
    
    onChange({
      measurementsByArea: {
        ...(data.measurementsByArea || {}),
        [areaKey]: updatedArr,
      },
    });
    onSave();
  };

  // Handler functions that only work when not in read-only mode
  const handleShiftDurationChange = (value: string) => {
    if (!readOnly) {
      setMeasurementDraft((prev) => ({ ...prev, shiftDuration: value }));
    }
  };

  const handleExposureTimeChange = (value: string) => {
    if (!readOnly) {
      setMeasurementDraft((prev) => ({ ...prev, exposureTime: value }));
    }
  };

  const handleSlmIdChange = (value: string) => {
    if (!readOnly) {
      setMeasurementDraft((prev) => ({ ...prev, slmId: value }));
    }
  };

  const handleCalibratorIdChange = (value: string) => {
    if (!readOnly) {
      setMeasurementDraft((prev) => ({ ...prev, calibratorId: value }));
    }
  };

  const handleMeasurementCountChange = (value: string) => {
    if (!readOnly) {
      const count = parseInt(value) || 0;
      const labels = Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));

      const updatedReadings = Array(count)
        .fill("")
        .map((_, idx) => measurementDraft.readings[idx] || "");

      setMeasurementDraft((prev) => ({
        ...prev,
        measurementCount: value,
        areaLeq: labels,
        readings: updatedReadings,
      }));
    }
  };

  const handleReadingChange = (idx: number, value: string) => {
    if (!readOnly) {
      const updated = [...measurementDraft.readings];
      updated[idx] = value;
      setMeasurementDraft((prev) => ({ ...prev, readings: updated }));
    }
  };

  const addMeasurement = () => {
    if (readOnly) return;

    // Mark all fields as touched
    setTouched({
      shiftDuration: true,
      exposureTime: true,
      slmId: true,
      calibratorId: true,
      ...Object.fromEntries(measurementDraft.readings.map((_, idx) => [`reading_${idx}`, true])),
    });

    // Check for required fields
    if (
      !measurementDraft.shiftDuration.trim() ||
      !measurementDraft.exposureTime.trim() ||
      !measurementDraft.slmId.trim() ||
      !measurementDraft.calibratorId.trim() ||
      measurementDraft.readings.length === 0 ||
      measurementDraft.readings.some((r) => !r.trim())
    ) {
      return;
    }

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      return;
    }

    // Check if any readings have errors (excluding info messages)
    const hasReadingErrors = Object.values(readingErrors).some(
      (err) => err && !err.startsWith("ℹ️")
    );
    if (hasReadingErrors) {
      return;
    }

    const updated = [...measurements];
    if (editingIndex !== null) {
      updated[editingIndex] = measurementDraft;
    } else {
      updated.push(measurementDraft);
    }

    saveMeasurementsArray(updated);

    setMeasurementDraft({
      shiftDuration: "",
      exposureTime: "",
      slmId: "",
      calibratorId: "",
      measurementCount: "0",
      areaLeq: [],
      readings: [],
      files: [],
    });
    setEditingIndex(null);
  };

  const handleEdit = (index: number) => {
    if (readOnly) return;
    
    const entry = measurements[index];
    setMeasurementDraft(entry);
    setEditingIndex(index);
  };

  const handleDelete = (index: number) => {
    if (readOnly) return;
    
    setConfirmMessage("Are you sure you want to delete this measurement?");
    setConfirmCallback(() => () => {
      const updated = [...measurements];
      updated.splice(index, 1);
      saveMeasurementsArray(updated);
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const isAddEnabled = readOnly ? false : (
    measurementDraft.shiftDuration.trim() &&
    measurementDraft.exposureTime.trim() &&
    measurementDraft.slmId.trim() &&
    measurementDraft.calibratorId.trim() &&
    measurementDraft.readings.length > 0 &&
    measurementDraft.readings.every((r) => r.trim() !== "")
  );

  // Don't render if area doesn't exist
  if (!currentArea) {
    return (
      <Section title="Measurements">
        <p className="text-red-500">Selected area no longer exists.</p>
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
      </Section>
    );
  }

  return (
    <Section key={areaKey + "-" + formInstanceId} title="Measurements">
      <p className="text-sm text-gray-500 mb-4">{getAreaName()}</p>

      {/* Shift + Exposure */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Field
          label="Shift Duration (hrs)"
          type="number"
          value={measurementDraft.shiftDuration}
          onChange={handleShiftDurationChange}
          placeholder="e.g., 8"
          disabled={readOnly}
          required={true}
          error={touched.shiftDuration && !measurementDraft.shiftDuration ? "Shift duration is required" : ""}
          success={!!measurementDraft.shiftDuration && !errors.shiftDuration}
          onBlur={() => handleBlur("shiftDuration")}
        />
        <Field
          label="Exposure Time (hrs)"
          type="number"
          value={measurementDraft.exposureTime}
          onChange={handleExposureTimeChange}
          placeholder="e.g., 8"
          disabled={readOnly}
          required={true}
          error={getFieldError("exposureTime", errors, touched) || (touched.exposureTime && !measurementDraft.exposureTime ? "Exposure time is required" : "")}
          success={!!measurementDraft.exposureTime && !errors.exposureTime}
          onBlur={() => handleBlur("exposureTime")}
        />
      </div>

      {/* Measurement Count */}
      <div className="mb-2">
        <label className="block mb-1 text-sm">Measurement Count</label>
        <select
          className={`w-full border rounded px-2 py-2 text-sm ${
            readOnly ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
          value={measurementDraft.measurementCount}
          onChange={(e) => handleMeasurementCountChange(e.target.value)}
          disabled={readOnly}
        >
          {Array.from({ length: 26 }, (_, i) => (
            <option key={i} value={String(i)}>
              {i}
            </option>
          ))}
        </select>
      </div>

      {/* Readings */}
      {measurementDraft.areaLeq.length > 0 && (
        <div className="mb-4">
          <label className="block mb-1 text-sm font-medium">
            Noise Level Readings (dB(A)) <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {measurementDraft.areaLeq.map((label, idx) => {
              const hasError = readingErrors[idx] && readingErrors[idx].startsWith("⚠️") && !readingErrors[idx].startsWith("ℹ️");
              const hasInfo = readingErrors[idx] && readingErrors[idx].startsWith("ℹ️");
              return (
                <div key={idx} className="flex flex-col">
                  <input
                    type="number"
                    value={measurementDraft.readings[idx] || ""}
                    placeholder={label}
                    onChange={(e) => handleReadingChange(idx, e.target.value)}
                    onBlur={() => handleBlur(`reading_${idx}`)}
                    className={`w-20 border rounded px-2 py-1 text-sm text-center ${
                      readOnly ? "bg-gray-100 cursor-not-allowed" : ""
                    } ${
                      hasError
                        ? "border-red-500 bg-red-50"
                        : measurementDraft.readings[idx]
                        ? "border-green-500"
                        : "border-gray-300"
                    }`}
                    disabled={readOnly}
                  />
                  {touched[`reading_${idx}`] && readingErrors[idx] && (
                    <span
                      className={`text-xs mt-1 ${
                        hasInfo ? "text-blue-600" : "text-red-600"
                      }`}
                    >
                      {readingErrors[idx].replace(/^[⚠️ℹ️]\s*/, "")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Typical range: 30-120 dB(A). Values outside this range will be flagged.
          </p>
        </div>
      )}

      {/* Equipment */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block mb-1 text-sm">SLM ID</label>
          <select
            className={`w-full border rounded px-2 py-2 text-sm ${
              readOnly ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
            value={measurementDraft.slmId}
            onChange={(e) => handleSlmIdChange(e.target.value)}
            disabled={readOnly}
          >
            <option value="">Select SLM</option>
            {equipmentOptions.map((eq) => (
              <option key={eq.value} value={eq.value}>
                {eq.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 text-sm">Calibrator ID</label>
          <select
            className={`w-full border rounded px-2 py-2 text-sm ${
              readOnly ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
            value={measurementDraft.calibratorId}
            onChange={(e) => handleCalibratorIdChange(e.target.value)}
            disabled={readOnly}
          >
            <option value="">Select Calibrator</option>
            {["W152", "IS 30C"].map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Add / Update */}
      {!readOnly && (
        <Button variant="primary" onClick={addMeasurement} disabled={!isAddEnabled}>
          {editingIndex !== null ? "Update Measurement" : "+ Add"}
        </Button>
      )}

      {/* Table */}
      {measurements.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-2">Added Measurements</h4>
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">Shift Duration</th>
                <th className="border px-2 py-1">Exposure Time</th>
                <th className="border px-2 py-1">SLM</th>
                <th className="border px-2 py-1">Calibrator</th>
                <th className="border px-2 py-1">Readings</th>
                {!readOnly && <th className="border px-2 py-1">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {measurements.map((m, idx) => (
                <tr key={idx}>
                  <td className="border px-2 py-1">{m.shiftDuration}</td>
                  <td className="border px-2 py-1">{m.exposureTime}</td>
                  <td className="border px-2 py-1">{m.slmId}</td>
                  <td className="border px-2 py-1">{m.calibratorId}</td>
                  <td className="border px-2 py-1">{(m.readings || []).join(", ")}</td>
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
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
        {!readOnly && (
          <Button variant="success" onClick={onNext} disabled={measurements.length === 0}>
            Next
          </Button>
        )}
        {readOnly && (
          <Button variant="secondary" onClick={onNext}>
            Next
          </Button>
        )}
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