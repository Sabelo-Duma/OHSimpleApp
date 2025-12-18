// src/utils/validation.ts
import { SurveyData, Equipment } from "../components/types";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate survey information (Step 1)
 */
export function validateSurveyInfo(data: Partial<SurveyData>): ValidationResult {
  const errors: Record<string, string> = {};

  // Client validation
  if (!data.client?.trim()) {
    errors.client = "Client name is required";
  } else if (data.client.length < 2) {
    errors.client = "Client name must be at least 2 characters";
  } else if (data.client.length > 100) {
    errors.client = "Client name must be less than 100 characters";
  }

  // Project validation
  if (!data.project?.trim()) {
    errors.project = "Project reference is required";
  } else if (data.project.length < 2) {
    errors.project = "Project reference must be at least 2 characters";
  }

  // Site validation
  if (!data.site?.trim()) {
    errors.site = "Site location is required for SANAS reporting";
  } else if (data.site.length < 2) {
    errors.site = "Site location must be at least 2 characters";
  }

  // Start date validation
  if (!data.startDate) {
    errors.startDate = "Survey start date is required";
  } else {
    const startDate = new Date(data.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(startDate.getTime())) {
      errors.startDate = "Invalid date format";
    } else if (startDate > new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000)) {
      errors.startDate = "Start date cannot be more than 1 year in the future";
    }
  }

  // End date validation
  if (!data.endDate) {
    errors.endDate = "Survey end date is required";
  } else {
    const endDate = new Date(data.endDate);

    if (isNaN(endDate.getTime())) {
      errors.endDate = "Invalid date format";
    } else if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (endDate < startDate) {
        errors.endDate = "End date must be on or after start date";
      }

      // Check if duration is unreasonably long
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 365) {
        errors.endDate = "Survey duration exceeds 1 year. Please verify dates.";
      }
    }
  }

  // Description validation
  if (!data.description?.trim()) {
    errors.description = "Survey description/department is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate equipment data
 */
export function validateEquipment(equipment: Partial<Equipment>): ValidationResult {
  const errors: Record<string, string> = {};

  // Type validation
  if (!equipment.type) {
    errors.type = "Equipment type is required";
  }

  // Name validation
  if (!equipment.name?.trim()) {
    errors.name = "Equipment name/model is required";
  } else if (equipment.name.length < 2) {
    errors.name = "Equipment name must be at least 2 characters";
  }

  // Serial number validation
  if (!equipment.serial?.trim()) {
    errors.serial = "Serial number is required for equipment traceability";
  }

  // SLM-specific validation
  if (equipment.type === "SLM") {
    // SLM no longer requires Pre/Post/Drift - validation handled by paired calibrator
    // Optional: Validate calibration dates if needed
    // Start and End dates are optional for SLM
  }

  // Calibrator-specific validation
  if (equipment.type === "Calibrator") {
    // Calibration certificate date validation
    if (!equipment.calibrationDate?.trim()) {
      errors.calibrationDate = "Calibration certificate date is required (SANS 10083)";
    } else {
      const calDate = new Date(equipment.calibrationDate);
      const today = new Date();

      if (isNaN(calDate.getTime())) {
        errors.calibrationDate = "Invalid calibration date";
      } else if (calDate > today) {
        errors.calibrationDate = "Calibration date cannot be in the future";
      } else {
        // Check if calibration is expired (typically 1 year)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        if (calDate < oneYearAgo) {
          errors.calibrationDate = "⚠️ WARNING: Calibration certificate may be expired (>1 year old). Verify calibration is current per SANS 10083.";
        }
      }
    }

    // Pre-calibration reading (Reference SPL)
    if (!equipment.pre?.trim()) {
      errors.pre = "Pre-calibration reading is required for traceability";
    } else {
      const preValue = parseFloat(equipment.pre);
      if (isNaN(preValue)) {
        errors.pre = "Pre-calibration must be a valid number";
      } else if (preValue < 90 || preValue > 125) {
        errors.pre = "⚠️ Pre-calibration reading unusual (expected 90-125 dB). Please verify.";
      }
    }

    // During-calibration reading (Reference SPL)
    if (!equipment.during?.trim()) {
      errors.during = "During-calibration reading is required";
    } else {
      const duringValue = parseFloat(equipment.during);
      if (isNaN(duringValue)) {
        errors.during = "During-calibration must be a valid number";
      } else if (duringValue < 90 || duringValue > 125) {
        errors.during = "⚠️ During-calibration reading unusual (expected 90-125 dB). Please verify.";
      }
    }

    // Post-calibration reading (Reference SPL)
    if (!equipment.post?.trim()) {
      errors.post = "Post-calibration reading is required for traceability";
    } else {
      const postValue = parseFloat(equipment.post);
      if (isNaN(postValue)) {
        errors.post = "Post-calibration must be a valid number";
      } else if (postValue < 90 || postValue > 125) {
        errors.post = "⚠️ Post-calibration reading unusual (expected 90-125 dB). Please verify.";
      }
    }

    // Calibration drift check (Pre vs Post)
    if (equipment.pre && equipment.post) {
      const preValue = parseFloat(equipment.pre);
      const postValue = parseFloat(equipment.post);

      if (!isNaN(preValue) && !isNaN(postValue)) {
        const drift = Math.abs(preValue - postValue);
        if (drift > 1.0) {
          errors.calibrationDrift = `⚠️ ALERT: Calibration drift of ${drift.toFixed(1)} dB exceeds acceptable limit (±1 dB per SANS 10083). Calibrator may require servicing.`;
        }
      }
    }

    // Area reference noise level (optional but validate if provided)
    if (equipment.areaRef?.trim()) {
      const areaRefValue = parseFloat(equipment.areaRef);
      if (isNaN(areaRefValue)) {
        errors.areaRef = "Area reference must be a valid number";
      } else if (areaRefValue < 0 || areaRefValue > 140) {
        errors.areaRef = "Area reference value out of range (0-140 dB)";
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate noise measurement
 */
export function validateNoiseMeasurement(
  noiseLevel: string,
  measurementType?: string
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!noiseLevel.trim()) {
    errors.noiseLevel = "Noise level is required";
    return { isValid: false, errors };
  }

  const level = parseFloat(noiseLevel);

  if (isNaN(level)) {
    errors.noiseLevel = "Noise level must be a valid number";
  } else if (level < 0) {
    errors.noiseLevel = "Noise level cannot be negative";
  } else if (level < 30) {
    errors.noiseLevel = "⚠️ Unusually low noise level (< 30 dB(A)). Typical ambient is 30-45 dB(A). Please verify.";
  } else if (level > 140) {
    errors.noiseLevel = "⚠️ CRITICAL: Noise level exceeds 140 dB(A) pain threshold. Verify measurement and equipment calibration.";
  } else if (level > 120) {
    errors.noiseLevel = "⚠️ WARNING: Extremely high noise level (> 120 dB(A)). Verify measurement is correct.";
  } else if (level > 85 && measurementType === "continuous") {
    // Info message, not an error
    errors.noiseLevelInfo = "ℹ️ Noise level exceeds 85 dB(A) exposure limit. Area requires noise zone designation.";
  }

  return {
    isValid: Object.keys(errors).filter(k => k !== 'noiseLevelInfo').length === 0,
    errors,
  };
}

/**
 * Validate exposure time
 */
export function validateExposureTime(exposureTime: string, shiftDuration: string): ValidationResult {
  const errors: Record<string, string> = {};

  const exposure = parseFloat(exposureTime);
  const shift = parseFloat(shiftDuration);

  if (!exposureTime.trim()) {
    errors.exposureTime = "Exposure time is required";
  } else if (isNaN(exposure)) {
    errors.exposureTime = "Exposure time must be a valid number";
  } else if (exposure <= 0) {
    errors.exposureTime = "Exposure time must be greater than 0";
  } else if (exposure > 24) {
    errors.exposureTime = "Exposure time cannot exceed 24 hours";
  }

  if (!isNaN(exposure) && !isNaN(shift)) {
    if (exposure > shift) {
      errors.exposureTime = `Exposure time (${exposure}h) exceeds shift duration (${shift}h). Please verify.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Check if equipment list has at least one SLM
 */
export function validateEquipmentList(equipment: Equipment[]): ValidationResult {
  const errors: Record<string, string> = {};

  if (equipment.length === 0) {
    errors.equipment = "At least one Sound Level Meter (SLM) is required for SANS 10083 compliance";
  } else {
    const hasSLM = equipment.some((eq) => eq.type === "SLM");
    if (!hasSLM) {
      errors.equipment = "At least one Sound Level Meter (SLM) is required. Only calibrators found.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Utility to check if a field has been touched and has an error
 */
export function getFieldError(
  fieldName: string,
  errors: Record<string, string>,
  touched: Record<string, boolean>
): string {
  return touched[fieldName] && errors[fieldName] ? errors[fieldName] : "";
}

/**
 * Utility to check if a field is valid (has value and no error)
 */
export function isFieldValid(
  value: any,
  fieldName: string,
  errors: Record<string, string>
): boolean {
  return !!value && !errors[fieldName];
}
