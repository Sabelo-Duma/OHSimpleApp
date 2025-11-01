// src/components/AreaAndNoise.tsx
import React, { useState } from "react";
import { SurveyData, Area } from "./types";
import Section from "./common/Section";
import Field from "./common/Field";
import Button from "./common/Button";
import Actions from "./common/Actions";
import ConfirmDialog from "./common/ConfirmDialog";
import { isStepValid } from "./helpers";

interface AreaAndNoiseProps {
  data: SurveyData;
  onChange: (patch: Partial<SurveyData>) => void;
  onPrev: () => void;
  onNext: () => void;
  onSave?: () => void;
  onOpenDetails?: (path: { main: number; sub?: number; ss?: number }) => void;
  readOnly?: boolean;
}

export default function AreaAndNoise({
  data,
  onChange,
  onPrev,
  onNext,
  onSave,
  onOpenDetails,
  readOnly = false,
}: AreaAndNoiseProps) {
  const emptyArea: Area = {
    id: "",
    name: "",
    process: "",
    noiseLevelDb: undefined,
    noiseType: "",
    shiftDuration: undefined,
    exposureTime: undefined,
    notes: "",
    detailsCompleted: false,
    subAreas: [],
  };

  const [mainTemp, setMainTemp] = useState<Area>({ ...emptyArea });
  const [editMainIndex, setEditMainIndex] = useState<number | null>(null);
  const [subTemp, setSubTemp] = useState<Area>({ ...emptyArea });
  const [editSubIndex, setEditSubIndex] = useState<number | null>(null);
  const [subSubTemp, setSubSubTemp] = useState<Area>({ ...emptyArea });
  const [editSubSubIndex, setEditSubSubIndex] = useState<number | null>(null);

  const [openMainIndex, setOpenMainIndex] = useState<number | null>(null);
  const [openSubIndex, setOpenSubIndex] = useState<number | null>(null);
  const [openSubSubIndex, setOpenSubSubIndex] = useState<{
    main: number;
    sub: number;
    ss: number;
  } | null>(null);

  const [addingSubIndex, setAddingSubIndex] = useState<number | null>(null);
  const [addingSubSubIndex, setAddingSubSubIndex] = useState<{
    main: number;
    sub: number;
  } | null>(null);

  const isEditing =
    editMainIndex !== null || editSubIndex !== null || editSubSubIndex !== null;

  // Confirm dialog state
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

  // Helper function to shift data down when areas are deleted
  const shiftDataDown = (
    dataByArea: Record<string, any> | undefined, 
    deletedIndex: number | { mainIdx: number; subIdx: number } | { mainIdx: number; subIdx: number; ssIdx: number }, 
    level: 'main' | 'sub' | 'ss'
  ): Record<string, any> => {
    if (!dataByArea) return {};
    
    const shifted: Record<string, any> = {};
    Object.entries(dataByArea).forEach(([key, value]) => {
      try {
        const path = JSON.parse(key);
        
        if (level === 'main' && typeof deletedIndex === 'number') {
          if (path.main > deletedIndex) {
            // Shift this data down by one position
            const newKey = JSON.stringify({ ...path, main: path.main - 1 });
            shifted[newKey] = value;
          } else if (path.main < deletedIndex) {
            // Keep data for areas before the deleted one
            shifted[key] = value;
          }
          // Skip data for the deleted area (path.main === deletedIndex)
        } 
        else if (level === 'sub' && typeof deletedIndex === 'object' && 'mainIdx' in deletedIndex && 'subIdx' in deletedIndex) {
          if (path.main === deletedIndex.mainIdx && path.sub !== undefined) {
            if (path.sub > deletedIndex.subIdx) {
              // Shift this sub-area data down by one position
              const newKey = JSON.stringify({ ...path, sub: path.sub - 1 });
              shifted[newKey] = value;
            } else if (path.sub < deletedIndex.subIdx) {
              // Keep data for sub-areas before the deleted one
              shifted[key] = value;
            }
            // Skip data for the deleted sub-area (path.sub === deletedIndex.subIdx)
          } else {
            // Keep data for other main areas
            shifted[key] = value;
          }
        }
        else if (level === 'ss' && typeof deletedIndex === 'object' && 'mainIdx' in deletedIndex && 'subIdx' in deletedIndex && 'ssIdx' in deletedIndex) {
          if (path.main === deletedIndex.mainIdx && path.sub === deletedIndex.subIdx && path.ss !== undefined) {
            if (path.ss > deletedIndex.ssIdx) {
              // Shift this sub-sub-area data down by one position
              const newKey = JSON.stringify({ ...path, ss: path.ss - 1 });
              shifted[newKey] = value;
            } else if (path.ss < deletedIndex.ssIdx) {
              // Keep data for sub-sub-areas before the deleted one
              shifted[key] = value;
            }
            // Skip data for the deleted sub-sub-area (path.ss === deletedIndex.ssIdx)
          } else {
            // Keep data for other areas
            shifted[key] = value;
          }
        } else {
          // Keep data that doesn't match the deletion pattern
          shifted[key] = value;
        }
      } catch (error) {
        // Keep invalid keys as-is
        shifted[key] = value;
      }
    });
    return shifted;
  };

  // --- Save Functions (Immutable) ---
  const saveMainArea = () => {
    if (!mainTemp.name || !mainTemp.process) return;

    const updatedAreas =
      editMainIndex !== null
        ? data.areas.map((area, idx) =>
            idx === editMainIndex ? { ...area, ...mainTemp } : area
          )
        : [...data.areas, { ...mainTemp, subAreas: [] }];

    onChange({ areas: updatedAreas });
    setMainTemp({ ...emptyArea });
    setEditMainIndex(null);
  };

  const saveSubArea = (mainIdx: number) => {
    if (!subTemp.name) return;

    const updatedAreas = data.areas.map((area, idx) => {
      if (idx !== mainIdx) return area;

      const updatedSubAreas =
        area.subAreas?.map((sub, sIdx) =>
          sIdx === editSubIndex ? { ...sub, ...subTemp } : sub
        ) || [];

      if (editSubIndex === null) {
        updatedSubAreas.push({ ...subTemp, subAreas: [] });
      }

      return { ...area, subAreas: updatedSubAreas };
    });

    onChange({ areas: updatedAreas });
    setSubTemp({ ...emptyArea });
    setEditSubIndex(null);
    setAddingSubIndex(null);
  };

  const saveSubSubArea = (mainIdx: number, subIdx: number) => {
    if (!subSubTemp.name) return;

    const updatedAreas = data.areas.map((area, idx) => {
      if (idx !== mainIdx) return area;

      const updatedSubAreas = area.subAreas?.map((sub, sIdx) => {
        if (sIdx !== subIdx) return sub;

        const updatedSubSubAreas =
          sub.subAreas?.map((ss, ssIdx) =>
            ssIdx === editSubSubIndex ? { ...ss, ...subSubTemp } : ss
          ) || [];

        if (editSubSubIndex === null) {
          updatedSubSubAreas.push({ ...subSubTemp });
        }

        return { ...sub, subAreas: updatedSubSubAreas };
      }) || [];

      return { ...area, subAreas: updatedSubAreas };
    });

    onChange({ areas: updatedAreas });
    setSubSubTemp({ ...emptyArea });
    setEditSubSubIndex(null);
    setAddingSubSubIndex(null);
  };

  // --- Edit / Delete Handlers ---
  const handleEditMain = (index: number) => {
    setMainTemp({ ...data.areas[index] });
    setEditMainIndex(index);
  };

  const handleDeleteMain = (index: number) => {
    handleDeleteConfirm(() => {
      const updatedAreas = data.areas.filter((_, i) => i !== index);
      
      // ✅ SHIFT DATA: Move all data from higher positions down by one
      const shiftedData = {
        // Shift noise sources
        noiseSourcesByArea: shiftDataDown(data.noiseSourcesByArea, index, 'main'),
        // Shift measurements
        measurementsByArea: shiftDataDown(data.measurementsByArea, index, 'main'),
        // Shift controls
        controlsByArea: shiftDataDown(data.controlsByArea, index, 'main'),
        // Shift hearing protection
        hearingProtectionDevices: shiftDataDown(data.hearingProtectionDevices, index, 'main'),
        hearingIssuedStatus: shiftDataDown(data.hearingIssuedStatus, index, 'main'),
        // Shift exposures
        exposuresByArea: shiftDataDown(data.exposuresByArea, index, 'main'),
        // Shift comments
        commentsByArea: shiftDataDown(data.commentsByArea, index, 'main'),
      };
      
      onChange({ 
        areas: updatedAreas, 
        ...shiftedData
      });
      if (openMainIndex === index) setOpenMainIndex(null);
    }, "Delete this Main Area?");
  };

  const handleEditSub = (mainIdx: number, subIdx: number) => {
    setSubTemp({ ...data.areas[mainIdx].subAreas![subIdx] });
    setEditSubIndex(subIdx);
    setAddingSubIndex(mainIdx);
  };

  const handleDeleteSub = (mainIdx: number, subIdx: number) => {
    handleDeleteConfirm(() => {
      const updatedAreas = data.areas.map((area, idx) => {
        if (idx !== mainIdx) return area;
        return {
          ...area,
          subAreas: area.subAreas?.filter((_, i) => i !== subIdx) || [],
        };
      });

      // ✅ SHIFT DATA for sub-areas
      const deletedIndex = { mainIdx, subIdx };
      const shiftedData = {
        noiseSourcesByArea: shiftDataDown(data.noiseSourcesByArea, deletedIndex, 'sub'),
        measurementsByArea: shiftDataDown(data.measurementsByArea, deletedIndex, 'sub'),
        controlsByArea: shiftDataDown(data.controlsByArea, deletedIndex, 'sub'),
        hearingProtectionDevices: shiftDataDown(data.hearingProtectionDevices, deletedIndex, 'sub'),
        hearingIssuedStatus: shiftDataDown(data.hearingIssuedStatus, deletedIndex, 'sub'),
        exposuresByArea: shiftDataDown(data.exposuresByArea, deletedIndex, 'sub'),
        commentsByArea: shiftDataDown(data.commentsByArea, deletedIndex, 'sub'),
      };
      
      onChange({ 
        areas: updatedAreas, 
        ...shiftedData
      });
      if (openSubIndex === subIdx) setOpenSubIndex(null);
    }, "Delete this Sub Area?");
  };

  const handleEditSubSub = (mainIdx: number, subIdx: number, ssIdx: number) => {
    setSubSubTemp({ ...data.areas[mainIdx].subAreas![subIdx].subAreas![ssIdx] });
    setEditSubSubIndex(ssIdx);
    setAddingSubSubIndex({ main: mainIdx, sub: subIdx });
  };

  const handleDeleteSubSub = (mainIdx: number, subIdx: number, ssIdx: number) => {
    handleDeleteConfirm(() => {
      const updatedAreas = data.areas.map((area, idx) => {
        if (idx !== mainIdx) return area;

        const updatedSubAreas = area.subAreas?.map((sub, sIdx) => {
          if (sIdx !== subIdx) return sub;
          return {
            ...sub,
            subAreas: sub.subAreas?.filter((_, i) => i !== ssIdx) || [],
          };
        }) || [];

        return { ...area, subAreas: updatedSubAreas };
      });

      // ✅ SHIFT DATA for sub-sub-areas
      const deletedIndex = { mainIdx, subIdx, ssIdx };
      const shiftedData = {
        noiseSourcesByArea: shiftDataDown(data.noiseSourcesByArea, deletedIndex, 'ss'),
        measurementsByArea: shiftDataDown(data.measurementsByArea, deletedIndex, 'ss'),
        controlsByArea: shiftDataDown(data.controlsByArea, deletedIndex, 'ss'),
        hearingProtectionDevices: shiftDataDown(data.hearingProtectionDevices, deletedIndex, 'ss'),
        hearingIssuedStatus: shiftDataDown(data.hearingIssuedStatus, deletedIndex, 'ss'),
        exposuresByArea: shiftDataDown(data.exposuresByArea, deletedIndex, 'ss'),
        commentsByArea: shiftDataDown(data.commentsByArea, deletedIndex, 'ss'),
      };

      onChange({ 
        areas: updatedAreas, 
        ...shiftedData
      });
      if (
        openSubSubIndex &&
        openSubSubIndex.main === mainIdx &&
        openSubSubIndex.sub === subIdx &&
        openSubSubIndex.ss === ssIdx
      )
        setOpenSubSubIndex(null);
    }, "Delete this Sub Sub-Area?");
  };

  // --- Details button ---
  const renderDetailsButton = (completed: boolean, onClick: () => void) => (
    <Button
      variant="secondary"
      className={`text-sm flex items-center gap-1 ${
        completed ? "text-green-600" : "text-red-600"
      }`}
      onClick={onClick}
    >
      <span className="font-bold text-xs">i</span> {completed ? "Completed" : "Details"}
    </Button>
  );

  // --- Count incomplete ---
  const countIncompleteAreas = (areas: Area[]): number => {
    let count = 0;
    for (const area of areas) {
      if ((area.subAreas?.length ?? 0) === 0 && !area.detailsCompleted) count++;
      if (area.subAreas) count += countIncompleteAreas(area.subAreas);
    }
    return count;
  };

  const incompleteCount = countIncompleteAreas(data.areas);
  const valid = isStepValid(3, data);

  const openDetails = (main: number, sub?: number, ss?: number) => {
    if (onOpenDetails) {
      onOpenDetails({ main, sub, ss });
    } else {
      const areaName =
        typeof ss === "number"
          ? data.areas[main]?.subAreas?.[sub!]?.subAreas?.[ss]?.name
          : typeof sub === "number"
          ? data.areas[main]?.subAreas?.[sub]?.name
          : data.areas[main]?.name;
      window.alert(
        `Details form not implemented yet. Would open details for "${areaName ?? "selected area"}".`
      );
    }
  };

  return (
    <Section title="">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 relative">
        <h2 className="text-xl font-bold absolute left-1/2 transform -translate-x-1/2">
          Area & Noise
        </h2>
        {(!!data.client || !!data.project) && (
          <div className="ml-auto text-sm text-gray-700 text-right">
            {data.client && (
              <div>
                <span className="font-bold">Client:</span> <span>{data.client}</span>
              </div>
            )}
            {data.project && (
              <div>
                <span className="font-bold">Project:</span> <span>{data.project}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Area Input - ALWAYS VISIBLE BUT DISABLED IN VIEW MODE */}
      <div className="flex gap-4 mb-4">
        <div className="w-1/2">
          <Field
            label="Main Area Name"
            value={mainTemp.name}
            onChange={(val) => setMainTemp((a) => ({ ...a, name: val }))}
            placeholder="Enter main area name"
            disabled={readOnly}
          />
        </div>
        <div className="w-1/2">
          <Field
            label="Process/Task Description"
            value={mainTemp.process || ""}
            onChange={(val) => setMainTemp((a) => ({ ...a, process: val }))}
            placeholder="Enter process/task description"
            disabled={readOnly}
          />
        </div>
      </div>

      <Button
        variant="primary"
        onClick={saveMainArea}
        disabled={!mainTemp.name || !mainTemp.process || readOnly}
      >
        {isEditing ? "Save Changes" : "+ Add Main Area"}
      </Button>

      {/* Render Areas */}
      {data.areas.map((main, mainIdx) => (
        <div key={mainIdx} className="mt-4 border rounded">
          {/* Main Area Header */}
          <button
            type="button"
            className="w-full flex justify-between items-center p-2 bg-gray-100 font-semibold"
            onClick={() =>
              setOpenMainIndex(openMainIndex === mainIdx ? null : mainIdx)
            }
          >
            <div className="flex flex-col items-start">
              <span>{main.name}</span>
              {main.process && (
                <span className="text-sm font-normal text-gray-600">
                  {main.process}
                </span>
              )}
            </div>
            <span>{openMainIndex === mainIdx ? "▼" : "▶"}</span>
          </button>

          {openMainIndex === mainIdx && (
            <div className="p-3 ml-4">
              <div className="flex gap-2 mb-2">
                <Button 
                  variant="secondary" 
                  onClick={() => setAddingSubIndex(mainIdx)}
                  disabled={readOnly}
                >
                  + Add Sub-Area
                </Button>
                {main.subAreas?.length === 0 &&
                  renderDetailsButton(!!main.detailsCompleted, () =>
                    openDetails(mainIdx)
                  )}
                <Button 
                  variant="secondary" 
                  onClick={() => handleEditMain(mainIdx)}
                  disabled={readOnly}
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleDeleteMain(mainIdx)}
                  disabled={readOnly}
                >
                  Delete
                </Button>
              </div>

              {(addingSubIndex === mainIdx || editSubIndex !== null) && (
                <div className="mt-2">
                  <Field
                    label="Sub-Area Name"
                    value={subTemp.name}
                    onChange={(val) => setSubTemp({ ...subTemp, name: val })}
                    placeholder="Enter sub-area name"
                    disabled={readOnly}
                  />
                  <Button
                    variant="primary"
                    onClick={() => saveSubArea(mainIdx)}
                    disabled={!subTemp.name || readOnly}
                  >
                    {editSubIndex !== null ? "Save Changes" : "+ Add Sub-Area"}
                  </Button>
                </div>
              )}

              {main.subAreas?.map((sub, subIdx) => (
                <div key={subIdx} className="ml-6 border rounded mt-2">
                  <button
                    type="button"
                    className="w-full flex justify-between items-center p-2 bg-gray-50 font-semibold"
                    onClick={() =>
                      setOpenSubIndex(openSubIndex === subIdx ? null : subIdx)
                    }
                  >
                    <div className="flex flex-col items-start">
                      <span>{sub.name}</span>
                      {sub.process && (
                        <span className="text-sm font-normal text-gray-600">
                          {sub.process}
                        </span>
                      )}
                    </div>
                    <span>{openSubIndex === subIdx ? "▼" : "▶"}</span>
                  </button>
                  {openSubIndex === subIdx && (
                    <div className="p-3 ml-4">
                      <div className="flex gap-2 mb-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setAddingSubSubIndex({ main: mainIdx, sub: subIdx })
                          }
                          disabled={readOnly}
                        >
                          + Add Sub-Sub Area
                        </Button>
                        {sub.subAreas?.length === 0 &&
                          renderDetailsButton(
                            !!sub.detailsCompleted,
                            () => openDetails(mainIdx, subIdx)
                          )}
                        <Button
                          variant="secondary"
                          onClick={() => handleEditSub(mainIdx, subIdx)}
                          disabled={readOnly}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleDeleteSub(mainIdx, subIdx)}
                          disabled={readOnly}
                        >
                          Delete
                        </Button>
                      </div>

                      {(addingSubSubIndex?.main === mainIdx &&
                        addingSubSubIndex.sub === subIdx) ||
                      editSubSubIndex !== null ? (
                        <div className="mt-2">
                          <Field
                            label="Sub-Sub Area Name"
                            value={subSubTemp.name}
                            onChange={(val) =>
                              setSubSubTemp({ ...subSubTemp, name: val })
                            }
                            placeholder="Enter sub-sub area name"
                            disabled={readOnly}
                          />
                          <Button
                            variant="primary"
                            onClick={() => saveSubSubArea(mainIdx, subIdx)}
                            disabled={!subSubTemp.name || readOnly}
                          >
                            {editSubSubIndex !== null
                              ? "Save Changes"
                              : "+ Add Sub-Sub Area"}
                          </Button>
                        </div>
                      ) : null}

                      {sub.subAreas?.map((ss, ssIdx) => (
                        <div key={ssIdx} className="ml-6 border rounded mt-2">
                          <button
                            type="button"
                            className="w-full flex justify-between items-center p-2 bg-gray-50 font-semibold"
                            onClick={() =>
                              setOpenSubSubIndex(
                                openSubSubIndex &&
                                  openSubSubIndex.main === mainIdx &&
                                  openSubSubIndex.sub === subIdx &&
                                  openSubSubIndex.ss === ssIdx
                                  ? null
                                  : { main: mainIdx, sub: subIdx, ss: ssIdx }
                              )
                            }
                          >
                            <div className="flex flex-col items-start">
                              <span>{ss.name}</span>
                              {ss.process && (
                                <span className="text-sm font-normal text-gray-600">
                                  {ss.process}
                                </span>
                              )}
                            </div>
                            <span>
                              {openSubSubIndex &&
                              openSubSubIndex.main === mainIdx &&
                              openSubSubIndex.sub === subIdx &&
                              openSubSubIndex.ss === ssIdx
                                ? "▼"
                                : "▶"}
                            </span>
                          </button>

                          {openSubSubIndex &&
                            openSubSubIndex.main === mainIdx &&
                            openSubSubIndex.sub === subIdx &&
                            openSubSubIndex.ss === ssIdx && (
                              <div className="p-3 ml-4 flex gap-2">
                                {renderDetailsButton(!!ss.detailsCompleted, () =>
                                  openDetails(mainIdx, subIdx, ssIdx)
                                )}
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    handleEditSubSub(mainIdx, subIdx, ssIdx)
                                  }
                                  disabled={readOnly}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    handleDeleteSubSub(mainIdx, subIdx, ssIdx)
                                  }
                                  disabled={readOnly}
                                >
                                  Delete
                                </Button>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Actions */}
      <Actions className="mt-8">
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
        <div className="flex flex-col items-end gap-2 ml-auto">
          {!readOnly ? (
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmMessage("Save changes to this survey?");
                  setConfirmCallback(() => () => {
                    onSave?.();
                    setConfirmOpen(false);
                  });
                  setConfirmOpen(true);
                }}
                disabled={!valid || data.areas.length === 0 || isEditing}
              >
                Save
              </Button>

              <Button
                variant="success"
                onClick={onNext}
                disabled={!valid || data.areas.length === 0 || incompleteCount > 0}
              >
                Generate Summary
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={onNext}>
              Next
            </Button>
          )}

          {!readOnly && data.areas.length === 0 && (
            <p className="text-sm text-red-500 text-right">
              Please add at least one Main Area before continuing.
            </p>
          )}
          {!readOnly && incompleteCount > 0 && (
            <p className="text-sm text-red-500 text-right">
              There is/are {incompleteCount} area(s) uncompleted, please complete areas to
              continue.
            </p>
          )}
        </div>
      </Actions>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Delete"
        message={confirmMessage}
        onConfirm={confirmCallback}
        onCancel={() => setConfirmOpen(false)}
      />
    </Section>
  );
}