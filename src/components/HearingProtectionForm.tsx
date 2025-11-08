// src/components/HearingProtectionForm.tsx
import React, { useState, useEffect, useRef } from "react";
import SelectField from "./common/SelectField";
import Field from "./common/Field";
import Button from "./common/Button";
import Section from "./common/Section";
import ConfirmDialog from "./common/ConfirmDialog";
import { SurveyData, Device, AreaPath } from "./types";
import { getFieldError, isFieldValid } from "../utils/validation";
import { calculateAverageLAeq, getExposureSummary } from "../utils/noiseCalculations";
import { getProtectionSummary, calculateProtectedExposure } from "../utils/hearingProtectionCalculations";

interface Props {
  data: SurveyData;
  selectedAreaPath?: AreaPath | null;
  onNext: () => void;
  onPrev: () => void;
  onSave?: () => void;
  onChange?: (patch: Partial<SurveyData>) => void;
  readOnly?: boolean;
}

export default function HearingProtectionForm({
  data,
  selectedAreaPath,
  onNext,
  onPrev,
  onSave,
  onChange,
  readOnly = false
}: Props) {
  const [issued, setIssued] = useState<"Yes" | "No">("Yes");
  const [deviceType, setDeviceType] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [snrOrNrr, setSnrOrNrr] = useState("SNR");
  const [snrValue, setSnrValue] = useState("");
  const [condition, setCondition] = useState<"" | "Good" | "Poor">("");
  const [conditionComment, setConditionComment] = useState("");
  const [training, setTraining] = useState<"Yes" | "No">("Yes");
  const [fitting, setFitting] = useState<"Yes" | "No">("Yes");
  const [maintenance, setMaintenance] = useState<"Yes" | "No">("Yes");
  const [devices, setDevices] = useState<Device[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<() => void>(() => () => {});

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const prevAreaRef = useRef<string>("");

  const getAreaKey = () => (selectedAreaPath ? JSON.stringify(selectedAreaPath) : "");

  // Validate device fields in real-time
  useEffect(() => {
    if (issued === "No") {
      setErrors({});
      return;
    }

    const newErrors: Record<string, string> = {};

    // Manufacturer validation
    if (!manufacturer.trim()) {
      newErrors.manufacturer = "Manufacturer is required";
    } else if (manufacturer.length < 2) {
      newErrors.manufacturer = "Manufacturer name must be at least 2 characters";
    }

    // SNR/NRR value validation
    if (!snrValue.trim()) {
      newErrors.snrValue = `${snrOrNrr} value is required`;
    } else {
      const value = parseFloat(snrValue);
      if (isNaN(value)) {
        newErrors.snrValue = "Must be a valid number";
      } else if (value <= 0) {
        newErrors.snrValue = "Value must be greater than 0";
      } else if (snrOrNrr === "SNR" && (value < 10 || value > 40)) {
        newErrors.snrValue = "⚠️ Typical SNR range is 10-40 dB. Please verify.";
      } else if (snrOrNrr === "NRR" && (value < 15 || value > 35)) {
        newErrors.snrValue = "⚠️ Typical NRR range is 15-35 dB. Please verify.";
      }
    }

    // Condition comment validation (only when condition is "Poor")
    if (condition === "Poor") {
      if (!conditionComment.trim()) {
        newErrors.conditionComment = "Please explain the poor condition";
      } else if (conditionComment.length < 10) {
        newErrors.conditionComment = "Please provide more detail (at least 10 characters)";
      }
    }

    setErrors(newErrors);
  }, [manufacturer, snrValue, snrOrNrr, condition, conditionComment, issued]);

  // Handle field blur
  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  };

  // ✅ Load stored devices when area changes
  useEffect(() => {
    const key = getAreaKey();
    if (!key || prevAreaRef.current === key) return;
    prevAreaRef.current = key;

    const areaDevices = data.hearingProtectionDevices?.[key] || [];
    const issuedStatus = data.hearingIssuedStatus?.[key] || "Yes";

    setDevices(areaDevices);
    setIssued(issuedStatus);

    // Reset input fields
    setDeviceType("");
    setManufacturer("");
    setSnrOrNrr("SNR");
    setSnrValue("");
    setCondition("");
    setConditionComment("");
    setTraining("Yes");
    setFitting("Yes");
    setMaintenance("Yes");
    setEditingIndex(null);
    setTouched({});
  }, [selectedAreaPath, data.hearingProtectionDevices, data.hearingIssuedStatus]);

  // ✅ Auto-save issued status
  useEffect(() => {
    if (readOnly) return; // Don't auto-save in read-only mode
    
    const key = getAreaKey();
    if (!key) return;

    if (issued === "No") {
      setDevices([]);
      onChange?.({
        hearingProtectionDevices: { ...(data.hearingProtectionDevices || {}), [key]: [] },
        hearingIssuedStatus: { ...(data.hearingIssuedStatus || {}), [key]: "No" },
      });
      onSave?.();
    } else {
      onChange?.({
        hearingIssuedStatus: { ...(data.hearingIssuedStatus || {}), [key]: "Yes" },
      });
      onSave?.();
    }
  }, [issued, readOnly]);

  // ✅ Auto-save devices when updated
  useEffect(() => {
    if (readOnly) return; // Don't auto-save in read-only mode
    
    const key = getAreaKey();
    if (!key) return;

    onChange?.({
      hearingProtectionDevices: { ...(data.hearingProtectionDevices || {}), [key]: devices },
    });
    onSave?.();
  }, [devices, readOnly]);

  // ✅ FIXED: Cleanup effect to remove data for deleted areas
  useEffect(() => {
    if (!data.hearingProtectionDevices && !data.hearingIssuedStatus || readOnly) return;

    const updatedDevices = { ...(data.hearingProtectionDevices || {}) };
    const updatedIssuedStatus = { ...(data.hearingIssuedStatus || {}) };
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

    // Remove devices and issued status for areas that no longer exist
    Object.keys(updatedDevices).forEach((key) => {
      if (!validAreaKeys.has(key)) {
        delete updatedDevices[key];
        delete updatedIssuedStatus[key];
        hasChanges = true;
      }
    });

    // Also remove issued status for areas that don't exist
    Object.keys(updatedIssuedStatus).forEach((key) => {
      if (!validAreaKeys.has(key)) {
        delete updatedIssuedStatus[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onChange?.({
        hearingProtectionDevices: updatedDevices,
        hearingIssuedStatus: updatedIssuedStatus,
      });
      onSave?.();
    }
  }, [data.areas, data.hearingProtectionDevices, data.hearingIssuedStatus, onChange, onSave, readOnly]);

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

  // Get worst-case LEX,8h from measurements for this area
  const getWorstCaseExposure = (): number => {
    const key = getAreaKey();
    if (!key) return 0;

    const measurements = data.measurementsByArea?.[key] || [];
    if (measurements.length === 0) return 0;

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
    , exposureDataList[0]);

    return worstCase?.lex8h || 0;
  };

  const actualLex8h = getWorstCaseExposure();
  const protectionSummary = devices.length > 0 && actualLex8h > 0
    ? getProtectionSummary(actualLex8h, devices)
    : null;

  const disabled = issued === "No" || readOnly;

  // Handler functions that only work when not in read-only mode
  const handleIssuedChange = (opt: "Yes" | "No") => {
    if (!readOnly) {
      setIssued(opt);
    }
  };

  const handleDeviceTypeChange = (value: string) => {
    if (!readOnly) {
      setDeviceType(value);
    }
  };

  const handleManufacturerChange = (value: string) => {
    if (!readOnly) {
      setManufacturer(value);
    }
  };

  const handleSnrOrNrrChange = (value: string) => {
    if (!readOnly) {
      setSnrOrNrr(value);
    }
  };

  const handleSnrValueChange = (value: string) => {
    if (!readOnly) {
      setSnrValue(value);
    }
  };

  const handleConditionChange = (value: "" | "Good" | "Poor") => {
    if (!readOnly) {
      setCondition(value);
    }
  };

  const handleConditionCommentChange = (value: string) => {
    if (!readOnly) {
      setConditionComment(value);
    }
  };

  const handleTrainingChange = (value: "Yes" | "No") => {
    if (!readOnly) {
      setTraining(value);
    }
  };

  const handleFittingChange = (value: "Yes" | "No") => {
    if (!readOnly) {
      setFitting(value);
    }
  };

  const handleMaintenanceChange = (value: "Yes" | "No") => {
    if (!readOnly) {
      setMaintenance(value);
    }
  };

  const addOrUpdateDevice = () => {
    if (readOnly) return;

    // Mark all fields as touched
    setTouched({
      deviceType: true,
      manufacturer: true,
      snrValue: true,
      condition: true,
      conditionComment: true,
    });

    // Check for required fields and validation errors
    if (!deviceType || !manufacturer || !snrValue || !condition) return;

    // Check if there are any validation errors
    if (Object.keys(errors).length > 0) {
      return;
    }

    const newDevice: Device = {
      type: deviceType,
      manufacturer,
      snrOrNrr,
      snrValue,
      condition,
      conditionComment,
      training,
      fitting,
      maintenance,
    };

    const updatedDevices =
      editingIndex !== null
        ? devices.map((d, i) => (i === editingIndex ? newDevice : d))
        : [...devices, newDevice];

    setDevices(updatedDevices);
    setEditingIndex(null);

    // Reset inputs and touched state
    setDeviceType("");
    setManufacturer("");
    setSnrOrNrr("SNR");
    setSnrValue("");
    setCondition("");
    setConditionComment("");
    setTraining("Yes");
    setFitting("Yes");
    setMaintenance("Yes");
    setTouched({});
  };

  const handleEdit = (idx: number) => {
    if (readOnly) return;
    
    const d = devices[idx];
    setDeviceType(d.type);
    setManufacturer(d.manufacturer);
    setSnrOrNrr(d.snrOrNrr);
    setSnrValue(d.snrValue);
    setCondition(d.condition);
    setConditionComment(d.conditionComment);
    setTraining(d.training);
    setFitting(d.fitting);
    setMaintenance(d.maintenance);
    setEditingIndex(idx);
  };

  const handleDelete = (idx: number) => {
    if (readOnly) return;
    
    setConfirmMessage("Are you sure you want to delete this device?");
    setConfirmCallback(() => () => {
      setDevices(devices.filter((_, i) => i !== idx));
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const isNextDisabled = readOnly ? false : (issued === "Yes" && devices.length === 0);

  return (
    <Section title="Hearing Protection Devices">
      <p className="text-sm text-gray-500 mb-4">{getAreaName()}</p>

      {/* Protection Effectiveness Dashboard */}
      {protectionSummary && (
        <div className={`mb-6 p-4 border-2 rounded-lg ${
          protectionSummary.adequacy.severity === 'error' ? 'bg-red-50 border-red-300' :
          protectionSummary.adequacy.severity === 'warning' ? 'bg-orange-50 border-orange-300' :
          protectionSummary.adequacy.severity === 'info' ? 'bg-blue-50 border-blue-300' :
          'bg-green-50 border-green-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold">🛡️ Hearing Protection Effectiveness</h3>
            <span className={`px-3 py-1 rounded-lg font-bold ${
              protectionSummary.adequacy.severity === 'error' ? 'bg-red-100 text-red-800' :
              protectionSummary.adequacy.severity === 'warning' ? 'bg-orange-100 text-orange-800' :
              protectionSummary.adequacy.severity === 'info' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }`}>
              {protectionSummary.adequacy.level.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Actual Exposure */}
            <div className="bg-white p-3 rounded border">
              <div className="text-xs text-gray-600 mb-1">Actual Exposure (No PPE)</div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{actualLex8h.toFixed(1)} dB(A)</div>
                <span className={`px-2 py-1 text-xs rounded font-bold ${protectionSummary.actualZone.bgColor} ${protectionSummary.actualZone.textColor}`}>
                  {protectionSummary.actualZone.label}
                </span>
              </div>
            </div>

            {/* Effective Attenuation */}
            <div className="bg-white p-3 rounded border">
              <div className="text-xs text-gray-600 mb-1">Effective Attenuation (Derated)</div>
              <div className="text-2xl font-bold text-blue-600">-{protectionSummary.effectiveAttenuation.toFixed(1)} dB</div>
              <div className="text-xs text-gray-500 mt-1">{protectionSummary.deviceSummary}</div>
            </div>

            {/* Protected Exposure */}
            <div className="bg-white p-3 rounded border">
              <div className="text-xs text-gray-600 mb-1">Protected Exposure (With PPE)</div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-green-600">{protectionSummary.protectedLex8h.toFixed(1)} dB(A)</div>
                <span className={`px-2 py-1 text-xs rounded font-bold ${protectionSummary.protectedZone.bgColor} ${protectionSummary.protectedZone.textColor}`}>
                  {protectionSummary.protectedZone.label}
                </span>
              </div>
            </div>
          </div>

          {/* Adequacy Assessment */}
          <div className={`p-3 rounded ${
            protectionSummary.adequacy.severity === 'error' ? 'bg-red-100' :
            protectionSummary.adequacy.severity === 'warning' ? 'bg-orange-100' :
            protectionSummary.adequacy.severity === 'info' ? 'bg-blue-100' :
            'bg-green-100'
          }`}>
            <div className="font-semibold text-sm mb-2">
              {protectionSummary.adequacy.severity === 'error' && '❌ '}
              {protectionSummary.adequacy.severity === 'warning' && '⚠️ '}
              {protectionSummary.adequacy.severity === 'info' && 'ℹ️ '}
              {protectionSummary.adequacy.severity === 'success' && '✅ '}
              {protectionSummary.adequacy.message}
            </div>
            <div className="text-xs">
              <span className="font-semibold">Recommendations:</span>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {protectionSummary.adequacy.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* No Measurements Warning */}
      {actualLex8h === 0 && issued === "Yes" && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
          <div className="flex items-start gap-2">
            <span className="text-yellow-700 font-bold">⚠️</span>
            <div className="text-sm text-yellow-800">
              <p className="font-semibold">No noise measurements available for this area</p>
              <p className="text-xs mt-1">Complete the Measurements step to see protection effectiveness analysis.</p>
            </div>
          </div>
        </div>
      )}

      {/* Issued */}
      <div className="mb-4">
        <label className="font-semibold block mb-1">Hearing protection devices issued?</label>
        <div className="flex gap-4">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              className={`px-3 py-1 rounded border ${
                issued === opt ? "bg-blue-500 text-white" : "bg-white"
              } ${readOnly ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={() => handleIssuedChange(opt as "Yes" | "No")}
              disabled={readOnly}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Device Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectField<string>
          label="Type"
          value={deviceType}
          options={[
            { label: "Disposable", value: "Disposable" },
            { label: "Reusable", value: "Reusable" },
            { label: "Custom Moulded", value: "Custom Moulded" },
            { label: "Earmuffs", value: "Earmuffs" },
          ]}
          onChange={handleDeviceTypeChange}
          disabled={disabled}
        />
        <Field
          label="Manufacturer"
          value={manufacturer}
          onChange={handleManufacturerChange}
          disabled={disabled}
          placeholder="e.g., 3M, Moldex, Honeywell"
          readOnly={readOnly}
          required={issued === "Yes"}
          error={getFieldError("manufacturer", errors, touched)}
          success={issued === "Yes" && isFieldValid(manufacturer, "manufacturer", errors)}
          onBlur={() => handleBlur("manufacturer")}
        />
        <SelectField<string>
          label="SNR / NRR"
          value={snrOrNrr}
          options={[
            { label: "SNR", value: "SNR" },
            { label: "NRR", value: "NRR" },
          ]}
          onChange={handleSnrOrNrrChange}
          disabled={disabled}
        />
        <Field
          label={`${snrOrNrr} Value (dB)`}
          value={snrValue}
          onChange={handleSnrValueChange}
          type="number"
          disabled={disabled}
          placeholder={snrOrNrr === "SNR" ? "e.g., 28" : "e.g., 25"}
          readOnly={readOnly}
          required={issued === "Yes"}
          error={getFieldError("snrValue", errors, touched)}
          warning={errors.snrValue && errors.snrValue.startsWith("⚠️") ? errors.snrValue : ""}
          success={issued === "Yes" && isFieldValid(snrValue, "snrValue", errors)}
          onBlur={() => handleBlur("snrValue")}
        />
        <SelectField<"" | "Good" | "Poor">
          label="Device Condition"
          value={condition}
          options={[
            { label: "Good 👍", value: "Good" },
            { label: "Poor 👎", value: "Poor" },
          ]}
          onChange={handleConditionChange}
          disabled={disabled}
        />
        {condition === "Poor" && !disabled && (
          <Field
            label="Comment on condition"
            value={conditionComment}
            onChange={handleConditionCommentChange}
            placeholder="e.g., Torn foam, degraded seal"
            readOnly={readOnly}
            required={true}
            error={getFieldError("conditionComment", errors, touched)}
            success={isFieldValid(conditionComment, "conditionComment", errors)}
            onBlur={() => handleBlur("conditionComment")}
          />
        )}
        <SelectField<"Yes" | "No">
          label="Training Provided?"
          value={training}
          options={[
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
          ]}
          onChange={handleTrainingChange}
          disabled={disabled}
        />
        <SelectField<"Yes" | "No">
          label="Devices Fitted Correctly?"
          value={fitting}
          options={[
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
          ]}
          onChange={handleFittingChange}
          disabled={disabled}
        />
        <SelectField<"Yes" | "No">
          label="Maintenance Plan?"
          value={maintenance}
          options={[
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
          ]}
          onChange={handleMaintenanceChange}
          disabled={disabled}
        />
      </div>

      {!readOnly && (
        <Button className="mt-4" onClick={addOrUpdateDevice} disabled={disabled}>
          {editingIndex !== null ? "Update Device" : "+ Add Device"}
        </Button>
      )}

      {/* Devices Table */}
      {devices.length > 0 && (
        <div className="overflow-x-auto mt-6">
          <h4 className="text-lg font-semibold mb-2">Hearing Protection Devices</h4>
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">Type</th>
                <th className="border px-2 py-1">Manufacturer</th>
                <th className="border px-2 py-1">SNR/NRR</th>
                <th className="border px-2 py-1">Value (dB)</th>
                {actualLex8h > 0 && (
                  <>
                    <th className="border px-2 py-1 bg-blue-50">Effective Atten.</th>
                    <th className="border px-2 py-1 bg-blue-50">Protected LEX,8h</th>
                    <th className="border px-2 py-1 bg-blue-50">Protected Zone</th>
                  </>
                )}
                <th className="border px-2 py-1">Condition</th>
                <th className="border px-2 py-1">Training</th>
                <th className="border px-2 py-1">Fitment</th>
                <th className="border px-2 py-1">Maint.</th>
                {!readOnly && <th className="border px-2 py-1">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {devices.map((d, idx) => {
                const snrVal = parseFloat(d.snrValue);
                const protectedLex = !isNaN(snrVal) && actualLex8h > 0
                  ? calculateProtectedExposure(actualLex8h, d.snrOrNrr, snrVal)
                  : 0;
                const effectiveAtten = !isNaN(snrVal) && actualLex8h > 0
                  ? actualLex8h - protectedLex
                  : 0;

                // Determine row color based on protected zone
                let rowBgColor = '';
                let protectedZoneLabel = '';
                let protectedZoneBadge = '';

                if (protectedLex > 0) {
                  if (protectedLex >= 87) {
                    rowBgColor = 'bg-red-50';
                    protectedZoneLabel = 'Red Zone';
                    protectedZoneBadge = 'bg-red-100 text-red-800';
                  } else if (protectedLex >= 85) {
                    rowBgColor = 'bg-orange-50';
                    protectedZoneLabel = 'Orange Zone';
                    protectedZoneBadge = 'bg-orange-100 text-orange-800';
                  } else {
                    rowBgColor = 'bg-green-50';
                    protectedZoneLabel = 'Green Zone';
                    protectedZoneBadge = 'bg-green-100 text-green-800';
                  }
                }

                return (
                  <tr key={idx} className={`border-t ${rowBgColor}`}>
                    <td className="border px-2 py-1">{d.type}</td>
                    <td className="border px-2 py-1">{d.manufacturer}</td>
                    <td className="border px-2 py-1">{d.snrOrNrr}</td>
                    <td className="border px-2 py-1 text-center font-medium">{d.snrValue} dB</td>
                    {actualLex8h > 0 && (
                      <>
                        <td className="border px-2 py-1 text-center font-medium bg-blue-50">
                          {effectiveAtten > 0 ? `-${effectiveAtten.toFixed(1)} dB` : '—'}
                        </td>
                        <td className="border px-2 py-1 text-center font-bold bg-blue-50">
                          {protectedLex > 0 ? `${protectedLex.toFixed(1)} dB(A)` : '—'}
                        </td>
                        <td className="border px-2 py-1 text-center bg-blue-50">
                          {protectedLex > 0 ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${protectedZoneBadge}`}>
                              {protectedZoneLabel}
                            </span>
                          ) : '—'}
                        </td>
                      </>
                    )}
                    <td className="border px-2 py-1 text-center">
                      {d.condition === 'Good' ? '✅ Good' : '⚠️ Poor'}
                    </td>
                    <td className="border px-2 py-1 text-center">{d.training}</td>
                    <td className="border px-2 py-1 text-center">{d.fitting}</td>
                    <td className="border px-2 py-1 text-center">{d.maintenance}</td>
                    {!readOnly && (
                      <td className="border px-2 py-1">
                        <div className="flex flex-col gap-1">
                          <Button variant="secondary" onClick={() => handleEdit(idx)}>Edit</Button>
                          <Button variant="danger" onClick={() => handleDelete(idx)}>Delete</Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Device Table Legend */}
          {actualLex8h > 0 && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-xs">
              <p className="font-semibold mb-1">📊 Protection Analysis Key:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold">Effective Attenuation:</span> Derated attenuation per SANS 10083 (SNR-4 or (NRR-7)/2)
                </div>
                <div>
                  <span className="font-semibold">Protected LEX,8h:</span> Exposure level after applying hearing protection
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Zones:</span>
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">&lt;85</span>
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-medium">85-87</span>
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium">≥87</span>
                </div>
                <div>
                  <span className="font-semibold text-red-600">⚠️ Note:</span> Red/Orange rows indicate inadequate protection - upgrade HPD or implement controls
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={onPrev}>Back</Button>
        {!readOnly && (
          <Button variant="success" onClick={onNext} disabled={isNextDisabled}>Next</Button>
        )}
        {readOnly && (
          <Button variant="secondary" onClick={onNext}>Next</Button>
        )}
      </div>

      {!readOnly && (
        <ConfirmDialog
          open={confirmOpen}
          title="Confirm Action"
          message={confirmMessage}
          onConfirm={confirmCallback}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </Section>
  );
}