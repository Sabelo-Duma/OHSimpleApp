// src/components/types.ts

export type Equipment = {
  id: string;
  type: "SLM" | "Calibrator" | "";
  name: string;
  serial: string;
  calibrationDate?: string;
  weighting: string;
  responseImpulse: string;
  responseLEQ: string;
  pre: string;
  during: string;
  post: string;
  areaRef: string;
  startDate?: string;
  endDate?: string;
};

export type NoiseEntry = {
  source: string;
  description: string;
  mit: string;
  type: string;
};

export type Measurement = {
  shiftDuration: string;
  exposureTime: string;
  slmId: string;
  calibratorId: string;
  measurementCount: string;
  areaLeq: string[];
  readings: string[];
  files?: File[];
};

export type Device = {
  type: string;
  manufacturer: string;
  snrOrNrr: string;
  snrValue: string;
  condition: "" | "Good" | "Poor";
  conditionComment: string;
  training: "Yes" | "No";
  fitting: "Yes" | "No";
  maintenance: "Yes" | "No";
};

export type Area = {
  id: string;
  name: string;
  process?: string;
  noiseLevelDb?: number;
  noiseType?: string;
  shiftDuration?: number;
  exposureTime?: number;
  notes?: string;
  detailsCompleted?: boolean;
  subAreas?: Area[];

  // ✅ Added field: ensures form resets when area is deleted/re-added
  createdAt?: number;
};

export type ExposureData = {
  exposure: string;
  exposureDetail: string;
  prohibited: string;
  prohibitedDetail: string;
};

export type SurveyStatus = "In Progress" | "Completed" | "Submitted";

export type AreaPath = {
  main: number;
  sub?: number;
  ss?: number;
};

export type Step =0| 1 | 2 | 3 | 4 | 5;

export interface Client {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
}

export type Controls = {
  engineering: string;
  adminControls: string[];
  customAdmin: string;
};

export type HearingProtectionDevice = {
  type: string;
  manufacturer: string;
  snrOrNrr: string;
  snrValue: string;
  condition: "" | "Good" | "Poor";
  conditionComment: string;
  training: "Yes" | "No";
  fitting: "Yes" | "No";
  maintenance: "Yes" | "No";
};

export type NoiseSource = {
  source: string;
  description: string;
  mit: string;
  type: string;
};

export type Exposure = {
  exposure: string;
  exposureDetail: string;
  prohibited: string;
  prohibitedDetail: string;
};

/**
 * Audiometry Types for Hearing Conservation Program
 * Per SANS 10083 and ISO 1999
 */

export type AudiometryFrequency = 500 | 1000 | 2000 | 3000 | 4000 | 6000 | 8000;

export type AudiogramData = {
  /** Hearing threshold in dB HL for each frequency */
  [K in AudiometryFrequency]: {
    left: number;  // Left ear threshold (dB HL)
    right: number; // Right ear threshold (dB HL)
  };
};

export type AudiometryTestType = "Baseline" | "Annual" | "Exit" | "Follow-up";

export type AudiometryTest = {
  id: string;
  testType: AudiometryTestType;
  testDate: string;
  audiogram: AudiogramData;
  testerName: string;
  testerQualification: string;
  calibrationDate: string; // Audiometer calibration date
  notes?: string;
};

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  dateOfBirth: string;
  gender: "Male" | "Female" | "Other";
  jobTitle: string;

  // Hearing conservation program data
  baselineTest?: AudiometryTest;
  periodicTests: AudiometryTest[]; // Annual and follow-up tests

  // STS tracking
  hasSTS: boolean; // Standard Threshold Shift detected
  stsDate?: string; // Date STS was first detected
  stsDetails?: string; // Details about the STS
};

/**
 * Updated SurveyData:
 * All area-specific data is stored per areaRef (string key) to avoid TypeScript index issues.
 */
export type SurveyData = {
  id: string;
  client: string;
  project: string;
  site: string;
  surveyType: string;
  startDate: string;
  endDate: string;
  description: string;
  clientId?: string;
  projectId?: string;
  equipment: Equipment[];
  areas: Area[];
  status: SurveyStatus;
  comments?: string;
  normalConditions: "Yes" | "No";

  // Area-specific data
  noiseSourcesByArea?: { [areaRef: string]: NoiseSource[] };
  measurementsByArea?: { [areaRef: string]: Measurement[] };
  hearingProtectionDevices?: { [areaRef: string]: HearingProtectionDevice[] };
  controlsByArea?: { [areaRef: string]: Controls };
  hearingIssuedStatus?: Record<string, "Yes" | "No">;
  exposuresByArea?: { [areaRef: string]: Exposure };
  commentsByArea?: { [areaRef: string]: string };
  employeesByArea?: { [areaRef: string]: Employee[] }; // Audiometry data by area
  currentAreaId?: string; // optional pointer for resume

  // New fields for completion tracking
  createdAt?: string;
  completedAt?: string;
  verificationComment?: string;
  verificationSignature?: string;
};

/** Empty survey template */
export const emptySurvey: SurveyData = {
  id: "",
  client: "",
  project: "",
  site: "",
  surveyType: "",
  startDate: "",
  endDate: "",
  description: "",
  equipment: [],
  areas: [],
  status: "In Progress",
  normalConditions: "Yes",
  noiseSourcesByArea: {},
  measurementsByArea: {},
  hearingProtectionDevices: {},
  controlsByArea: {},
  exposuresByArea: {},
  commentsByArea: {},
  employeesByArea: {},
  createdAt: new Date().toISOString(),
};