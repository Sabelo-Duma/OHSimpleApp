// src/components/HearingProtectionForm.tsx
import React, { useState, useEffect, useRef } from "react";
import SelectField from "./common/SelectField";
import Field from "./common/Field";
import Button from "./common/Button";
import Section from "./common/Section";
import ConfirmDialog from "./common/ConfirmDialog";
import { SurveyData, Device, AreaPath } from "./types";

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
  const prevAreaRef = useRef<string>("");

  const getAreaKey = () => (selectedAreaPath ? JSON.stringify(selectedAreaPath) : "");

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
    
    if (!deviceType || !manufacturer || !snrValue || !condition) return;

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

    // Reset inputs
    setDeviceType("");
    setManufacturer("");
    setSnrOrNrr("SNR");
    setSnrValue("");
    setCondition("");
    setConditionComment("");
    setTraining("Yes");
    setFitting("Yes");
    setMaintenance("Yes");
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
          placeholder="Enter manufacturer"
          readOnly={readOnly}
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
          label={`${snrOrNrr} Value`} 
          value={snrValue} 
          onChange={handleSnrValueChange} 
          type="number" 
          disabled={disabled} 
          placeholder={`Enter ${snrOrNrr} value`}
          readOnly={readOnly}
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
            placeholder="Enter condition comment"
            readOnly={readOnly}
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
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th>Type</th>
                <th>Manufacturer</th>
                <th>SNR/NRR</th>
                <th>Value</th>
                <th>Condition</th>
                <th>Training</th>
                <th>Fitment</th>
                <th>Maintenance</th>
                {!readOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {devices.map((d, idx) => (
                <tr key={idx} className="border-t">
                  <td>{d.type}</td>
                  <td>{d.manufacturer}</td>
                  <td>{d.snrOrNrr}</td>
                  <td>{d.snrValue}</td>
                  <td>{d.condition}</td>
                  <td>{d.training}</td>
                  <td>{d.fitting}</td>
                  <td>{d.maintenance}</td>
                  {!readOnly && (
                    <td className="space-x-2">
                      <Button variant="secondary" onClick={() => handleEdit(idx)}>Edit</Button>
                      <Button variant="danger" onClick={() => handleDelete(idx)}>Delete</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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