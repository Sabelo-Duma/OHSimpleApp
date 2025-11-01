// src/components/EquipmentEntry.tsx
import React, { useState } from "react";
import { SurveyData, Equipment } from "./types";
import Section from "./common/Section";
import Field from "./common/Field";
import SelectField from "./common/SelectField";
import Button from "./common/Button";
import ConfirmDialog from "./common/ConfirmDialog";
import { isStepValid } from "./helpers";

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
    if (!temp.type || !temp.name) return;

    if (editingId) {
      const updated = data.equipment.map((eq) =>
        eq.id === editingId ? { ...temp, id: editingId } : eq
      );
      onChange({ equipment: updated });
    } else {
      const newEq: Equipment = { ...temp, id: Date.now().toString() };
      onChange({ equipment: [...data.equipment, newEq] });
    }

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
              />
            </div>
            <div className="w-1/2">
              <Field
                label="Serial Number"
                value={temp.serial}
                onChange={(val) => setTemp({ ...temp, serial: val })}
                placeholder="e.g., SN123456"
                disabled={readOnly}
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
                    {type === "SLM" && (
                      <>
                        <th className="px-3 py-2 border-b text-center">Weighting</th>
                        <th className="px-3 py-2 border-b text-center">Response</th>
                        <th className="px-3 py-2 border-b text-center">LEQ/SPL</th>
                      </>
                    )}
                    {type === "Calibrator" && (
                      <>
                        <th className="px-3 py-2 border-b text-center">Pre</th>
                        <th className="px-3 py-2 border-b text-center">During</th>
                        <th className="px-3 py-2 border-b text-center">Post</th>
                        <th className="px-3 py-2 border-b text-center">Area Ref</th>
                      </>
                    )}
                    {!readOnly && (
                      <th className="px-3 py-2 border-b text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {eqOfType.map((eq, i) => (
                    <tr key={eq.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center">{i + 1}</td>
                      <td className="px-3 py-2 text-center">{eq.name}</td>
                      {type === "SLM" && (
                        <>
                          <td className="px-3 py-2 text-center">{eq.weighting}</td>
                          <td className="px-3 py-2 text-center">{eq.responseImpulse}</td>
                          <td className="px-3 py-2 text-center">{eq.responseLEQ}</td>
                        </>
                      )}
                      {type === "Calibrator" && (
                        <>
                          <td className="px-3 py-2 text-center">{eq.pre}</td>
                          <td className="px-3 py-2 text-center">{eq.during}</td>
                          <td className="px-3 py-2 text-center">{eq.post}</td>
                          <td className="px-3 py-2 text-center">{eq.areaRef}</td>
                        </>
                      )}
                      {!readOnly && (
                        <td className="px-3 py-2 text-center flex justify-center gap-2">
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
                        </td>
                      )}
                    </tr>
                  ))}
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
            <p className="text-sm text-red-500">
              Finish editing the equipment before saving or continuing.
            </p>
          )}
          {!readOnly && data.equipment.length === 0 && editingId === null && (
            <p className="text-sm text-red-500">
              Please add at least one equipment before continuing.
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