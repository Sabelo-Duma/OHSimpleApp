// src/utils/audiometryCalculations.ts
// Audiometry calculations per SANS 10083, ISO 1999, and OSHA standards

import { AudiogramData, AudiometryTest, Employee } from "../components/types";

/**
 * Calculate Hearing Threshold Average (HTA) for specific frequencies
 *
 * Per SANS 10083 and OSHA, STS is measured at 2000, 3000, 4000 Hz
 *
 * @param audiogram - Audiogram data
 * @param frequencies - Array of frequencies to average (default: [2000, 3000, 4000])
 * @param ear - Which ear ("left" or "right")
 * @returns Average threshold in dB HL
 */
export function calculateHTA(
  audiogram: AudiogramData,
  frequencies: number[] = [2000, 3000, 4000],
  ear: "left" | "right"
): number {
  const thresholds = frequencies.map(freq => {
    const freqKey = freq as keyof AudiogramData;
    return audiogram[freqKey]?.[ear] || 0;
  });

  const sum = thresholds.reduce((acc, val) => acc + val, 0);
  return sum / thresholds.length;
}

/**
 * Detect Standard Threshold Shift (STS)
 *
 * STS Definition (SANS 10083 / OSHA):
 * - Average shift of ≥10 dB at 2000, 3000, 4000 Hz
 * - In either ear
 * - Compared to baseline audiogram
 *
 * @param baseline - Baseline audiogram
 * @param current - Current (periodic) audiogram
 * @returns STS detection result
 */
export function detectSTS(
  baseline: AudiogramData,
  current: AudiogramData
): {
  hasSTS: boolean;
  leftEarShift: number;
  rightEarShift: number;
  affectedEar: "left" | "right" | "both" | "none";
  severity: "none" | "mild" | "moderate" | "severe";
  message: string;
} {
  // Calculate HTA for baseline
  const baselineLeftHTA = calculateHTA(baseline, [2000, 3000, 4000], "left");
  const baselineRightHTA = calculateHTA(baseline, [2000, 3000, 4000], "right");

  // Calculate HTA for current test
  const currentLeftHTA = calculateHTA(current, [2000, 3000, 4000], "left");
  const currentRightHTA = calculateHTA(current, [2000, 3000, 4000], "right");

  // Calculate shifts
  const leftEarShift = currentLeftHTA - baselineLeftHTA;
  const rightEarShift = currentRightHTA - baselineRightHTA;

  // Determine if STS exists (≥10 dB shift)
  const leftHasSTS = leftEarShift >= 10;
  const rightHasSTS = rightEarShift >= 10;
  const hasSTS = leftHasSTS || rightHasSTS;

  // Determine affected ear
  let affectedEar: "left" | "right" | "both" | "none" = "none";
  if (leftHasSTS && rightHasSTS) {
    affectedEar = "both";
  } else if (leftHasSTS) {
    affectedEar = "left";
  } else if (rightHasSTS) {
    affectedEar = "right";
  }

  // Determine severity based on maximum shift
  const maxShift = Math.max(leftEarShift, rightEarShift);
  let severity: "none" | "mild" | "moderate" | "severe" = "none";
  let message = "No significant threshold shift detected";

  if (maxShift >= 25) {
    severity = "severe";
    message = `SEVERE STS: ${maxShift.toFixed(1)} dB shift detected - Immediate action required`;
  } else if (maxShift >= 20) {
    severity = "moderate";
    message = `MODERATE STS: ${maxShift.toFixed(1)} dB shift detected - Follow-up required`;
  } else if (maxShift >= 10) {
    severity = "mild";
    message = `MILD STS: ${maxShift.toFixed(1)} dB shift detected - Monitor closely`;
  }

  return {
    hasSTS,
    leftEarShift,
    rightEarShift,
    affectedEar,
    severity,
    message
  };
}

/**
 * Calculate age-corrected hearing threshold per ISO 1999 Annex B
 *
 * This is an approximation - full ISO 1999 requires detailed tables
 *
 * @param age - Age in years
 * @param frequency - Frequency in Hz
 * @param gender - Gender ("Male" or "Female")
 * @returns Age-corrected threshold in dB HL
 */
export function calculateAgeCorrectionISO1999(
  age: number,
  frequency: number,
  gender: "Male" | "Female" | "Other"
): number {
  if (age < 18) return 0; // No correction for young workers

  // Simplified age correction factors (ISO 1999 Annex B approximation)
  // Actual ISO 1999 uses complex tables - this is a practical approximation

  const yearsAbove20 = Math.max(0, age - 20);

  // Age correction increases with frequency and age
  // Males tend to have more high-frequency loss with age
  const genderFactor = gender === "Male" ? 1.2 : 1.0;

  let correction = 0;

  if (frequency >= 4000) {
    correction = yearsAbove20 * 0.5 * genderFactor; // 0.5 dB per year above 20 at high frequencies
  } else if (frequency >= 2000) {
    correction = yearsAbove20 * 0.3 * genderFactor; // 0.3 dB per year at mid frequencies
  } else if (frequency >= 1000) {
    correction = yearsAbove20 * 0.15 * genderFactor; // 0.15 dB per year at low-mid frequencies
  } else {
    correction = yearsAbove20 * 0.1 * genderFactor; // 0.1 dB per year at low frequencies
  }

  return Math.round(correction);
}

/**
 * Classify hearing loss severity based on Pure Tone Average (PTA)
 *
 * PTA = average of 500, 1000, 2000, 4000 Hz thresholds
 *
 * Classification per WHO:
 * - 0-25 dB: Normal
 * - 26-40 dB: Mild hearing loss
 * - 41-60 dB: Moderate hearing loss
 * - 61-80 dB: Severe hearing loss
 * - 81+ dB: Profound hearing loss
 *
 * @param audiogram - Audiogram data
 * @param ear - Which ear ("left" or "right")
 * @returns Hearing loss classification
 */
export function classifyHearingLoss(
  audiogram: AudiogramData,
  ear: "left" | "right"
): {
  pta: number;
  classification: "normal" | "mild" | "moderate" | "severe" | "profound";
  message: string;
  severity: "success" | "info" | "warning" | "error";
} {
  // Calculate PTA (Pure Tone Average) for 500, 1000, 2000, 4000 Hz
  const pta = calculateHTA(audiogram, [500, 1000, 2000, 4000], ear);

  let classification: "normal" | "mild" | "moderate" | "severe" | "profound" = "normal";
  let message = "Normal hearing";
  let severity: "success" | "info" | "warning" | "error" = "success";

  if (pta >= 81) {
    classification = "profound";
    message = "Profound hearing loss - Referral to ENT specialist required";
    severity = "error";
  } else if (pta >= 61) {
    classification = "severe";
    message = "Severe hearing loss - Medical referral required";
    severity = "error";
  } else if (pta >= 41) {
    classification = "moderate";
    message = "Moderate hearing loss - Medical evaluation recommended";
    severity = "warning";
  } else if (pta >= 26) {
    classification = "mild";
    message = "Mild hearing loss - Monitoring recommended";
    severity = "info";
  } else {
    classification = "normal";
    message = "Normal hearing";
    severity = "success";
  }

  return { pta, classification, message, severity };
}

/**
 * Get comprehensive audiometry summary for an employee
 *
 * @param employee - Employee data including baseline and periodic tests
 * @returns Summary of audiometry results
 */
export function getAudiometrySummary(employee: Employee): {
  hasBaseline: boolean;
  latestTest: AudiometryTest | null;
  hasSTS: boolean;
  stsDetails: ReturnType<typeof detectSTS> | null;
  leftHearingLoss: ReturnType<typeof classifyHearingLoss> | null;
  rightHearingLoss: ReturnType<typeof classifyHearingLoss> | null;
  recommendations: string[];
} | null {
  if (!employee.baselineTest) {
    return {
      hasBaseline: false,
      latestTest: null,
      hasSTS: false,
      stsDetails: null,
      leftHearingLoss: null,
      rightHearingLoss: null,
      recommendations: [
        "Baseline audiogram required for hearing conservation program enrollment"
      ]
    };
  }

  // Get latest test (most recent periodic test, or baseline if no periodic tests)
  const latestTest = employee.periodicTests.length > 0
    ? employee.periodicTests[employee.periodicTests.length - 1]
    : employee.baselineTest;

  // Detect STS if we have periodic tests
  let stsDetails = null;
  if (employee.periodicTests.length > 0) {
    stsDetails = detectSTS(
      employee.baselineTest.audiogram,
      latestTest.audiogram
    );
  }

  // Classify hearing loss for both ears
  const leftHearingLoss = classifyHearingLoss(latestTest.audiogram, "left");
  const rightHearingLoss = classifyHearingLoss(latestTest.audiogram, "right");

  // Generate recommendations
  const recommendations: string[] = [];

  // STS recommendations
  if (stsDetails?.hasSTS) {
    if (stsDetails.severity === "severe") {
      recommendations.push("URGENT: Immediate medical referral required for significant hearing loss");
      recommendations.push("Remove from high-noise exposure until evaluation completed");
    } else if (stsDetails.severity === "moderate") {
      recommendations.push("Medical evaluation required within 30 days");
      recommendations.push("Ensure proper use of hearing protection");
    } else {
      recommendations.push("Retest audiogram within 30 days to confirm STS");
      recommendations.push("Review hearing protection effectiveness");
    }
    recommendations.push("Provide employee notification of STS per SANS 10083");
    recommendations.push("Investigate noise exposure and control measures");
  }

  // Hearing loss recommendations
  const worstClassification = leftHearingLoss.pta > rightHearingLoss.pta
    ? leftHearingLoss
    : rightHearingLoss;

  if (worstClassification.classification !== "normal" && !stsDetails?.hasSTS) {
    if (worstClassification.classification === "profound" || worstClassification.classification === "severe") {
      recommendations.push("Medical referral to ENT specialist required");
    } else if (worstClassification.classification === "moderate") {
      recommendations.push("Medical evaluation recommended");
    }
    recommendations.push("Ensure adequate hearing protection is provided and used correctly");
  }

  // Annual testing reminder
  if (latestTest.testType === "Baseline") {
    recommendations.push("Schedule annual audiogram per SANS 10083 requirements");
  } else {
    const testDate = new Date(latestTest.testDate);
    const oneYearLater = new Date(testDate);
    oneYearLater.setFullYear(testDate.getFullYear() + 1);

    if (oneYearLater < new Date()) {
      recommendations.push("Annual audiogram overdue - schedule immediately");
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue annual audiometric monitoring");
    recommendations.push("Maintain proper use of hearing protection");
  }

  return {
    hasBaseline: true,
    latestTest,
    hasSTS: stsDetails?.hasSTS || false,
    stsDetails,
    leftHearingLoss,
    rightHearingLoss,
    recommendations
  };
}

/**
 * Create empty audiogram template
 */
export function createEmptyAudiogram(): AudiogramData {
  return {
    500: { left: 0, right: 0 },
    1000: { left: 0, right: 0 },
    2000: { left: 0, right: 0 },
    3000: { left: 0, right: 0 },
    4000: { left: 0, right: 0 },
    6000: { left: 0, right: 0 },
    8000: { left: 0, right: 0 }
  };
}

/**
 * Validate audiogram data
 *
 * @param audiogram - Audiogram to validate
 * @returns Validation result
 */
export function validateAudiogram(audiogram: AudiogramData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const frequencies: number[] = [500, 1000, 2000, 3000, 4000, 6000, 8000];

  frequencies.forEach(freq => {
    const freqKey = freq as keyof AudiogramData;
    const data = audiogram[freqKey];

    if (!data) {
      errors.push(`Missing data for ${freq} Hz`);
      return;
    }

    // Validate threshold range (-10 to 120 dB HL)
    if (data.left < -10 || data.left > 120) {
      errors.push(`Left ear ${freq} Hz threshold out of range: ${data.left} dB HL`);
    }
    if (data.right < -10 || data.right > 120) {
      errors.push(`Right ear ${freq} Hz threshold out of range: ${data.right} dB HL`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}
