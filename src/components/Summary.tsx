// src/components/Summary.tsx
import React, { useState, useMemo } from "react";
import { SurveyData, Area } from "./types";
import Section from "./common/Section";
import Actions from "./common/Actions";
import Button from "./common/Button";
import { buildSummary, buildWordContent } from "./helpers";
import { Document, Packer, Paragraph, Table } from "docx";
import { saveAs } from "file-saver";
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(ArcElement, Tooltip, Legend);

interface SummaryProps {
  data: SurveyData;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  readOnly?: boolean;
}

export default function Summary({ data, onPrev, onNext, onReset, readOnly = false }: SummaryProps) {
  const handleDownload = async () => {
    // Load logo from public folder
    let logoBuffer: ArrayBuffer | undefined;
    try {
      const response = await fetch("/Gijima-Logo.png");
      if (response.ok) {
        logoBuffer = await response.arrayBuffer();
      }
    } catch (err) {
      console.warn("Logo not found, continuing without it.");
    }

    // Build Word content
    const wordChildren: (Paragraph | Table)[] = await buildWordContent(data, logoBuffer);

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: wordChildren,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "survey-summary.docx");
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    // Total Areas (including subareas)
    const calculateTotalAreas = (areas: Area[]): number => {
      if (!areas || areas.length === 0) return 0;
      return areas.reduce((total, area) => {
        return total + 1 + (area.subAreas ? calculateTotalAreas(area.subAreas) : 0);
      }, 0);
    };

    // Total Equipment
    const totalEquipment = data.equipment ? data.equipment.length : 0;

    // Total Noise Sources (across all areas)
    const totalNoiseSources = data.noiseSourcesByArea 
      ? Object.values(data.noiseSourcesByArea).reduce((total, sources) => total + sources.length, 0)
      : 0;

    // Total Measurements (across all areas)
    const totalMeasurements = data.measurementsByArea
      ? Object.values(data.measurementsByArea).reduce((total, measurements) => total + measurements.length, 0)
      : 0;

    // Total Controls (areas with at least one control)
    const totalControls = data.controlsByArea
      ? Object.values(data.controlsByArea).filter(control => 
          control && (control.engineering || 
          (control.adminControls && control.adminControls.length > 0) || 
          control.customAdmin)
        ).length
      : 0;

    // Total Hearing Protection Devices
    const totalHPD = data.hearingProtectionDevices
      ? Object.values(data.hearingProtectionDevices).reduce((total, devices) => total + devices.length, 0)
      : 0;

    // Total Exposures (areas with exposure data)
    const totalExposures = data.exposuresByArea
      ? Object.values(data.exposuresByArea).filter(exposure => exposure !== null).length
      : 0;

    // Total Comments (areas with comments)
    const totalComments = data.commentsByArea
      ? Object.values(data.commentsByArea).filter(comment => comment !== null && comment.trim() !== "").length
      : 0;

    return {
      totalAreas: calculateTotalAreas(data.areas || []),
      totalEquipment,
      totalNoiseSources,
      totalMeasurements,
      totalControls,
      totalHPD,
      totalExposures,
      totalComments
    };
  }, [data]);

  const { 
    totalAreas, 
    totalEquipment, 
    totalNoiseSources, 
    totalMeasurements, 
    totalControls, 
    totalHPD, 
    totalExposures, 
    totalComments 
  } = statistics;

  // Render Project Info
  const renderProjectInfo = () => (
    <div className="mb-6">
      <div className="font-bold mb-1 text-blue-900 text-lg">Project Information</div>
      <div className="overflow-x-auto">
        <table className="min-w-[350px] border text-xs">
          <tbody>
            <tr><td className="border px-2 py-1 font-semibold">Client</td><td className="border px-2 py-1">{data.client}</td></tr>
            <tr><td className="border px-2 py-1 font-semibold">Project</td><td className="border px-2 py-1">{data.project}</td></tr>
            <tr><td className="border px-2 py-1 font-semibold">Site</td><td className="border px-2 py-1">{data.site}</td></tr>
            <tr><td className="border px-2 py-1 font-semibold">Survey Type</td><td className="border px-2 py-1">{data.surveyType}</td></tr>
            <tr><td className="border px-2 py-1 font-semibold">Start Date</td><td className="border px-2 py-1">{data.startDate}</td></tr>
            <tr><td className="border px-2 py-1 font-semibold">End Date</td><td className="border px-2 py-1">{data.endDate}</td></tr>
            <tr><td className="border px-2 py-1 font-semibold">Description</td><td className="border px-2 py-1">{data.description}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render Equipment Used Table
  const renderEquipmentUsedTable = () => (
    <div className="mb-6">
      <div className="font-bold mb-1 text-blue-900 text-lg">Equipment Used</div>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-xs">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Type</th>
              <th className="border px-2 py-1">Serial</th>
              <th className="border px-2 py-1">Calibration Start Date</th>
              <th className="border px-2 py-1">Calibration End Date</th>
              <th className="border px-2 py-1">Area Ref</th>
            </tr>
          </thead>
          <tbody>
            {data.equipment && data.equipment.length > 0 ? data.equipment.map((eq, i) => (
              <tr key={eq.id}>
                <td className="border px-2 py-1">{i + 1}</td>
                <td className="border px-2 py-1">{eq.name}</td>
                <td className="border px-2 py-1">{eq.type}</td>
                <td className="border px-2 py-1">{eq.serial}</td>
                <td className="border px-2 py-1">{eq.startDate || "N/A"}</td>
                <td className="border px-2 py-1">{eq.endDate || "N/A"}</td>
                <td className="border px-2 py-1">{eq.areaRef || "Global"}</td>
              </tr>
            )) : <tr><td colSpan={7} className="text-center">No equipment</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAreasSurveyedTable = () => {
    // Helper to recursively render area rows with indentation
    const renderAreaRows = (areas: Area[], prefix = "", level = 0): React.ReactNode[] => {
      if (!areas || areas.length === 0) return [];
      return areas.flatMap((ar, i) => {
        const numbering = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        const row = (
          <tr key={numbering + ar.name}>
            <td className="border px-2 py-1">{numbering}</td>
            <td className="border px-2 py-1" style={{ paddingLeft: `${level * 20}px` }}>{ar.name}</td>
          </tr>
        );
        const children = ar.subAreas ? renderAreaRows(ar.subAreas, numbering, level + 1) : [];
        return [row, ...children];
      });
    };
    return (
      <div className="mb-8">
        <div className="font-bold mb-1 text-blue-900 text-lg">Areas Surveyed</div>
        <div className="overflow-x-auto">
          <table className="min-w-[300px] border text-xs">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="border px-2 py-1">#</th>
                <th className="border px-2 py-1">Area Name</th>
              </tr>
            </thead>
            <tbody>
              {data.areas && data.areas.length > 0 ? renderAreaRows(data.areas) : <tr><td colSpan={2} className="text-center">No areas</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Helper to get area path as string (e.g. 1.2.1 Area Name)
  const getAreaPath = (area: Area, numbering: string) => `${numbering} ${area.name}`;

  // Helper to reconstruct area path from numbering (e.g. '1.2.1')
  const getAreaPathObject = (numbering: string) => {
    const parts = numbering.split('.').map((n) => parseInt(n, 10) - 1);
    const [main, sub, ss] = parts;
    const path: any = { main };
    if (sub !== undefined) path.sub = sub;
    if (ss !== undefined) path.ss = ss;
    return path;
  };

  // Utility: check if area or any subarea has data
  const areaHasData = (area: Area, numbering: string): boolean => {
    const areaKey = JSON.stringify(getAreaPathObject(numbering));
    const hasData = (
      (data.noiseSourcesByArea && data.noiseSourcesByArea[areaKey] && data.noiseSourcesByArea[areaKey].length > 0) ||
      (data.measurementsByArea && data.measurementsByArea[areaKey] && data.measurementsByArea[areaKey].length > 0) ||
      (data.controlsByArea && data.controlsByArea[areaKey] && (
        data.controlsByArea[areaKey].engineering ||
        (data.controlsByArea[areaKey].adminControls && data.controlsByArea[areaKey].adminControls.length > 0) ||
        data.controlsByArea[areaKey].customAdmin
      )) ||
      (data.hearingProtectionDevices && data.hearingProtectionDevices[areaKey] && data.hearingProtectionDevices[areaKey].length > 0) ||
      (data.exposuresByArea && data.exposuresByArea[areaKey]) ||
      (data.commentsByArea && data.commentsByArea[areaKey])
    );
    if (hasData) return true;
    if (area.subAreas && area.subAreas.length > 0) {
      return area.subAreas.some((sub, idx) => areaHasData(sub, numbering + "." + (idx + 1)));
    }
    return false;
  };

  // Collapsible Area Details
  const AreaDropdown = ({ area, numbering, level }: { area: Area, numbering: string, level: number }) => {
    const [open, setOpen] = useState(false);
    const areaKey = JSON.stringify(getAreaPathObject(numbering));
    // Check if this area itself has data (not just subareas)
    const hasOwnData = (
      (data.noiseSourcesByArea && data.noiseSourcesByArea[areaKey] && data.noiseSourcesByArea[areaKey].length > 0) ||
      (data.measurementsByArea && data.measurementsByArea[areaKey] && data.measurementsByArea[areaKey].length > 0) ||
      (data.controlsByArea && data.controlsByArea[areaKey] && (
        data.controlsByArea[areaKey].engineering ||
        (data.controlsByArea[areaKey].adminControls && data.controlsByArea[areaKey].adminControls.length > 0) ||
        data.controlsByArea[areaKey].customAdmin
      )) ||
      (data.hearingProtectionDevices && data.hearingProtectionDevices[areaKey] && data.hearingProtectionDevices[areaKey].length > 0) ||
      (data.exposuresByArea && data.exposuresByArea[areaKey]) ||
      (data.commentsByArea && data.commentsByArea[areaKey])
    );
    // Only render if this area or any subarea has data
    if (!areaHasData(area, numbering)) return null;
    return (
      <div key={numbering + area.name} className="mb-4" style={{ marginLeft: `${level * 16}px` }}>
        <button
          className={`w-full text-left px-4 py-2 rounded bg-blue-100 hover:bg-blue-200 font-semibold flex items-center justify-between`}
          onClick={() => setOpen((o) => !o)}
        >
          <span>{numbering}. {area.name}</span>
          <span className="ml-2">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="border-l-2 border-blue-300 pl-4 mt-2">
            {hasOwnData && renderAreaTables(area, numbering, level)}
            {area.subAreas && area.subAreas.length > 0 && area.subAreas.map((sub, idx) => (
              <AreaDropdown key={numbering + "." + (idx + 1) + sub.name} area={sub} numbering={numbering + "." + (idx + 1)} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render tables for a single area (only if it has data)
  const renderAreaTables = (area: Area, numbering: string, level: number) => {
    const areaKey = JSON.stringify(getAreaPathObject(numbering));
    const noiseSources = (data.noiseSourcesByArea && data.noiseSourcesByArea[areaKey]) || [];
    const measurements = (data.measurementsByArea && data.measurementsByArea[areaKey]) || [];
    const controls = (data.controlsByArea && data.controlsByArea[areaKey]) || null;
    const devices = (data.hearingProtectionDevices && data.hearingProtectionDevices[areaKey]) || [];
    const ex = (data.exposuresByArea && data.exposuresByArea[areaKey]) || null;
    const c = (data.commentsByArea && data.commentsByArea[areaKey]) || null;
    return (
      <>
        {/* Noise Sources */}
        {noiseSources.length > 0 && (
          <div className="overflow-x-auto mt-2">
            <div className="font-bold mb-1">Noise Sources</div>
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="border px-2 py-1">Yes/No</th>
                  <th className="border px-2 py-1">Source</th>
                  <th className="border px-2 py-1">Description</th>
                  <th className="border px-2 py-1">Measurement Time Interval</th>
                </tr>
              </thead>
              <tbody>
                {noiseSources.map((s, idx) => (
                  <tr key={areaKey + "-ns-" + idx}>
                    <td className="border px-2 py-1">{s.type ? "Yes" : "No"}</td>
                    <td className="border px-2 py-1">{s.source}</td>
                    <td className="border px-2 py-1">{s.description}</td>
                    <td className="border px-2 py-1">{s.mit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Measurement */}
        {measurements.length > 0 && (
          <div className="overflow-x-auto mt-2">
            <div className="font-bold mb-1">Measurement</div>
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="border px-2 py-1">Shift Duration</th>
                  <th className="border px-2 py-1">Exposure Time</th>
                  <th className="border px-2 py-1">Measurement Position</th>
                  <th className="border px-2 py-1">Measurement Readings</th>
                  <th className="border px-2 py-1">SLM ID</th>
                  <th className="border px-2 py-1">Calibrator ID (Class 1)</th>
                </tr>
              </thead>
              <tbody>
                {measurements.flatMap((m, idx) => (
                  m.readings && m.readings.length > 0 ?
                    m.readings.map((reading, rIdx) => {
                      const posLabel = String.fromCharCode(65 + rIdx);
                      return (
                        <tr key={areaKey + "-m-" + idx + "-" + rIdx}>
                          <td className="border px-2 py-1">{m.shiftDuration}</td>
                          <td className="border px-2 py-1">{m.exposureTime}</td>
                          <td className="border px-2 py-1">{posLabel}</td>
                          <td className="border px-2 py-1">{reading}</td>
                          <td className="border px-2 py-1">{m.slmId}</td>
                          <td className="border px-2 py-1">{m.calibratorId}</td>
                        </tr>
                      );
                    }) :
                    [<tr key={areaKey + "-m-" + idx}>
                      <td className="border px-2 py-1">{m.shiftDuration}</td>
                      <td className="border px-2 py-1">{m.exposureTime}</td>
                      <td className="border px-2 py-1">-</td>
                      <td className="border px-2 py-1">-</td>
                      <td className="border px-2 py-1">{m.slmId}</td>
                      <td className="border px-2 py-1">{m.calibratorId}</td>
                    </tr>]
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Controls */}
        <div className="overflow-x-auto mt-2">
          <div className="font-bold mb-1">Controls</div>
          {controls && (controls.engineering || (controls.adminControls && controls.adminControls.length > 0) || controls.customAdmin) ? (
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="border px-2 py-1">Engineering Controls</th>
                  <th className="border px-2 py-1">Administrative Controls</th>
                  <th className="border px-2 py-1">Custom Admin Control</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1">{controls.engineering ? "Yes" : "No"}</td>
                  <td className="border px-2 py-1">{controls.adminControls && controls.adminControls.length > 0 ? controls.adminControls.join(", ") : "No"}</td>
                  <td className="border px-2 py-1">{controls.customAdmin ? controls.customAdmin : "N/A"}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="text-xs text-gray-500 italic">No controls recorded for this area.</div>
          )}
        </div>
        {/* Hearing Protection Devices */}
        <div className="overflow-x-auto mt-2">
          <div className="font-bold mb-1">Hearing Protection Devices</div>
          {devices.length > 0 ? (
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="border px-2 py-1">Yes/No</th>
                  <th className="border px-2 py-1">Type</th>
                  <th className="border px-2 py-1">Manufacturer</th>
                  <th className="border px-2 py-1">SNR/NRR</th>
                  <th className="border px-2 py-1">SNR/NRR Value</th>
                  <th className="border px-2 py-1">Device Condition</th>
                  <th className="border px-2 py-1">Training</th>
                  <th className="border px-2 py-1">Fitment</th>
                  <th className="border px-2 py-1">Maintenance</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d, idx) => (
                  <tr key={areaKey + "-hp-" + idx}>
                    <td className="border px-2 py-1">{d && d.type ? "Yes" : "No"}</td>
                    <td className="border px-2 py-1">{d.type || "N/A"}</td>
                    <td className="border px-2 py-1">{d.manufacturer || "N/A"}</td>
                    <td className="border px-2 py-1">{d.snrOrNrr || "N/A"}</td>
                    <td className="border px-2 py-1">{d.snrValue || "N/A"}</td>
                    <td className="border px-2 py-1">{d.condition || "N/A"}</td>
                    <td className="border px-2 py-1">{d.training || "N/A"}</td>
                    <td className="border px-2 py-1">{d.fitting || "N/A"}</td>
                    <td className="border px-2 py-1">{d.maintenance || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-xs text-gray-500 italic">No hearing protection devices recorded for this area.</div>
          )}
        </div>
        {/* Exposures */}
        {ex && (
          <div className="overflow-x-auto mt-2">
            <div className="font-bold mb-1">Exposures</div>
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="border px-2 py-1">Concomitant Exposures</th>
                  <th className="border px-2 py-1">Elaboration</th>
                  <th className="border px-2 py-1">Prohibited Activities</th>
                  <th className="border px-2 py-1">Elaboration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1">{ex.exposure}</td>
                  <td className="border px-2 py-1">{ex.exposureDetail}</td>
                  <td className="border px-2 py-1">{ex.prohibited}</td>
                  <td className="border px-2 py-1">{ex.prohibitedDetail}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {/* Comments */}
        {c && (
          <div className="overflow-x-auto mt-2">
            <div className="font-bold mb-1">Comments</div>
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="border px-2 py-1">Comment</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1">{c}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  return (
    <Section title="Survey Summary">
      <div className="summary-container p-4">
        {renderProjectInfo()}
        {renderEquipmentUsedTable()}
        {renderAreasSurveyedTable()}

        {/* Area Details Section */}
        <div className="mb-8">
          <div className="font-bold mb-4 text-blue-900 text-lg">Area Details</div>
          {data.areas && data.areas.length > 0 ? (
            data.areas.map((area, idx) => (
              <AreaDropdown 
                key={area.name + idx} 
                area={area} 
                numbering={(idx + 1).toString()} 
                level={0} 
              />
            ))
          ) : (
            <div className="text-gray-500 italic">No areas defined</div>
          )}
        </div>

        {/* --- Survey Statistics --- */}
        <div className="mb-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Survey Statistics
            </h2>
            <p className="text-gray-600 text-sm">Overview of collected survey data</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Areas Card */}
            <div className="group bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-5 text-center flex flex-col justify-center min-h-[120px] hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="text-3xl font-bold text-blue-700 mb-2 group-hover:scale-110 transition-transform duration-300">{totalAreas}</div>
              <div className="text-sm font-semibold text-blue-800">Areas</div>
            </div>
            
            {/* Equipment Card */}
            <div className="group bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200 rounded-xl p-5 text-center flex flex-col justify-center min-h-[120px] hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="text-3xl font-bold text-indigo-700 mb-2 group-hover:scale-110 transition-transform duration-300">{totalEquipment}</div>
              <div className="text-sm font-semibold text-indigo-800">Equipment</div>
            </div>
            
            {/* Noise Sources Card */}
            <div className="group bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-5 text-center flex flex-col justify-center min-h-[120px] hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="text-3xl font-bold text-gray-700 mb-2 group-hover:scale-110 transition-transform duration-300">{totalNoiseSources}</div>
              <div className="text-sm font-semibold text-gray-800">Noise Sources</div>
            </div>
            
            {/* Measurements Card */}
            <div className="group bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-5 text-center flex flex-col justify-center min-h-[120px] hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="text-3xl font-bold text-green-700 mb-2 group-hover:scale-110 transition-transform duration-300">{totalMeasurements}</div>
              <div className="text-sm font-semibold text-green-800">Measurements</div>
            </div>
            
            {/* Controls Card */}
            <div className="group bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-5 text-center flex flex-col justify-center min-h-[120px] hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="text-3xl font-bold text-purple-700 mb-2 group-hover:scale-110 transition-transform duration-300">{totalControls}</div>
              <div className="text-sm font-semibold text-purple-800">Controls</div>
            </div>
            
            {/* Hearing Protection Card */}
            <div className="group bg-gradient-to-br from-pink-50 to-pink-100 border-2 border-pink-200 rounded-xl p-5 text-center flex flex-col justify-center min-h-[120px] hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="text-3xl font-bold text-pink-700 mb-2 group-hover:scale-110 transition-transform duration-300">{totalHPD}</div>
              <div className="text-sm font-semibold text-pink-800">Hearing Protection</div>
            </div>
            
            {/* Exposures Card */}
            <div className="group bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl p-5 text-center flex flex-col justify-center min-h-[120px] hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="text-3xl font-bold text-orange-700 mb-2 group-hover:scale-110 transition-transform duration-300">{totalExposures}</div>
              <div className="text-sm font-semibold text-orange-800">Exposures</div>
            </div>
            
            {/* Comments Card */}
            <div className="group bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl p-5 text-center flex flex-col justify-center min-h-[120px] hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="text-3xl font-bold text-yellow-700 mb-2 group-hover:scale-110 transition-transform duration-300">{totalComments}</div>
              <div className="text-sm font-semibold text-yellow-800">Comments</div>
            </div>
          </div>
        </div>
        {/* --- End Survey Statistics --- */}

        <Actions>
          <Button variant="secondary" onClick={onPrev}>
            Back
          </Button>
          <Button 
            variant={readOnly ? "secondary" : "success"} 
            onClick={onNext}
          >
            Next
          </Button>
        </Actions>
      </div>
    </Section>
  );
}