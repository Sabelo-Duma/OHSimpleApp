// src/utils/hearingProtectionCalculations.ts
// Hearing protection effectiveness calculations per SANS 10083

import { classifyNoiseZone } from './noiseCalculations';

/**
 * Calculate effective attenuation using SANS 10083 derating methods
 *
 * SNR Method (European): Protected exposure = LAeq - (SNR - 4)
 * NRR Method (US): Protected exposure = LAeq - ((NRR - 7) / 2)
 *
 * The derating accounts for real-world imperfect fit and usage
 *
 * @param snrOrNrr - Rating type ("SNR" or "NRR")
 * @param value - Rating value in dB
 * @returns Effective attenuation in dB(A)
 */
export function calculateEffectiveAttenuation(
  snrOrNrr: string,
  value: number
): number {
  if (snrOrNrr === "SNR") {
    // SNR derating: subtract 4 dB for real-world conditions
    return Math.max(0, value - 4);
  } else if (snrOrNrr === "NRR") {
    // NRR derating: convert C-weighting to A-weighting and apply safety factor
    // Formula: (NRR - 7) / 2
    return Math.max(0, (value - 7) / 2);
  }
  return 0;
}

/**
 * Calculate protected exposure level after applying hearing protection
 *
 * @param actualLex8h - Actual LEX,8h without protection in dB(A)
 * @param snrOrNrr - Rating type ("SNR" or "NRR")
 * @param snrValue - Rating value in dB
 * @returns Protected LEX,8h in dB(A)
 */
export function calculateProtectedExposure(
  actualLex8h: number,
  snrOrNrr: string,
  snrValue: number
): number {
  const effectiveAttenuation = calculateEffectiveAttenuation(snrOrNrr, snrValue);
  const protectedLevel = actualLex8h - effectiveAttenuation;

  // Protected level should not go below 40 dB(A) (ambient noise floor)
  return Math.max(40, protectedLevel);
}

/**
 * Determine if hearing protection is adequate for the exposure level
 *
 * @param actualLex8h - Actual LEX,8h without protection in dB(A)
 * @param protectedLex8h - Protected LEX,8h with PPE in dB(A)
 * @returns Adequacy assessment
 */
export function assessProtectionAdequacy(
  actualLex8h: number,
  protectedLex8h: number
): {
  isAdequate: boolean;
  level: 'excellent' | 'good' | 'acceptable' | 'marginal' | 'inadequate' | 'over-protected';
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  recommendations: string[];
} {
  const reduction = actualLex8h - protectedLex8h;

  // Over-protection check (>25 dB reduction can cause communication issues)
  if (reduction > 25) {
    return {
      isAdequate: true,
      level: 'over-protected',
      message: 'Over-protected - may impair communication and safety awareness',
      severity: 'warning',
      recommendations: [
        'Consider lower attenuation HPD to maintain situational awareness',
        'Ensure workers can hear warning signals and communication',
        'May cause workers to remove HPD, defeating protection'
      ]
    };
  }

  // Excellent: Protected level < 75 dB(A)
  if (protectedLex8h < 75) {
    return {
      isAdequate: true,
      level: 'excellent',
      message: 'Excellent protection - well below action levels',
      severity: 'success',
      recommendations: [
        'Current HPD provides excellent protection',
        'Continue monitoring and enforcement',
        'Maintain proper fitting and usage'
      ]
    };
  }

  // Good: Protected level 75-80 dB(A)
  if (protectedLex8h < 80) {
    return {
      isAdequate: true,
      level: 'good',
      message: 'Good protection - comfortably below action level',
      severity: 'success',
      recommendations: [
        'Current HPD provides good protection',
        'Ensure proper fitting and consistent usage',
        'Continue monitoring compliance'
      ]
    };
  }

  // Acceptable: Protected level 80-85 dB(A)
  if (protectedLex8h < 85) {
    return {
      isAdequate: true,
      level: 'acceptable',
      message: 'Acceptable protection - below action level',
      severity: 'info',
      recommendations: [
        'Protection is adequate but with limited safety margin',
        'Ensure 100% wearing compliance',
        'Consider higher attenuation HPD for additional safety margin',
        'Investigate engineering controls to reduce noise at source'
      ]
    };
  }

  // Marginal: Protected level 85-87 dB(A) (between action and limit)
  if (protectedLex8h < 87) {
    return {
      isAdequate: false,
      level: 'marginal',
      message: 'Marginal protection - still in Orange Zone (action level exceeded)',
      severity: 'warning',
      recommendations: [
        'URGENT: Upgrade to higher attenuation HPD immediately',
        'Protected exposure still exceeds 85 dB(A) action level',
        'Implement engineering controls as priority',
        'Double hearing protection may be required',
        'Reduce exposure time if controls are insufficient'
      ]
    };
  }

  // Inadequate: Protected level ≥ 87 dB(A) (still in Red Zone)
  return {
    isAdequate: false,
    level: 'inadequate',
    message: 'INADEQUATE protection - still exceeds limit even with HPD',
    severity: 'error',
    recommendations: [
      'CRITICAL: Current HPD is insufficient - Red Zone limit exceeded',
      'IMMEDIATE ACTION: Implement double hearing protection (earplugs + earmuffs)',
      'Engineering controls MANDATORY to reduce noise at source',
      'Reduce exposure time immediately',
      'Reassess area access - consider exclusion until controls implemented',
      'Medical surveillance required for all exposed workers'
    ]
  };
}

/**
 * Compare hearing protection devices and recommend the best option
 *
 * @param devices - Array of devices with their attenuation values
 * @param actualLex8h - Actual exposure level
 * @returns Recommendation for best device
 */
export function recommendBestDevice(
  devices: Array<{ type: string; snrOrNrr: string; snrValue: number; condition: string }>,
  actualLex8h: number
): {
  bestDeviceIndex: number;
  reason: string;
} | null {
  if (devices.length === 0) return null;

  // Filter out devices in poor condition
  const goodDevices = devices.map((d, idx) => ({ ...d, originalIndex: idx }))
    .filter(d => d.condition === 'Good');

  if (goodDevices.length === 0) {
    return {
      bestDeviceIndex: 0,
      reason: 'No devices in good condition - all devices need replacement'
    };
  }

  // Calculate protected levels for all good devices
  const devicesWithProtection = goodDevices.map(d => ({
    ...d,
    effectiveAttenuation: calculateEffectiveAttenuation(d.snrOrNrr, d.snrValue),
    protectedLex8h: calculateProtectedExposure(actualLex8h, d.snrOrNrr, d.snrValue)
  }));

  // Find device that brings protected level closest to 80 dB(A) (optimal target)
  // This avoids over-protection while ensuring adequate protection
  const optimalTarget = 80;

  const bestDevice = devicesWithProtection.reduce((best, current) => {
    const currentDistance = Math.abs(current.protectedLex8h - optimalTarget);
    const bestDistance = Math.abs(best.protectedLex8h - optimalTarget);

    // Prefer device that gets closer to optimal target
    // But if both are adequate, prefer less attenuation to avoid over-protection
    if (current.protectedLex8h < 85 && best.protectedLex8h < 85) {
      // Both adequate - prefer less attenuation
      return current.protectedLex8h > best.protectedLex8h ? current : best;
    }

    // Otherwise prefer device closest to optimal
    return currentDistance < bestDistance ? current : best;
  });

  const adequacy = assessProtectionAdequacy(actualLex8h, bestDevice.protectedLex8h);

  return {
    bestDeviceIndex: bestDevice.originalIndex,
    reason: adequacy.isAdequate
      ? `Provides ${adequacy.level} protection (${bestDevice.protectedLex8h.toFixed(1)} dB(A) protected level)`
      : `Warning: Even best device provides ${adequacy.level} protection - additional controls needed`
  };
}

/**
 * Get comprehensive protection summary for display
 *
 * @param actualLex8h - Actual exposure level
 * @param devices - Array of hearing protection devices
 * @returns Summary of protection effectiveness
 */
export function getProtectionSummary(
  actualLex8h: number,
  devices: Array<{ type: string; manufacturer: string; snrOrNrr: string; snrValue: string; condition: string }>
): {
  actualZone: ReturnType<typeof classifyNoiseZone>;
  protectedZone: ReturnType<typeof classifyNoiseZone>;
  protectedLex8h: number;
  effectiveAttenuation: number;
  adequacy: ReturnType<typeof assessProtectionAdequacy>;
  deviceSummary: string;
} | null {
  if (devices.length === 0 || actualLex8h === 0) return null;

  // Use the first device in good condition, or first device if none are good
  const goodDevice = devices.find(d => d.condition === 'Good') || devices[0];
  const snrValue = parseFloat(goodDevice.snrValue);

  if (isNaN(snrValue)) return null;

  const effectiveAttenuation = calculateEffectiveAttenuation(goodDevice.snrOrNrr, snrValue);
  const protectedLex8h = calculateProtectedExposure(actualLex8h, goodDevice.snrOrNrr, snrValue);

  const actualZone = classifyNoiseZone(actualLex8h);
  const protectedZone = classifyNoiseZone(protectedLex8h);
  const adequacy = assessProtectionAdequacy(actualLex8h, protectedLex8h);

  return {
    actualZone,
    protectedZone,
    protectedLex8h,
    effectiveAttenuation,
    adequacy,
    deviceSummary: `${goodDevice.type} - ${goodDevice.manufacturer} (${goodDevice.snrOrNrr}: ${goodDevice.snrValue} dB)`
  };
}
