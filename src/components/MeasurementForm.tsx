// src/components/MeasurementForm.tsx
import React, { useState, useEffect } from "react";
import Button from "./common/Button";
import ConfirmDialog from "./common/ConfirmDialog";
import Section from "./common/Section";
import Field from "./common/Field";
import { SurveyData, Measurement } from "./types";
import { validateNoiseMeasurement, validateExposureTime, getFieldError, isFieldValid } from "../utils/validation";
import { calculateAverageLAeq, getExposureSummary } from "../utils/noiseCalculations";

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
      // Find the selected SLM equipment
      const selectedSlm = data.equipment.find(eq => eq.id === value);

      // Use the paired calibrator ID from the SLM (sequential pairing)
      const pairedCalibratorId = selectedSlm?.pairedCalibratorId || "";

      setMeasurementDraft((prev) => ({
        ...prev,
        slmId: value,
        calibratorId: pairedCalibratorId // Auto-select paired calibrator
      }));
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

    // Check for required fields FIRST
    const missingFields = [];
    if (!measurementDraft.shiftDuration.trim()) missingFields.push('Shift Duration');
    if (!measurementDraft.exposureTime.trim()) missingFields.push('Exposure Time');
    if (!measurementDraft.slmId.trim()) missingFields.push('SLM ID');
    if (!measurementDraft.calibratorId.trim()) missingFields.push('Calibrator ID');
    if (measurementDraft.readings.length === 0 || measurementDraft.readings.some((r) => !r.trim())) {
      missingFields.push('Readings');
    }

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      missingFields.push('Invalid values');
    }

    // Check if any readings have errors (excluding info messages)
    const hasReadingErrors = Object.values(readingErrors).some(
      (err) => err && !err.startsWith("ℹ️")
    );
    if (hasReadingErrors) {
      missingFields.push('Invalid readings');
    }

    // If there are missing fields or errors, mark only those fields as touched and return
    if (missingFields.length > 0) {
      setTouched({
        shiftDuration: !measurementDraft.shiftDuration.trim(),
        exposureTime: !measurementDraft.exposureTime.trim(),
        slmId: !measurementDraft.slmId.trim(),
        calibratorId: !measurementDraft.calibratorId.trim(),
        ...Object.fromEntries(
          measurementDraft.readings.map((r, idx) => [`reading_${idx}`, !r.trim()])
        ),
      });
      return;
    }

    // All validation passed - add the measurement
    const updated = [...measurements];
    if (editingIndex !== null) {
      updated[editingIndex] = measurementDraft;
    } else {
      updated.push(measurementDraft);
    }

    saveMeasurementsArray(updated);

    // Reset form and clear touched state
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
    setTouched({});  // Clear all touched fields
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

  // Calculate overall area exposure summary
  const getAreaExposureSummary = () => {
    if (measurements.length === 0) return null;

    const exposureDataList = measurements.map(m => {
      const readingValues = m.readings.map(r => parseFloat(r)).filter(v => !isNaN(v));
      const avgLAeq = calculateAverageLAeq(readingValues);
      const exposureTime = parseFloat(m.exposureTime) || 0;
      const shiftDuration = parseFloat(m.shiftDuration) || 0;
      return getExposureSummary(avgLAeq, exposureTime, shiftDuration);
    });

    // Find worst case (highest LEX,8h)
    const worstCase = exposureDataList.reduce((max, current) =>
      current.lex8h > max.lex8h ? current : max
    );

    // Count measurements by zone
    const greenCount = exposureDataList.filter(d => d.zone.zone === 'green').length;
    const orangeCount = exposureDataList.filter(d => d.zone.zone === 'orange').length;
    const redCount = exposureDataList.filter(d => d.zone.zone === 'red').length;

    return {
      worstCase,
      greenCount,
      orangeCount,
      redCount,
      totalMeasurements: measurements.length
    };
  };

  const areaSummary = getAreaExposureSummary();

  return (
    <Section key={areaKey + "-" + formInstanceId} title="Measurements">
      <p className="text-sm text-gray-500 mb-4">{getAreaName()}</p>

      {/* Overall Area Exposure Summary */}
      {areaSummary && (
        <div className={`mb-6 p-4 border-2 rounded-lg ${
          areaSummary.worstCase.zone.zone === 'red' ? 'bg-red-50 border-red-300' :
          areaSummary.worstCase.zone.zone === 'orange' ? 'bg-orange-50 border-orange-300' :
          'bg-green-50 border-green-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold">📊 Area Exposure Status</h3>
            <span className={`px-3 py-1 rounded-lg font-bold ${areaSummary.worstCase.zone.bgColor} ${areaSummary.worstCase.zone.textColor}`}>
              {areaSummary.worstCase.zone.label}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-white p-2 rounded border">
              <div className="text-xs text-gray-600">Worst-Case LEX,8h</div>
              <div className="text-xl font-bold">{areaSummary.worstCase.lex8h.toFixed(1)} dB(A)</div>
            </div>
            <div className="bg-white p-2 rounded border">
              <div className="text-xs text-gray-600">Maximum Dose</div>
              <div className="text-xl font-bold">{areaSummary.worstCase.dose.toFixed(0)}%</div>
            </div>
            <div className="bg-white p-2 rounded border">
              <div className="text-xs text-gray-600">Total Measurements</div>
              <div className="text-xl font-bold">{areaSummary.totalMeasurements}</div>
            </div>
            <div className="bg-white p-2 rounded border">
              <div className="text-xs text-gray-600">Zone Distribution</div>
              <div className="flex gap-1 mt-1">
                {areaSummary.greenCount > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800 font-medium">
                    {areaSummary.greenCount}G
                  </span>
                )}
                {areaSummary.orangeCount > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded bg-orange-100 text-orange-800 font-medium">
                    {areaSummary.orangeCount}O
                  </span>
                )}
                {areaSummary.redCount > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-800 font-medium">
                    {areaSummary.redCount}R
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Compliance Status & Actions Required */}
          <div className={`p-3 rounded ${
            areaSummary.worstCase.compliance.severity === 'critical' ? 'bg-red-100' :
            areaSummary.worstCase.compliance.severity === 'warning' ? 'bg-orange-100' :
            'bg-green-100'
          }`}>
            <div className="font-semibold text-sm mb-1">
              {areaSummary.worstCase.compliance.severity === 'critical' && '🚨 CRITICAL: '}
              {areaSummary.worstCase.compliance.severity === 'warning' && '⚠️ WARNING: '}
              {areaSummary.worstCase.compliance.severity === 'info' && '✅ SAFE: '}
              {areaSummary.worstCase.compliance.isCompliant ? 'Compliant with SANS 10083' : 'Non-Compliant - Immediate Action Required'}
            </div>
            <div className="text-xs">
              <span className="font-semibold">Required Actions:</span>
              <ul className="list-disc list-inside mt-1">
                {areaSummary.worstCase.compliance.actionRequired.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
            {data.equipment
              .filter(eq => eq.type === "Calibrator")
              .map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
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
          <h4 className="text-lg font-semibold mb-2">Added Measurements & Exposure Analysis</h4>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1">#</th>
                  <th className="border px-2 py-1">Shift (hrs)</th>
                  <th className="border px-2 py-1">Exposure (hrs)</th>
                  <th className="border px-2 py-1">Readings (dB)</th>
                  <th className="border px-2 py-1">LAeq</th>
                  <th className="border px-2 py-1 bg-blue-50">LEX,8h</th>
                  <th className="border px-2 py-1 bg-blue-50">Dose %</th>
                  <th className="border px-2 py-1 bg-blue-50">Zone</th>
                  <th className="border px-2 py-1">Equipment</th>
                  {!readOnly && <th className="border px-2 py-1">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {measurements.map((m, idx) => {
                  // Calculate exposure metrics
                  const readingValues = m.readings.map(r => parseFloat(r)).filter(v => !isNaN(v));
                  const avgLAeq = calculateAverageLAeq(readingValues);
                  const exposureTime = parseFloat(m.exposureTime) || 0;
                  const shiftDuration = parseFloat(m.shiftDuration) || 0;
                  const exposureData = getExposureSummary(avgLAeq, exposureTime, shiftDuration);

                  // Determine row background color based on zone
                  const rowBgColor =
                    exposureData.zone.zone === 'red' ? 'bg-red-50' :
                    exposureData.zone.zone === 'orange' ? 'bg-orange-50' :
                    exposureData.zone.zone === 'green' ? 'bg-green-50' :
                    '';

                  return (
                    <tr key={idx} className={rowBgColor}>
                      <td className="border px-2 py-1 text-center font-medium">{idx + 1}</td>
                      <td className="border px-2 py-1 text-center">{m.shiftDuration}</td>
                      <td className="border px-2 py-1 text-center">{m.exposureTime}</td>
                      <td className="border px-2 py-1 text-center text-xs">
                        {(m.readings || []).join(", ")}
                      </td>
                      <td className="border px-2 py-1 text-center font-medium">
                        {avgLAeq > 0 ? `${avgLAeq.toFixed(1)} dB(A)` : '—'}
                      </td>
                      <td className="border px-2 py-1 text-center font-bold bg-blue-50">
                        {exposureData.lex8h > 0 ? `${exposureData.lex8h.toFixed(1)} dB(A)` : '—'}
                      </td>
                      <td className="border px-2 py-1 text-center font-medium bg-blue-50">
                        {exposureData.dose > 0 ? `${exposureData.dose.toFixed(1)}%` : '—'}
                      </td>
                      <td className="border px-2 py-1 text-center bg-blue-50">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${exposureData.zone.bgColor} ${exposureData.zone.textColor}`}>
                            {exposureData.zone.label}
                          </span>
                          {exposureData.compliance.level === 'limit-exceeded' && (
                            <span className="text-xs text-red-700 font-medium">⚠️ Limit Exceeded</span>
                          )}
                          {exposureData.compliance.level === 'action' && (
                            <span className="text-xs text-orange-700 font-medium">⚠️ Action Required</span>
                          )}
                        </div>
                      </td>
                      <td className="border px-2 py-1 text-xs text-gray-600">
                        <div>SLM: {data.equipment.find(eq => eq.id === m.slmId)?.name || m.slmId}</div>
                        <div>Cal: {data.equipment.find(eq => eq.id === m.calibratorId)?.name || m.calibratorId}</div>
                      </td>
                      {!readOnly && (
                        <td className="border px-2 py-1">
                          <div className="flex flex-col gap-1">
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Exposure Summary Legend */}
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h5 className="text-sm font-bold mb-2">📊 Exposure Analysis Key:</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-semibold">LAeq:</span> Average equivalent continuous sound level during measurement
              </div>
              <div>
                <span className="font-semibold">LEX,8h:</span> Daily noise exposure normalized to 8-hour shift (SANS 10083)
              </div>
              <div>
                <span className="font-semibold">Dose %:</span> Percentage of maximum permissible daily exposure (100% = limit)
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Zones:</span>
                <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">Green &lt;85</span>
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-medium">Orange 85-87</span>
                <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium">Red ≥87</span>
              </div>
            </div>
          </div>
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