// src/utils/noiseCalculations.ts
// Noise exposure calculations per SANS 10083 and ISO 9612

/**
 * Calculate LEX,8h (Daily Noise Exposure Level normalized to 8 hours)
 * Formula: LEX,8h = LAeq,T + 10 * log10(T/T0)
 * Where:
 *   LAeq,T = Equivalent continuous sound level during exposure time T
 *   T = Actual exposure time (hours)
 *   T0 = Reference time (8 hours)
 *
 * @param laeq - Equivalent continuous sound level in dB(A)
 * @param exposureTime - Exposure time in hours
 * @returns LEX,8h in dB(A)
 */
export function calculateLEX8h(laeq: number, exposureTime: number): number {
  if (exposureTime <= 0) return 0;
  const T = exposureTime;
  const T0 = 8; // Reference time (8 hours)
  return laeq + 10 * Math.log10(T / T0);
}

/**
 * Calculate noise dose percentage
 * Formula: Dose = (T / T_allowed) * 100
 * Where T_allowed = 8 * 2^((85 - L)/3) for 3 dB exchange rate
 *
 * @param laeq - Equivalent continuous sound level in dB(A)
 * @param exposureTime - Exposure time in hours
 * @returns Dose percentage
 */
export function calculateNoiseDose(laeq: number, exposureTime: number): number {
  if (exposureTime <= 0 || laeq < 85) return 0;

  // SANS 10083 uses 3 dB exchange rate
  // Allowed time at level L: T_allowed = 8 * 2^((85 - L)/3)
  const exchangeRate = 3;
  const referenceLevel = 85;
  const referenceTime = 8;

  const allowedTime = referenceTime * Math.pow(2, (referenceLevel - laeq) / exchangeRate);
  const dose = (exposureTime / allowedTime) * 100;

  return Math.round(dose * 10) / 10; // Round to 1 decimal
}

/**
 * Determine noise zone classification per SANS 10083
 * - Green Zone: < 85 dB(A) - No special requirements
 * - Orange Zone: 85-87 dB(A) - Hearing conservation program
 * - Red Zone: ≥ 87 dB(A) - Mandatory hearing protection
 *
 * @param lex8h - Daily noise exposure level in dB(A)
 * @returns Zone classification and details
 */
export function classifyNoiseZone(lex8h: number): {
  zone: 'green' | 'orange' | 'red';
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  requirements: string[];
} {
  if (lex8h < 85) {
    return {
      zone: 'green',
      label: 'Green Zone',
      color: '#10b981', // green-500
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      requirements: [
        'No special noise control requirements',
        'Routine noise monitoring recommended'
      ]
    };
  } else if (lex8h < 87) {
    return {
      zone: 'orange',
      label: 'Orange Zone',
      color: '#f59e0b', // amber-500
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-800',
      requirements: [
        'Hearing conservation program required',
        'Annual audiometric testing',
        'Hearing protection available',
        'Noise awareness training',
        'Engineering controls investigation'
      ]
    };
  } else {
    return {
      zone: 'red',
      label: 'Red Zone',
      color: '#ef4444', // red-500
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      requirements: [
        'MANDATORY hearing protection (HPD)',
        'Demarcation and signage required',
        'Access control measures',
        'Annual audiometric testing',
        'Engineering controls mandatory',
        'Administrative controls required'
      ]
    };
  }
}

/**
 * Calculate average LAeq from multiple readings
 * Formula: LAeq,avg = 10 * log10((1/n) * Σ 10^(Li/10))
 *
 * @param readings - Array of noise level readings in dB(A)
 * @returns Average equivalent continuous sound level
 */
export function calculateAverageLAeq(readings: number[]): number {
  if (readings.length === 0) return 0;

  const sum = readings.reduce((acc, reading) => {
    return acc + Math.pow(10, reading / 10);
  }, 0);

  const average = 10 * Math.log10(sum / readings.length);
  return Math.round(average * 10) / 10; // Round to 1 decimal
}

/**
 * Check compliance with SANS 10083 action levels
 *
 * @param lex8h - Daily noise exposure level in dB(A)
 * @returns Compliance status and recommendations
 */
export function checkCompliance(lex8h: number): {
  isCompliant: boolean;
  level: 'safe' | 'action' | 'limit-exceeded';
  actionRequired: string[];
  severity: 'info' | 'warning' | 'critical';
} {
  if (lex8h < 85) {
    return {
      isCompliant: true,
      level: 'safe',
      actionRequired: ['Continue routine monitoring'],
      severity: 'info'
    };
  } else if (lex8h < 87) {
    return {
      isCompliant: true,
      level: 'action',
      actionRequired: [
        'Implement hearing conservation program',
        'Provide hearing protection devices',
        'Conduct annual audiometric testing',
        'Provide noise awareness training',
        'Investigate engineering controls'
      ],
      severity: 'warning'
    };
  } else {
    return {
      isCompliant: false,
      level: 'limit-exceeded',
      actionRequired: [
        'IMMEDIATE: Enforce mandatory hearing protection',
        'Demarcate area with signage',
        'Implement access control',
        'Implement engineering controls',
        'Reduce exposure time if controls insufficient',
        'Medical surveillance program required'
      ],
      severity: 'critical'
    };
  }
}

/**
 * Calculate permitted daily exposure time at a given noise level
 * Based on 3 dB exchange rate and 85 dB(A) action level
 *
 * @param laeq - Noise level in dB(A)
 * @returns Permitted exposure time in hours
 */
export function calculatePermittedExposureTime(laeq: number): number {
  if (laeq < 85) return 8; // Full 8-hour shift allowed

  const exchangeRate = 3;
  const referenceLevel = 85;
  const referenceTime = 8;

  const permittedTime = referenceTime * Math.pow(2, (referenceLevel - laeq) / exchangeRate);
  return Math.round(permittedTime * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate maximum permissible exposure level for given duration
 *
 * @param exposureTime - Exposure time in hours
 * @returns Maximum permissible noise level in dB(A)
 */
export function calculateMaxPermissibleLevel(exposureTime: number): number {
  if (exposureTime <= 0) return 0;
  if (exposureTime >= 8) return 85;

  const exchangeRate = 3;
  const referenceLevel = 85;
  const referenceTime = 8;

  const maxLevel = referenceLevel + exchangeRate * Math.log2(referenceTime / exposureTime);
  return Math.round(maxLevel * 10) / 10;
}

/**
 * Format exposure calculation result for display
 *
 * @param laeq - Equivalent continuous sound level in dB(A)
 * @param exposureTime - Exposure time in hours
 * @param shiftDuration - Total shift duration in hours
 * @returns Formatted exposure summary
 */
export function getExposureSummary(
  laeq: number,
  exposureTime: number,
  shiftDuration: number
): {
  lex8h: number;
  dose: number;
  zone: ReturnType<typeof classifyNoiseZone>;
  compliance: ReturnType<typeof checkCompliance>;
  permittedTime: number;
  exceedsLimit: boolean;
} {
  const lex8h = calculateLEX8h(laeq, exposureTime);
  const dose = calculateNoiseDose(laeq, exposureTime);
  const zone = classifyNoiseZone(lex8h);
  const compliance = checkCompliance(lex8h);
  const permittedTime = calculatePermittedExposureTime(laeq);
  const exceedsLimit = exposureTime > permittedTime && laeq >= 85;

  return {
    lex8h,
    dose,
    zone,
    compliance,
    permittedTime,
    exceedsLimit
  };
}
