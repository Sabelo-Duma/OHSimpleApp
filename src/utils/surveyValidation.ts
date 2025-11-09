// src/utils/surveyValidation.ts
// Cross-form validation utilities for survey data completeness and SANS 10083 compliance

import { SurveyData, AreaPath } from "../components/types";
import { calculateAverageLAeq, getExposureSummary, classifyNoiseZone } from "./noiseCalculations";
import { getProtectionSummary } from "./hearingProtectionCalculations";
import { getAudiometrySummary } from "./audiometryCalculations";

export type ValidationSeverity = 'critical' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  category: string;
  message: string;
  areaName?: string;
  areaPath?: AreaPath;
  recommendation: string;
}

export interface ValidationResult {
  isValid: boolean;
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  summary: {
    totalIssues: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
}

/**
 * Get area name from path
 */
function getAreaName(data: SurveyData, path: AreaPath): string {
  const main = data.areas[path.main];
  if (!main) return "Unknown Area";

  if (path.ss !== undefined && main.subAreas) {
    const sub = main.subAreas[path.sub!];
    const subSub = sub?.subAreas?.[path.ss];
    if (subSub) return `${main.name} > ${sub.name} > ${subSub.name}`;
    if (sub) return `${main.name} > ${sub.name}`;
  }

  if (path.sub !== undefined && main.subAreas) {
    const sub = main.subAreas[path.sub];
    if (sub) return `${main.name} > ${sub.name}`;
  }

  return main.name;
}

/**
 * Collect all leaf areas (areas without sub-areas)
 */
function collectLeafAreas(data: SurveyData): Array<{ path: AreaPath; name: string }> {
  const leafAreas: Array<{ path: AreaPath; name: string }> = [];

  data.areas.forEach((main, mainIdx) => {
    if (!main) return;

    const mainPath: AreaPath = { main: mainIdx };

    if (!main.subAreas || main.subAreas.length === 0) {
      leafAreas.push({ path: mainPath, name: main.name });
      return;
    }

    main.subAreas.forEach((sub, subIdx) => {
      if (!sub) return;

      const subPath: AreaPath = { main: mainIdx, sub: subIdx };

      if (!sub.subAreas || sub.subAreas.length === 0) {
        leafAreas.push({ path: subPath, name: `${main.name} > ${sub.name}` });
        return;
      }

      sub.subAreas.forEach((subSub, ssIdx) => {
        if (!subSub) return;

        const ssPath: AreaPath = { main: mainIdx, sub: subIdx, ss: ssIdx };
        leafAreas.push({ path: ssPath, name: `${main.name} > ${sub.name} > ${subSub.name}` });
      });
    });
  });

  return leafAreas;
}

/**
 * Validate equipment is defined and calibrated
 */
function validateEquipment(data: SurveyData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!data.equipment || data.equipment.length === 0) {
    issues.push({
      severity: 'critical',
      category: 'Equipment',
      message: 'No equipment defined',
      recommendation: 'Add at least one Sound Level Meter (SLM) and Calibrator in the Equipment step'
    });
    return issues;
  }

  // Check for at least one SLM
  const slmCount = data.equipment.filter(eq => eq.type === 'SLM').length;
  if (slmCount === 0) {
    issues.push({
      severity: 'critical',
      category: 'Equipment',
      message: 'No Sound Level Meter (SLM) defined',
      recommendation: 'Add at least one SLM to conduct noise measurements'
    });
  }

  // Check for at least one Calibrator
  const calibratorCount = data.equipment.filter(eq => eq.type === 'Calibrator').length;
  if (calibratorCount === 0) {
    issues.push({
      severity: 'critical',
      category: 'Equipment',
      message: 'No Calibrator defined',
      recommendation: 'Add at least one acoustic calibrator for field calibration'
    });
  }

  // Check calibration drift for SLMs
  data.equipment.filter(eq => eq.type === 'SLM').forEach(slm => {
    if (!slm.pre || !slm.post) {
      issues.push({
        severity: 'warning',
        category: 'Calibration',
        message: `SLM "${slm.name}" missing pre/post calibration readings`,
        recommendation: 'Record both pre and post-survey calibration readings'
      });
    } else {
      const drift = Math.abs(parseFloat(slm.pre) - parseFloat(slm.post));
      if (drift > 1.0) {
        issues.push({
          severity: 'critical',
          category: 'Calibration',
          message: `SLM "${slm.name}" calibration drift ${drift.toFixed(1)} dB exceeds ±1 dB limit`,
          recommendation: 'Equipment failed calibration check - measurements may be invalid. Re-measure with properly calibrated equipment.'
        });
      } else if (drift > 0.5) {
        issues.push({
          severity: 'warning',
          category: 'Calibration',
          message: `SLM "${slm.name}" calibration drift ${drift.toFixed(1)} dB is acceptable but elevated`,
          recommendation: 'Monitor equipment performance and consider servicing if drift persists'
        });
      }
    }
  });

  // Check calibrator certificate validity
  data.equipment.filter(eq => eq.type === 'Calibrator').forEach(cal => {
    if (!cal.calibrationDate) {
      issues.push({
        severity: 'warning',
        category: 'Calibration',
        message: `Calibrator "${cal.name}" missing calibration certificate date`,
        recommendation: 'Record calibration certificate date for traceability'
      });
    } else {
      const calDate = new Date(cal.calibrationDate);
      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      if (calDate < oneYearAgo) {
        issues.push({
          severity: 'critical',
          category: 'Calibration',
          message: `Calibrator "${cal.name}" calibration certificate expired`,
          recommendation: 'Obtain fresh calibration certificate from SANAS-accredited laboratory'
        });
      }
    }
  });

  return issues;
}

/**
 * Validate equipment usage - ensure all equipment referenced in measurements exists
 */
function validateEquipmentUsage(data: SurveyData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const equipmentIds = new Set(data.equipment.map(eq => eq.id));
  const leafAreas = collectLeafAreas(data);

  leafAreas.forEach(({ path, name }) => {
    const areaKey = JSON.stringify(path);
    const measurements = data.measurementsByArea?.[areaKey] || [];

    measurements.forEach((measurement, idx) => {
      if (measurement.slmId && !equipmentIds.has(measurement.slmId)) {
        issues.push({
          severity: 'critical',
          category: 'Equipment Reference',
          message: `Measurement #${idx + 1} references non-existent SLM`,
          areaName: name,
          areaPath: path,
          recommendation: 'Remove measurement or add the referenced equipment to the Equipment step'
        });
      }

      if (measurement.calibratorId && !equipmentIds.has(measurement.calibratorId)) {
        issues.push({
          severity: 'critical',
          category: 'Equipment Reference',
          message: `Measurement #${idx + 1} references non-existent Calibrator`,
          areaName: name,
          areaPath: path,
          recommendation: 'Remove measurement or add the referenced equipment to the Equipment step'
        });
      }
    });
  });

  return issues;
}

/**
 * Validate measurements exist and are complete
 */
function validateMeasurements(data: SurveyData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const leafAreas = collectLeafAreas(data);

  if (leafAreas.length === 0) {
    issues.push({
      severity: 'critical',
      category: 'Areas',
      message: 'No areas defined for measurement',
      recommendation: 'Add at least one area in the Areas & Noise step'
    });
    return issues;
  }

  let areasWithMeasurements = 0;

  leafAreas.forEach(({ path, name }) => {
    const areaKey = JSON.stringify(path);
    const measurements = data.measurementsByArea?.[areaKey] || [];

    if (measurements.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'Measurements',
        message: `No measurements recorded`,
        areaName: name,
        areaPath: path,
        recommendation: 'Add noise measurements in the Measurements step for this area'
      });
    } else {
      areasWithMeasurements++;

      // Validate each measurement has readings
      measurements.forEach((m, idx) => {
        if (!m.readings || m.readings.length === 0) {
          issues.push({
            severity: 'warning',
            category: 'Measurements',
            message: `Measurement #${idx + 1} has no noise readings`,
            areaName: name,
            areaPath: path,
            recommendation: 'Add at least one noise reading to this measurement'
          });
        }

        // Validate exposure time
        const exposureTime = parseFloat(m.exposureTime);
        const shiftDuration = parseFloat(m.shiftDuration);
        if (exposureTime > shiftDuration) {
          issues.push({
            severity: 'warning',
            category: 'Measurements',
            message: `Measurement #${idx + 1}: Exposure time (${exposureTime}h) exceeds shift duration (${shiftDuration}h)`,
            areaName: name,
            areaPath: path,
            recommendation: 'Verify exposure time and shift duration values'
          });
        }
      });
    }
  });

  if (areasWithMeasurements === 0) {
    issues.push({
      severity: 'critical',
      category: 'Measurements',
      message: 'No measurements recorded in any area',
      recommendation: 'Add noise measurements for at least one area'
    });
  }

  return issues;
}

/**
 * Validate controls exist for high-noise zones
 */
function validateControls(data: SurveyData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const leafAreas = collectLeafAreas(data);

  leafAreas.forEach(({ path, name }) => {
    const areaKey = JSON.stringify(path);
    const measurements = data.measurementsByArea?.[areaKey] || [];
    const controls = data.controlsByArea?.[areaKey];

    if (measurements.length === 0) return; // Skip areas without measurements

    // Calculate worst-case LEX,8h
    const exposureDataList = measurements.map(m => {
      const readingValues = m.readings?.map(r => parseFloat(r)).filter(v => !isNaN(v)) || [];
      const avgLAeq = calculateAverageLAeq(readingValues);
      const exposureTime = parseFloat(m.exposureTime) || parseFloat(m.shiftDuration) || 8;
      const shiftDuration = parseFloat(m.shiftDuration) || 8;
      return getExposureSummary(avgLAeq, exposureTime, shiftDuration);
    });

    const worstCase = exposureDataList.reduce((max, current) =>
      current.lex8h > max.lex8h ? current : max
    , exposureDataList[0]);

    if (!worstCase) return;

    const zone = worstCase.zone.zone;
    const lex8h = worstCase.lex8h;

    // Critical: Red Zone (≥87 dB) must have controls
    if (zone === 'red') {
      if (!controls || !controls.engineering) {
        issues.push({
          severity: 'critical',
          category: 'Controls',
          message: `RED ZONE (${lex8h.toFixed(1)} dB) - Engineering controls not documented`,
          areaName: name,
          areaPath: path,
          recommendation: 'MANDATORY: Document engineering controls (isolation, damping, barriers) for Red Zone areas'
        });
      }

      if (!controls || (controls.adminControls.length === 0 && !controls.customAdmin)) {
        issues.push({
          severity: 'critical',
          category: 'Controls',
          message: `RED ZONE (${lex8h.toFixed(1)} dB) - Administrative controls not documented`,
          areaName: name,
          areaPath: path,
          recommendation: 'MANDATORY: Document administrative controls (training, rotation, signage) for Red Zone areas'
        });
      }
    }

    // Warning: Orange Zone (85-87 dB) should have controls
    if (zone === 'orange') {
      if (!controls || !controls.engineering) {
        issues.push({
          severity: 'warning',
          category: 'Controls',
          message: `ORANGE ZONE (${lex8h.toFixed(1)} dB) - Engineering controls not documented`,
          areaName: name,
          areaPath: path,
          recommendation: 'RECOMMENDED: Investigate and document engineering controls for Orange Zone areas'
        });
      }

      if (!controls || (controls.adminControls.length === 0 && !controls.customAdmin)) {
        issues.push({
          severity: 'warning',
          category: 'Controls',
          message: `ORANGE ZONE (${lex8h.toFixed(1)} dB) - Administrative controls not documented`,
          areaName: name,
          areaPath: path,
          recommendation: 'REQUIRED: Document administrative controls for hearing conservation program'
        });
      }
    }
  });

  return issues;
}

/**
 * Validate hearing protection exists and is adequate for high-noise zones
 */
function validateHearingProtection(data: SurveyData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const leafAreas = collectLeafAreas(data);

  leafAreas.forEach(({ path, name }) => {
    const areaKey = JSON.stringify(path);
    const measurements = data.measurementsByArea?.[areaKey] || [];
    const devices = data.hearingProtectionDevices?.[areaKey] || [];
    const issuedStatus = data.hearingIssuedStatus?.[areaKey];

    if (measurements.length === 0) return; // Skip areas without measurements

    // Calculate worst-case LEX,8h
    const exposureDataList = measurements.map(m => {
      const readingValues = m.readings?.map(r => parseFloat(r)).filter(v => !isNaN(v)) || [];
      const avgLAeq = calculateAverageLAeq(readingValues);
      const exposureTime = parseFloat(m.exposureTime) || parseFloat(m.shiftDuration) || 8;
      const shiftDuration = parseFloat(m.shiftDuration) || 8;
      return getExposureSummary(avgLAeq, exposureTime, shiftDuration);
    });

    const worstCase = exposureDataList.reduce((max, current) =>
      current.lex8h > max.lex8h ? current : max
    , exposureDataList[0]);

    if (!worstCase) return;

    const zone = worstCase.zone.zone;
    const lex8h = worstCase.lex8h;

    // Critical: Red Zone (≥87 dB) MUST have hearing protection
    if (zone === 'red') {
      if (issuedStatus === 'No' || devices.length === 0) {
        issues.push({
          severity: 'critical',
          category: 'Hearing Protection',
          message: `RED ZONE (${lex8h.toFixed(1)} dB) - NO hearing protection issued`,
          areaName: name,
          areaPath: path,
          recommendation: 'MANDATORY: Issue and document hearing protection devices for Red Zone (≥87 dB)'
        });
      } else {
        // Check adequacy
        const protectionSummary = getProtectionSummary(lex8h, devices);
        if (protectionSummary && !protectionSummary.adequacy.isAdequate) {
          issues.push({
            severity: 'critical',
            category: 'Hearing Protection',
            message: `RED ZONE (${lex8h.toFixed(1)} dB) - Hearing protection INADEQUATE (${protectionSummary.adequacy.level})`,
            areaName: name,
            areaPath: path,
            recommendation: protectionSummary.adequacy.recommendations[0] || 'Upgrade to higher attenuation HPD'
          });
        } else if (protectionSummary && protectionSummary.adequacy.level === 'marginal') {
          issues.push({
            severity: 'warning',
            category: 'Hearing Protection',
            message: `RED ZONE (${lex8h.toFixed(1)} dB) - Hearing protection MARGINAL (protected LEX,8h: ${protectionSummary.protectedLex8h.toFixed(1)} dB)`,
            areaName: name,
            areaPath: path,
            recommendation: 'Consider upgrading to higher attenuation HPD for additional safety margin'
          });
        }

        // Check device condition
        const poorDevices = devices.filter(d => d.condition === 'Poor');
        if (poorDevices.length > 0) {
          issues.push({
            severity: 'warning',
            category: 'Hearing Protection',
            message: `${poorDevices.length} hearing protection device(s) in poor condition`,
            areaName: name,
            areaPath: path,
            recommendation: 'Replace damaged or worn hearing protection devices immediately'
          });
        }

        // Check training
        const untrainedDevices = devices.filter(d => d.training === 'No');
        if (untrainedDevices.length > 0) {
          issues.push({
            severity: 'warning',
            category: 'Hearing Protection',
            message: 'Employees not trained on HPD use',
            areaName: name,
            areaPath: path,
            recommendation: 'Provide training on correct fitting and use of hearing protection'
          });
        }
      }
    }

    // Warning: Orange Zone (85-87 dB) should have hearing protection
    if (zone === 'orange') {
      if (issuedStatus === 'No' || devices.length === 0) {
        issues.push({
          severity: 'warning',
          category: 'Hearing Protection',
          message: `ORANGE ZONE (${lex8h.toFixed(1)} dB) - Hearing protection not issued`,
          areaName: name,
          areaPath: path,
          recommendation: 'RECOMMENDED: Issue hearing protection for hearing conservation program'
        });
      }
    }
  });

  return issues;
}

/**
 * Validate audiometry / hearing conservation program per SANS 10083
 */
function validateAudiometry(data: SurveyData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const leafAreas = collectLeafAreas(data);

  leafAreas.forEach(({ path, name }) => {
    const areaKey = JSON.stringify(path);
    const employees = data.employeesByArea?.[areaKey] || [];
    const measurements = data.measurementsByArea?.[areaKey] || [];

    // Calculate noise zone for this area
    let noiseZone: "green" | "orange" | "red" | null = null;
    if (measurements.length > 0) {
      // Calculate worst-case exposure
      const exposureDataList = measurements.map(m => {
        const readingValues = m.readings?.map(r => parseFloat(r)).filter(v => !isNaN(v)) || [];
        const avgLAeq = calculateAverageLAeq(readingValues);
        const exposureTime = parseFloat(m.exposureTime) || parseFloat(m.shiftDuration) || 8;
        const shiftDuration = parseFloat(m.shiftDuration) || 8;
        return getExposureSummary(avgLAeq, exposureTime, shiftDuration);
      });

      // Get worst case (highest LEX,8h)
      const worstCase = exposureDataList.reduce((max, curr) => curr.lex8h > max.lex8h ? curr : max);
      noiseZone = worstCase.zone.zone;
    }

    // RED ZONE (≥85 dB): Baseline audiograms CRITICAL
    if (noiseZone === "red") {
      if (employees.length === 0) {
        issues.push({
          severity: 'critical',
          category: 'Audiometry',
          message: `No employees enrolled in hearing conservation program`,
          areaName: name,
          areaPath: path,
          recommendation: 'Per SANS 10083, all employees exposed to ≥85 dB must be enrolled in hearing conservation program with baseline audiograms'
        });
      } else {
        // Check each employee for baseline
        employees.forEach(emp => {
          if (!emp.baselineTest) {
            issues.push({
              severity: 'critical',
              category: 'Audiometry',
              message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNumber}) lacks baseline audiogram in Red Zone (≥85 dB)`,
              areaName: name,
              areaPath: path,
              recommendation: 'Baseline audiogram required before noise exposure per SANS 10083'
            });
          }

          // Check annual testing for employees with baseline
          if (emp.baselineTest) {
            const baselineDate = new Date(emp.baselineTest.testDate);
            const oneYearLater = new Date(baselineDate);
            oneYearLater.setFullYear(baselineDate.getFullYear() + 1);

            // If baseline was more than a year ago and no periodic tests
            if (new Date() > oneYearLater && emp.periodicTests.length === 0) {
              issues.push({
                severity: 'warning',
                category: 'Audiometry',
                message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNumber}) overdue for annual audiogram`,
                areaName: name,
                areaPath: path,
                recommendation: 'Annual audiometric testing required per SANS 10083'
              });
            }
          }
        });
      }
    }

    // ORANGE ZONE (80-85 dB): Audiograms RECOMMENDED (warning)
    if (noiseZone === "orange") {
      if (employees.length === 0) {
        issues.push({
          severity: 'warning',
          category: 'Audiometry',
          message: `Consider enrolling employees in hearing conservation program`,
          areaName: name,
          areaPath: path,
          recommendation: 'Orange Zone (80-85 dB) approaching action level. Baseline audiograms recommended as preventive measure'
        });
      }
    }

    // STS Detection Follow-up
    employees.forEach(emp => {
      if (emp.hasSTS) {
        const summary = getAudiometrySummary(emp);

        if (summary?.stsDetails?.severity === 'severe') {
          issues.push({
            severity: 'critical',
            category: 'Audiometry - STS',
            message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNumber}) has SEVERE Standard Threshold Shift`,
            areaName: name,
            areaPath: path,
            recommendation: 'Immediate medical referral required. Remove from noise exposure until evaluation completed per SANS 10083'
          });
        } else if (summary?.stsDetails?.severity === 'moderate') {
          issues.push({
            severity: 'warning',
            category: 'Audiometry - STS',
            message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNumber}) has MODERATE Standard Threshold Shift`,
            areaName: name,
            areaPath: path,
            recommendation: 'Medical evaluation required within 30 days. Ensure proper use of hearing protection per SANS 10083'
          });
        } else {
          issues.push({
            severity: 'info',
            category: 'Audiometry - STS',
            message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNumber}) has Standard Threshold Shift (≥10 dB)`,
            areaName: name,
            areaPath: path,
            recommendation: 'Retest audiogram within 30 days to confirm. Review hearing protection effectiveness per SANS 10083'
          });
        }
      }
    });

    // Annual Testing Compliance Check
    employees.forEach(emp => {
      if (emp.periodicTests.length > 0) {
        const latestTest = emp.periodicTests[emp.periodicTests.length - 1];
        const testDate = new Date(latestTest.testDate);
        const oneYearLater = new Date(testDate);
        oneYearLater.setFullYear(testDate.getFullYear() + 1);

        if (new Date() > oneYearLater) {
          issues.push({
            severity: 'warning',
            category: 'Audiometry',
            message: `Employee ${emp.firstName} ${emp.lastName} (${emp.employeeNumber}) annual audiogram overdue`,
            areaName: name,
            areaPath: path,
            recommendation: 'Schedule annual audiogram immediately per SANS 10083'
          });
        }
      }
    });
  });

  return issues;
}

/**
 * Comprehensive survey validation
 */
export function validateSurvey(data: SurveyData): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  // Run all validations
  allIssues.push(...validateEquipment(data));
  allIssues.push(...validateEquipmentUsage(data));
  allIssues.push(...validateMeasurements(data));
  allIssues.push(...validateControls(data));
  allIssues.push(...validateHearingProtection(data));
  allIssues.push(...validateAudiometry(data));

  // Separate by severity
  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const info = allIssues.filter(i => i.severity === 'info');

  return {
    isValid: criticalIssues.length === 0,
    criticalIssues,
    warnings,
    info,
    summary: {
      totalIssues: allIssues.length,
      criticalCount: criticalIssues.length,
      warningCount: warnings.length,
      infoCount: info.length
    }
  };
}
