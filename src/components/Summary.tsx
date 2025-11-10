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
import { validateSurvey, ValidationIssue } from "../utils/surveyValidation";
import { getAudiometrySummary } from "../utils/audiometryCalculations";
Chart.register(ArcElement, Tooltip, Legend);

interface SummaryProps {
  data: SurveyData;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  readOnly?: boolean;
}

export default function Summary({ data, onPrev, onNext, onReset, readOnly = false }: SummaryProps) {
  const [showValidationWarning, setShowValidationWarning] = useState(false);

  const handleNext = () => {
    // Check for critical issues
    if (!readOnly && validationResult.summary.criticalCount > 0) {
      setShowValidationWarning(true);
    } else {
      onNext();
    }
  };

  const handleDownload = async () => {
    // Build Word content
    const wordChildren: (Paragraph | Table)[] = await buildWordContent(data);

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

  // Validation Results
  const validationResult = useMemo(() => {
    return validateSurvey(data);
  }, [data]);

  // Render Validation Dashboard
  const renderValidationDashboard = () => {
    const { criticalIssues, warnings, info, summary } = validationResult;

    // Determine overall status
    const overallStatus = summary.criticalCount > 0 ? 'critical' :
                          summary.warningCount > 0 ? 'warning' :
                          'success';

    const statusConfig = {
      critical: {
        bg: 'bg-red-50',
        border: 'border-red-300',
        titleColor: 'text-red-900',
        icon: '🚨',
        message: 'CRITICAL ISSUES - Survey Incomplete',
        description: 'The following critical issues must be resolved before generating reports:'
      },
      warning: {
        bg: 'bg-orange-50',
        border: 'border-orange-300',
        titleColor: 'text-orange-900',
        icon: '⚠️',
        message: 'WARNINGS - Review Recommended',
        description: 'Survey is valid but has warnings that should be reviewed:'
      },
      success: {
        bg: 'bg-green-50',
        border: 'border-green-300',
        titleColor: 'text-green-900',
        icon: '✅',
        message: 'Survey Validation Passed',
        description: 'All required data has been collected and validated. Ready for report generation.'
      }
    };

    const config = statusConfig[overallStatus];

    // Render issue card
    const renderIssueCard = (issue: ValidationIssue, index: number) => {
      const severityConfig = {
        critical: { bg: 'bg-red-100', border: 'border-red-400', icon: '🔴', textColor: 'text-red-800' },
        warning: { bg: 'bg-orange-100', border: 'border-orange-400', icon: '🟠', textColor: 'text-orange-800' },
        info: { bg: 'bg-blue-100', border: 'border-blue-400', icon: '🔵', textColor: 'text-blue-800' }
      };

      const sConfig = severityConfig[issue.severity];

      return (
        <div key={index} className={`p-3 mb-2 border-l-4 ${sConfig.border} ${sConfig.bg} rounded-r`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">{sConfig.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold text-xs uppercase ${sConfig.textColor}`}>
                  {issue.category}
                </span>
                {issue.areaName && (
                  <span className="text-xs bg-white px-2 py-0.5 rounded border border-gray-300">
                    📍 {issue.areaName}
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-gray-900 mb-1">
                {issue.message}
              </div>
              <div className="text-xs text-gray-700 italic">
                💡 <span className="font-semibold">Recommendation:</span> {issue.recommendation}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className={`mb-8 p-6 border-2 rounded-lg ${config.border} ${config.bg}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`text-xl font-bold ${config.titleColor} flex items-center gap-2`}>
              <span>{config.icon}</span>
              <span>{config.message}</span>
            </h3>
            <p className="text-sm text-gray-700 mt-1">{config.description}</p>
          </div>
          <div className="flex gap-3">
            {summary.criticalCount > 0 && (
              <div className="text-center">
                <div className="text-3xl font-bold text-red-700">{summary.criticalCount}</div>
                <div className="text-xs text-red-600 font-semibold">Critical</div>
              </div>
            )}
            {summary.warningCount > 0 && (
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-700">{summary.warningCount}</div>
                <div className="text-xs text-orange-600 font-semibold">Warnings</div>
              </div>
            )}
            {summary.infoCount > 0 && (
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-700">{summary.infoCount}</div>
                <div className="text-xs text-blue-600 font-semibold">Info</div>
              </div>
            )}
            {summary.totalIssues === 0 && (
              <div className="text-center">
                <div className="text-3xl font-bold text-green-700">0</div>
                <div className="text-xs text-green-600 font-semibold">Issues</div>
              </div>
            )}
          </div>
        </div>

        {/* Critical Issues */}
        {criticalIssues.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-bold text-red-900 mb-2">🚨 Critical Issues ({criticalIssues.length})</h4>
            {criticalIssues.map((issue, idx) => renderIssueCard(issue, idx))}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-bold text-orange-900 mb-2">⚠️ Warnings ({warnings.length})</h4>
            {warnings.map((issue, idx) => renderIssueCard(issue, idx))}
          </div>
        )}

        {/* Info */}
        {info.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-bold text-blue-900 mb-2">ℹ️ Information ({info.length})</h4>
            {info.map((issue, idx) => renderIssueCard(issue, idx))}
          </div>
        )}

        {/* Success message */}
        {summary.totalIssues === 0 && (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <div className="text-lg font-semibold text-green-800 mb-2">
              Validation Complete - No Issues Found
            </div>
            <div className="text-sm text-green-700">
              All SANS 10083 requirements have been met. Survey is ready for report generation.
            </div>
          </div>
        )}
      </div>
    );
  };

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
    const employees = (data.employeesByArea && data.employeesByArea[areaKey]) || [];
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
        {/* Audiometry - Hearing Conservation Program */}
        {employees.length > 0 && (
          <div className="overflow-x-auto mt-2">
            <div className="font-bold mb-1">Audiometry - Hearing Conservation Program</div>
            <table className="min-w-full border text-xs">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="border px-2 py-1">#</th>
                  <th className="border px-2 py-1">Name</th>
                  <th className="border px-2 py-1">Emp No.</th>
                  <th className="border px-2 py-1">Job Title</th>
                  <th className="border px-2 py-1">Age</th>
                  <th className="border px-2 py-1">Baseline Test</th>
                  <th className="border px-2 py-1">Periodic Tests</th>
                  <th className="border px-2 py-1">STS Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => {
                  const age = emp.dateOfBirth ? Math.floor((new Date().getTime() - new Date(emp.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
                  const summary = getAudiometrySummary(emp);

                  return (
                    <tr key={emp.id} className={emp.hasSTS ? "bg-red-50" : ""}>
                      <td className="border px-2 py-1 text-center">{idx + 1}</td>
                      <td className="border px-2 py-1">{emp.firstName} {emp.lastName}</td>
                      <td className="border px-2 py-1">{emp.employeeNumber}</td>
                      <td className="border px-2 py-1">{emp.jobTitle}</td>
                      <td className="border px-2 py-1 text-center">{age}</td>
                      <td className="border px-2 py-1 text-center">
                        {emp.baselineTest ? (
                          <span className="text-green-700 font-medium">✓ {emp.baselineTest.testDate}</span>
                        ) : (
                          <span className="text-red-700 font-medium">✗ Missing</span>
                        )}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        {emp.periodicTests.length > 0 ? (
                          <span className="text-blue-700 font-medium">{emp.periodicTests.length} test(s)</span>
                        ) : (
                          <span className="text-gray-500">None</span>
                        )}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        {emp.hasSTS ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">
                            🚨 STS DETECTED
                          </span>
                        ) : summary?.hasBaseline ? (
                          <span className="text-green-700">✓ Normal</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
        {/* Validation Dashboard */}
        {renderValidationDashboard()}

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
            onClick={handleNext}
          >
            Next
          </Button>
        </Actions>

        {/* Validation Warning Dialog */}
        {showValidationWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-4xl">🚨</span>
                <div>
                  <h3 className="text-xl font-bold text-red-900 mb-2">
                    Critical Issues Detected
                  </h3>
                  <p className="text-sm text-gray-700 mb-2">
                    The survey has <span className="font-bold text-red-700">{validationResult.summary.criticalCount} critical issue(s)</span> that must be resolved before proceeding to report generation.
                  </p>
                  <p className="text-sm text-gray-700">
                    Please review the validation dashboard above and address all critical issues before continuing.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setShowValidationWarning(false)}>
                  Review Issues
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setShowValidationWarning(false);
                    onNext();
                  }}
                >
                  Proceed Anyway (Not Recommended)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}