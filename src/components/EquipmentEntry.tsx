// src/components/EquipmentEntry.tsx
import React, { useState, useEffect } from "react";
import { SurveyData, Equipment } from "./types";
import Section from "./common/Section";
import Field from "./common/Field";
import SelectField from "./common/SelectField";
import Button from "./common/Button";
import ConfirmDialog from "./common/ConfirmDialog";
import { isStepValid } from "./helpers";
import { validateEquipment, validateEquipmentList, getFieldError, isFieldValid } from "../utils/validation";

type EquipmentType = "" | "SLM" | "Calibrator";

export default function EquipmentEntry({
  data,
  onChange,
  onPrev,
  onNext,
  onSave,
  onDetails,
  readOnly = false,
}: {
  data: SurveyData;
  onChange: (patch: Partial<SurveyData>) => void;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
  onDetails?: (areaId: string) => void
  readOnly?: boolean;
}) {
  const [temp, setTemp] = useState<Equipment>({
    id: "",
    type: "",
    name: "",
    serial: "",
    weighting: "A",
    responseImpulse: "Impulse",
    responseLEQ: "LEQ",
    pre: "",
    during: "",
    post: "",
    areaRef: "",
    startDate: "",
    endDate: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Validation state ---
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [equipmentListError, setEquipmentListError] = useState<string>("");

  // Validate equipment form on temp change
  useEffect(() => {
    const validation = validateEquipment(temp);
    setErrors(validation.errors);
  }, [temp]);

  // Validate equipment list
  useEffect(() => {
    const listValidation = validateEquipmentList(data.equipment);
    setEquipmentListError(listValidation.errors.equipment || "");
  }, [data.equipment]);

  // Handle field blur
  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  };

  // --- ConfirmDialog state ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<() => void>(() => {});

  const handleDeleteConfirm = (callback: () => void, message: string) => {
    setConfirmMessage(message);
    setConfirmCallback(() => () => {
      callback();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const handleSaveConfirm = () => {
    setConfirmMessage("Save changes to this survey?");
    setConfirmCallback(() => () => {
      onSave();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const resetForm = () => {
    setTemp({
      id: "",
      type: "",
      name: "",
      serial: "",
      weighting: "A",
      responseImpulse: "Impulse",
      responseLEQ: "LEQ",
      pre: "",
      during: "",
      post: "",
      areaRef: "",
      startDate: "",
      endDate: "",
    });
    setEditingId(null);
  };

  const addOrUpdateEquipment = () => {
    // Mark all fields as touched to show errors
    setTouched({
      type: true,
      name: true,
      serial: true,
      pre: true,
      post: true,
      during: true,
      calibrationDate: true,
    });

    // Validate the equipment
    const validation = validateEquipment(temp);

    // If there are errors, don't save
    if (!validation.isValid) {
      return;
    }

    if (editingId) {
      const updated = data.equipment.map((eq) =>
        eq.id === editingId ? { ...temp, id: editingId } : eq
      );
      onChange({ equipment: updated });
    } else {
      const newEq: Equipment = { ...temp, id: Date.now().toString() };
      onChange({ equipment: [...data.equipment, newEq] });
    }

    // Reset validation state
    setTouched({});
    resetForm();
  };

  const editEquipment = (eq: Equipment) => {
    setTemp(eq);
    setEditingId(eq.id);
  };

  const deleteEquipment = (eqId: string) => {
    const eq = data.equipment.find((e) => e.id === eqId);
    const name = eq?.name || "this equipment";

    handleDeleteConfirm(() => {
      const updated = data.equipment.filter((eq) => eq.id !== eqId);
      onChange({ equipment: updated });
      if (editingId === eqId) resetForm();
    }, `Are you sure you want to permanently delete "${name}"?`);
  };

  const valid = isStepValid(2, data);

  // Helper function to calculate equipment calibration status
  const getEquipmentStatus = (eq: Equipment): {
    status: 'good' | 'warning' | 'error';
    message: string;
    icon: string;
  } => {
    if (eq.type === "SLM") {
      // Check calibration drift
      if (eq.pre && eq.post) {
        const drift = Math.abs(parseFloat(eq.pre) - parseFloat(eq.post));
        if (drift > 1.0) {
          return {
            status: 'error',
            message: `Drift: ${drift.toFixed(1)} dB (exceeds ±1 dB limit)`,
            icon: '❌'
          };
        } else if (drift > 0.5) {
          return {
            status: 'warning',
            message: `Drift: ${drift.toFixed(1)} dB (acceptable)`,
            icon: '⚠️'
          };
        } else {
          return {
            status: 'good',
            message: `Drift: ${drift.toFixed(1)} dB (excellent)`,
            icon: '✅'
          };
        }
      }
      return { status: 'warning', message: 'No calibration data', icon: '⚠️' };
    }

    if (eq.type === "Calibrator") {
      // Check calibration certificate date
      if (eq.calibrationDate) {
        const calDate = new Date(eq.calibrationDate);
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        if (calDate < oneYearAgo) {
          const monthsOld = Math.floor((today.getTime() - calDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          return {
            status: 'error',
            message: `Certificate expired (${monthsOld} months old)`,
            icon: '❌'
          };
        } else {
          const monthsRemaining = Math.floor((calDate.getTime() + (365 * 24 * 60 * 60 * 1000) - today.getTime()) / (1000 * 60 * 60 * 24 * 30));
          if (monthsRemaining < 2) {
            return {
              status: 'warning',
              message: `Expiring soon (${monthsRemaining} months remaining)`,
              icon: '⚠️'
            };
          }
          return {
            status: 'good',
            message: `Valid (${monthsRemaining} months remaining)`,
            icon: '✅'
          };
        }
      }
      return { status: 'warning', message: 'No calibration date', icon: '⚠️' };
    }

    return { status: 'good', message: 'OK', icon: '✅' };
  };

  // Calculate equipment health summary
  const equipmentSummary = {
    total: data.equipment.length,
    good: data.equipment.filter(eq => getEquipmentStatus(eq).status === 'good').length,
    warning: data.equipment.filter(eq => getEquipmentStatus(eq).status === 'warning').length,
    error: data.equipment.filter(eq => getEquipmentStatus(eq).status === 'error').length,
  };

  return (
    <Section title="">
      {/* --- Header --- */}
      <div className="flex justify-center mb-6 relative">
        <h2 className="text-xl font-bold text-center">Equipment Entry</h2>
        <div className="absolute right-0 text-sm text-gray-600 text-right">
          <div>
            <span className="font-bold">Client:</span> {data.client || "—"}
          </div>
          <div>
            <span className="font-bold">Project:</span> {data.project || "—"}
          </div>
        </div>
      </div>

      {/* Equipment Health Summary */}
      {data.equipment.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-bold mb-2">Equipment Health Status</h3>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Total:</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{equipmentSummary.total}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">✅ Good:</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded">{equipmentSummary.good}</span>
            </div>
            {equipmentSummary.warning > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold">⚠️ Warnings:</span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">{equipmentSummary.warning}</span>
              </div>
            )}
            {equipmentSummary.error > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold">❌ Issues:</span>
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">{equipmentSummary.error}</span>
              </div>
            )}
          </div>
          {equipmentSummary.error > 0 && (
            <p className="mt-2 text-sm text-red-700">
              ⚠️ Some equipment has calibration issues. Please review and recalibrate as needed.
            </p>
          )}
        </div>
      )}

      {/* --- Equipment Type - ALWAYS VISIBLE BUT DISABLED IN VIEW MODE --- */}
      <div className="flex gap-4 mb-4">
        <div className="w-1/2">
          <SelectField
            label="Equipment Type"
            value={temp.type}
            options={[
              { label: "SLM", value: "SLM" },
              { label: "Calibrator", value: "Calibrator" },
            ]}
            onChange={(val: string) =>
              setTemp((t) => ({
                ...t,
                type: val as EquipmentType,
                weighting: val === "SLM" ? "A" : "",
                responseImpulse: val === "SLM" ? "Impulse" : "",
                responseLEQ: val === "SLM" ? "LEQ" : "",
              }))
            }
            disabled={editingId !== null || readOnly}
          />
        </div>
      </div>

      {temp.type && !readOnly && (
        <>
          {/* Name & Serial */}
          <div className="flex gap-4 mb-4">
            <div className="w-1/2">
              <Field
                label="Device Name"
                value={temp.name}
                onChange={(val) => setTemp({ ...temp, name: val })}
                placeholder="e.g., SLM 2250"
                disabled={readOnly}
                required={true}
                error={getFieldError("name", errors, touched)}
                success={isFieldValid(temp.name, "name", errors)}
                onBlur={() => handleBlur("name")}
              />
            </div>
            <div className="w-1/2">
              <Field
                label="Serial Number"
                value={temp.serial}
                onChange={(val) => setTemp({ ...temp, serial: val })}
                placeholder="e.g., SN123456"
                disabled={readOnly}
                required={true}
                error={getFieldError("serial", errors, touched)}
                success={isFieldValid(temp.serial, "serial", errors)}
                onBlur={() => handleBlur("serial")}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="flex gap-4 mb-4">
            <div className="w-1/2">
              <Field
                label="Start Date"
                type="date"
                value={temp.startDate || ""}
                onChange={(val) => setTemp({ ...temp, startDate: val })}
                placeholder=""
                disabled={readOnly}
              />
            </div>
            <div className="w-1/2">
              <Field
                label="End Date"
                type="date"
                value={temp.endDate || ""}
                onChange={(val) => setTemp({ ...temp, endDate: val })}
                placeholder=""
                disabled={readOnly}
              />
            </div>
          </div>

          {/* SLM Settings */}
          {temp.type === "SLM" && (
            <>
              <h4 className="text-md font-bold underline mb-2">SETTINGS:</h4>
              <div className="flex gap-4 mb-4">
                <div className="w-1/3">
                  <SelectField
                    label="Weighting"
                    value={temp.weighting}
                    options={[
                      { label: "A", value: "A" },
                      { label: "C", value: "C" },
                      { label: "Z", value: "Z" },
                    ]}
                    onChange={(val) =>
                      setTemp({ ...temp, weighting: val as "A" | "C" | "Z" })
                    }
                    disabled={readOnly}
                  />
                </div>
                <div className="w-1/3">
                  <SelectField
                    label="Response Impulse"
                    value={temp.responseImpulse}
                    options={[
                      { label: "Impulse", value: "Impulse" },
                      { label: "Fast", value: "Fast" },
                      { label: "Slow", value: "Slow" },
                      { label: "Peak", value: "Peak" },
                    ]}
                    onChange={(val) =>
                      setTemp({
                        ...temp,
                        responseImpulse: val as "Impulse" | "Fast" | "Slow" | "Peak",
                      })
                    }
                    disabled={readOnly}
                  />
                </div>
                <div className="w-1/3">
                  <SelectField
                    label="LEQ/SPL"
                    value={temp.responseLEQ}
                    options={[
                      { label: "LEQ", value: "LEQ" },
                      { label: "SPL", value: "SPL" },
                    ]}
                    onChange={(val) =>
                      setTemp({ ...temp, responseLEQ: val as "LEQ" | "SPL" })
                    }
                    disabled={readOnly}
                  />
                </div>
              </div>
            </>
          )}

          {/* Calibrator Settings */}
          {temp.type === "Calibrator" && (
            <>
              {/* Calibration Date */}
              <div className="mb-4">
                <Field
                  label="Calibration Certificate Date"
                  type="date"
                  value={temp.calibrationDate || ""}
                  onChange={(val) => setTemp({ ...temp, calibrationDate: val })}
                  placeholder=""
                  disabled={readOnly}
                  required={true}
                  error={getFieldError("calibrationDate", errors, touched)}
                  warning={errors.calibrationDate && errors.calibrationDate.startsWith("⚠️") ? errors.calibrationDate : ""}
                  success={isFieldValid(temp.calibrationDate, "calibrationDate", errors)}
                  onBlur={() => handleBlur("calibrationDate")}
                />
                <p className="text-xs text-gray-500 mt-1">
                  ℹ️ Calibration certificates are typically valid for 1 year. You will receive a warning if the certificate is expired or expiring soon.
                </p>
              </div>

              <h4 className="text-md font-bold underline mb-2">REFERENCE SPL:</h4>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <Field
                  label="Pre (dB)"
                  type="number"
                  value={temp.pre}
                  onChange={(val) => setTemp({ ...temp, pre: val })}
                  placeholder=""
                  disabled={readOnly}
                />
                <Field
                  label="During (dB)"
                  type="number"
                  value={temp.during}
                  onChange={(val) => setTemp({ ...temp, during: val })}
                  placeholder=""
                  disabled={readOnly}
                  warning={getFieldError("during", errors, touched)}
                  onBlur={() => handleBlur("during")}
                />
                <Field
                  label="Post (dB)"
                  type="number"
                  value={temp.post}
                  onChange={(val) => setTemp({ ...temp, post: val })}
                  placeholder=""
                  disabled={readOnly}
                />
                <Field
                  label="Area Ref (dB)"
                  type="number"
                  value={temp.areaRef}
                  onChange={(val) => setTemp({ ...temp, areaRef: val })}
                  placeholder=""
                  disabled={readOnly}
                />
              </div>

              {/* Calibration drift warning */}
              {errors.calibrationDrift && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm font-medium">
                    {errors.calibrationDrift}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Add/Update Buttons */}
          <div className="flex justify-end gap-2 mb-4">
            {editingId && (
              <Button variant="secondary" onClick={resetForm}>
                Cancel Edit
              </Button>
            )}
            <Button
              onClick={addOrUpdateEquipment}
              disabled={!temp.type || !temp.name || readOnly}
            >
              {editingId ? "Update Equipment" : "+ Add Equipment"}
            </Button>
          </div>
        </>
      )}

      {/* Equipment Table */}
      {data.equipment.length > 0 &&
        ["SLM", "Calibrator"].map((type) => {
          const eqOfType = data.equipment.filter((eq) => eq.type === type);
          if (!eqOfType.length) return null;

          return (
            <div key={type} className="mb-4">
              <h4 className="text-md font-semibold mb-2">{type}</h4>
              <table className="min-w-full border border-gray-200 rounded-md text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 border-b text-center">#</th>
                    <th className="px-3 py-2 border-b text-center">Device</th>
                    <th className="px-3 py-2 border-b text-center">Serial</th>
                    {type === "SLM" && (
                      <>
                        <th className="px-3 py-2 border-b text-center">Pre (dB)</th>
                        <th className="px-3 py-2 border-b text-center">Post (dB)</th>
                        <th className="px-3 py-2 border-b text-center">Drift</th>
                        <th className="px-3 py-2 border-b text-center">Weighting</th>
                        <th className="px-3 py-2 border-b text-center">Response</th>
                      </>
                    )}
                    {type === "Calibrator" && (
                      <>
                        <th className="px-3 py-2 border-b text-center">Cal. Date</th>
                        <th className="px-3 py-2 border-b text-center">Pre</th>
                        <th className="px-3 py-2 border-b text-center">During</th>
                        <th className="px-3 py-2 border-b text-center">Post</th>
                      </>
                    )}
                    <th className="px-3 py-2 border-b text-center">Status</th>
                    {!readOnly && (
                      <th className="px-3 py-2 border-b text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {eqOfType.map((eq, i) => {
                    const status = getEquipmentStatus(eq);
                    const rowBgColor =
                      status.status === 'error' ? 'bg-red-50' :
                      status.status === 'warning' ? 'bg-yellow-50' :
                      'hover:bg-gray-50';

                    return (
                      <tr key={eq.id} className={rowBgColor}>
                        <td className="px-3 py-2 text-center">{i + 1}</td>
                        <td className="px-3 py-2 text-center font-medium">{eq.name}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-600">{eq.serial}</td>
                        {type === "SLM" && (
                          <>
                            <td className="px-3 py-2 text-center">
                              {eq.pre ? parseFloat(eq.pre).toFixed(1) : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {eq.post ? parseFloat(eq.post).toFixed(1) : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {eq.pre && eq.post ? (
                                <span className={`font-medium ${
                                  Math.abs(parseFloat(eq.pre) - parseFloat(eq.post)) > 1.0
                                    ? 'text-red-600'
                                    : Math.abs(parseFloat(eq.pre) - parseFloat(eq.post)) > 0.5
                                    ? 'text-yellow-600'
                                    : 'text-green-600'
                                }`}>
                                  {Math.abs(parseFloat(eq.pre) - parseFloat(eq.post)).toFixed(1)}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">{eq.weighting}</td>
                            <td className="px-3 py-2 text-center text-xs">{eq.responseImpulse}</td>
                          </>
                        )}
                        {type === "Calibrator" && (
                          <>
                            <td className="px-3 py-2 text-center text-xs">
                              {eq.calibrationDate ? new Date(eq.calibrationDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">{eq.pre || '—'}</td>
                            <td className="px-3 py-2 text-center">{eq.during || '—'}</td>
                            <td className="px-3 py-2 text-center">{eq.post || '—'}</td>
                          </>
                        )}
                        <td className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg">{status.icon}</span>
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              status.status === 'error' ? 'bg-red-100 text-red-800' :
                              status.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {status.status === 'error' ? 'Issue' :
                               status.status === 'warning' ? 'Warning' : 'Good'}
                            </span>
                            <span className="text-xs text-gray-600" title={status.message}>
                              {status.message.split('(')[0].trim()}
                            </span>
                          </div>
                        </td>
                        {!readOnly && (
                          <td className="px-3 py-2 text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="success"
                                onClick={() => editEquipment(eq)}
                                disabled={editingId !== null}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => deleteEquipment(eq.id)}
                                disabled={editingId !== null}
                              >
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
          );
        })}

      {/* Navigation */}
      <div className="flex justify-between mb-4">
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
        <div className="flex flex-col items-end gap-2">
          {!readOnly ? (
            <div className="flex gap-2">
              <Button
                onClick={handleSaveConfirm}
                disabled={!valid || editingId !== null || data.equipment.length === 0}
                variant="primary"
              >
                Save
              </Button>
              <Button
                onClick={onNext}
                disabled={!valid || editingId !== null || data.equipment.length === 0}
                variant="success"
              >
                Next
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={onNext}>
              Next
            </Button>
          )}

          {!readOnly && editingId !== null && (
            <p className="text-sm text-red-600 flex items-start">
              <span className="mr-1">⚠️</span>
              <span>Finish editing the equipment before saving or continuing.</span>
            </p>
          )}
          {!readOnly && equipmentListError && editingId === null && (
            <p className="text-sm text-red-600 flex items-start">
              <span className="mr-1">⚠️</span>
              <span>{equipmentListError}</span>
            </p>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Action"
        message={confirmMessage}
        onConfirm={confirmCallback}
        onCancel={() => setConfirmOpen(false)}
      />
    </Section>
  );
}