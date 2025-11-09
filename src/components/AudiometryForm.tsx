// src/components/AudiometryForm.tsx
import React, { useState, useEffect } from "react";
import Button from "./common/Button";
import ConfirmDialog from "./common/ConfirmDialog";
import Section from "./common/Section";
import Field from "./common/Field";
import { SurveyData, Employee, AudiometryTest, AudiogramData, AudiometryTestType } from "./types";
import {
  createEmptyAudiogram,
  validateAudiogram,
  getAudiometrySummary,
  detectSTS,
  classifyHearingLoss
} from "../utils/audiometryCalculations";
import { v4 as uuidv4 } from 'uuid';

interface AudiometryFormProps {
  data: SurveyData;
  selectedAreaPath: { main: number; sub?: number; ss?: number } | null;
  onNext: () => void;
  onPrev: () => void;
  onChange: (patch: Partial<SurveyData>) => void;
  onSave: () => void;
  readOnly?: boolean;
}

export default function AudiometryForm({
  data,
  selectedAreaPath,
  onNext,
  onPrev,
  onChange,
  onSave,
  readOnly = false
}: AudiometryFormProps) {
  // Employee management state
  const [employeeDraft, setEmployeeDraft] = useState<Employee>({
    id: "",
    firstName: "",
    lastName: "",
    employeeNumber: "",
    dateOfBirth: "",
    gender: "Male",
    jobTitle: "",
    periodicTests: [],
    hasSTS: false
  });
  const [editingEmployeeIndex, setEditingEmployeeIndex] = useState<number | null>(null);

  // Audiogram entry state
  const [showAudiogramEntry, setShowAudiogramEntry] = useState(false);
  const [audiogramDraft, setAudiogramDraft] = useState<AudiogramData>(createEmptyAudiogram());
  const [testType, setTestType] = useState<AudiometryTestType>("Baseline");
  const [testDate, setTestDate] = useState("");
  const [testerName, setTesterName] = useState("");
  const [testerQualification, setTesterQualification] = useState("");
  const [calibrationDate, setCalibrationDate] = useState("");
  const [testNotes, setTestNotes] = useState("");
  const [selectedEmployeeForTest, setSelectedEmployeeForTest] = useState<number | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<() => void>(() => () => {});

  if (!selectedAreaPath) return null;

  const areaKey = JSON.stringify(selectedAreaPath);

  // Get current area
  const getCurrentArea = () => {
    const mainArea = data.areas[selectedAreaPath.main];
    if (!mainArea) return null;

    if (selectedAreaPath.sub !== undefined) {
      const subArea = mainArea.subAreas?.[selectedAreaPath.sub];
      if (!subArea) return null;

      if (selectedAreaPath.ss !== undefined) {
        const subSubArea = subArea.subAreas?.[selectedAreaPath.ss];
        if (!subSubArea) return null;
        return subSubArea;
      }
      return subArea;
    }
    return mainArea;
  };

  const currentArea = getCurrentArea();

  // Get employees for this area
  const employees: Employee[] = currentArea ? (data.employeesByArea?.[areaKey] || []) : [];

  // Reset draft when switching areas
  useEffect(() => {
    if (!currentArea) {
      setEmployeeDraft({
        id: "",
        firstName: "",
        lastName: "",
        employeeNumber: "",
        dateOfBirth: "",
        gender: "Male",
        jobTitle: "",
        periodicTests: [],
        hasSTS: false
      });
      setEditingEmployeeIndex(null);
    }
  }, [areaKey, currentArea]);

  // Get display name for UI
  const getAreaName = () => {
    if (!currentArea) return "Area not found";

    if (selectedAreaPath.ss !== undefined) {
      return `Sub Sub Area: ${currentArea.name}`;
    }
    if (selectedAreaPath.sub !== undefined) {
      return `Sub Area: ${currentArea.name}`;
    }
    return `Main Area: ${currentArea.name}`;
  };

  const saveEmployeesArray = (updatedArr: Employee[]) => {
    if (readOnly) return;

    onChange({
      employeesByArea: {
        ...(data.employeesByArea || {}),
        [areaKey]: updatedArr,
      },
    });
    onSave();
  };

  // Add/Update employee
  const addEmployee = () => {
    if (readOnly) return;

    if (!employeeDraft.firstName.trim() || !employeeDraft.lastName.trim() || !employeeDraft.employeeNumber.trim()) {
      return;
    }

    const updated = [...employees];
    if (editingEmployeeIndex !== null) {
      updated[editingEmployeeIndex] = employeeDraft;
    } else {
      updated.push({ ...employeeDraft, id: uuidv4() });
    }

    saveEmployeesArray(updated);

    setEmployeeDraft({
      id: "",
      firstName: "",
      lastName: "",
      employeeNumber: "",
      dateOfBirth: "",
      gender: "Male",
      jobTitle: "",
      periodicTests: [],
      hasSTS: false
    });
    setEditingEmployeeIndex(null);
  };

  const handleEditEmployee = (index: number) => {
    if (readOnly) return;
    const emp = employees[index];
    setEmployeeDraft(emp);
    setEditingEmployeeIndex(index);
  };

  const handleDeleteEmployee = (index: number) => {
    if (readOnly) return;

    setConfirmMessage("Are you sure you want to delete this employee and all their audiometry data?");
    setConfirmCallback(() => () => {
      const updated = [...employees];
      updated.splice(index, 1);
      saveEmployeesArray(updated);
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  // Audiogram entry functions
  const openAudiogramEntry = (employeeIndex: number, type: AudiometryTestType) => {
    if (readOnly) return;
    setSelectedEmployeeForTest(employeeIndex);
    setTestType(type);
    setAudiogramDraft(createEmptyAudiogram());
    setTestDate(new Date().toISOString().split('T')[0]);
    setTesterName("");
    setTesterQualification("");
    setCalibrationDate("");
    setTestNotes("");
    setShowAudiogramEntry(true);
  };

  const saveAudiogram = () => {
    if (readOnly || selectedEmployeeForTest === null) return;

    // Validate audiogram
    const validation = validateAudiogram(audiogramDraft);
    if (!validation.isValid) {
      alert("Invalid audiogram data:\n" + validation.errors.join("\n"));
      return;
    }

    if (!testDate || !testerName || !testerQualification || !calibrationDate) {
      alert("Please complete all required fields");
      return;
    }

    const newTest: AudiometryTest = {
      id: uuidv4(),
      testType,
      testDate,
      audiogram: audiogramDraft,
      testerName,
      testerQualification,
      calibrationDate,
      notes: testNotes
    };

    const updated = [...employees];
    const employee = { ...updated[selectedEmployeeForTest] };

    if (testType === "Baseline") {
      employee.baselineTest = newTest;
    } else {
      employee.periodicTests = [...employee.periodicTests, newTest];

      // Detect STS if baseline exists
      if (employee.baselineTest) {
        const stsResult = detectSTS(employee.baselineTest.audiogram, newTest.audiogram);
        if (stsResult.hasSTS) {
          employee.hasSTS = true;
          if (!employee.stsDate) {
            employee.stsDate = testDate;
          }
          employee.stsDetails = stsResult.message;
        }
      }
    }

    updated[selectedEmployeeForTest] = employee;
    saveEmployeesArray(updated);

    setShowAudiogramEntry(false);
    setSelectedEmployeeForTest(null);
  };

  const updateAudiogramValue = (frequency: number, ear: "left" | "right", value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setAudiogramDraft(prev => ({
      ...prev,
      [frequency]: {
        ...prev[frequency as keyof AudiogramData],
        [ear]: numValue
      }
    }));
  };

  // Don't render if area doesn't exist
  if (!currentArea) {
    return (
      <Section title="Audiometry">
        <p className="text-red-500">Selected area no longer exists.</p>
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
      </Section>
    );
  }

  const isAddEmployeeEnabled = readOnly ? false : (
    employeeDraft.firstName.trim() &&
    employeeDraft.lastName.trim() &&
    employeeDraft.employeeNumber.trim() &&
    employeeDraft.dateOfBirth.trim() &&
    employeeDraft.jobTitle.trim()
  );

  return (
    <Section title="Audiometry - Hearing Conservation Program">
      <p className="text-sm text-gray-500 mb-4">{getAreaName()}</p>

      {/* Employee Entry Form */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="text-lg font-bold mb-3">Employee Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field
            label="First Name"
            type="text"
            value={employeeDraft.firstName}
            onChange={(val) => !readOnly && setEmployeeDraft(prev => ({ ...prev, firstName: val }))}
            placeholder="e.g., John"
            disabled={readOnly}
            required={true}
          />
          <Field
            label="Last Name"
            type="text"
            value={employeeDraft.lastName}
            onChange={(val) => !readOnly && setEmployeeDraft(prev => ({ ...prev, lastName: val }))}
            placeholder="e.g., Doe"
            disabled={readOnly}
            required={true}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Field
            label="Employee Number"
            type="text"
            value={employeeDraft.employeeNumber}
            onChange={(val) => !readOnly && setEmployeeDraft(prev => ({ ...prev, employeeNumber: val }))}
            placeholder="e.g., EMP-001"
            disabled={readOnly}
            required={true}
          />
          <Field
            label="Date of Birth"
            type="date"
            value={employeeDraft.dateOfBirth}
            onChange={(val) => !readOnly && setEmployeeDraft(prev => ({ ...prev, dateOfBirth: val }))}
            disabled={readOnly}
            required={true}
          />
          <div>
            <label className="block mb-1 text-sm font-medium">Gender <span className="text-red-500">*</span></label>
            <select
              className={`w-full border rounded px-2 py-2 text-sm ${readOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
              value={employeeDraft.gender}
              onChange={(e) => !readOnly && setEmployeeDraft(prev => ({ ...prev, gender: e.target.value as "Male" | "Female" | "Other" }))}
              disabled={readOnly}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <Field
            label="Job Title"
            type="text"
            value={employeeDraft.jobTitle}
            onChange={(val) => !readOnly && setEmployeeDraft(prev => ({ ...prev, jobTitle: val }))}
            placeholder="e.g., Machine Operator"
            disabled={readOnly}
            required={true}
          />
        </div>

        {!readOnly && (
          <Button variant="primary" onClick={addEmployee} disabled={!isAddEmployeeEnabled}>
            {editingEmployeeIndex !== null ? "Update Employee" : "+ Add Employee"}
          </Button>
        )}
      </div>

      {/* Employees Table */}
      {employees.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-2">Enrolled Employees</h4>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1">#</th>
                  <th className="border px-2 py-1">Name</th>
                  <th className="border px-2 py-1">Emp No.</th>
                  <th className="border px-2 py-1">Job Title</th>
                  <th className="border px-2 py-1">Age</th>
                  <th className="border px-2 py-1">Baseline Test</th>
                  <th className="border px-2 py-1">Periodic Tests</th>
                  <th className="border px-2 py-1">STS Status</th>
                  <th className="border px-2 py-1">Actions</th>
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
                      <td className="border px-2 py-1">
                        <div className="flex flex-col gap-1">
                          {!readOnly && (
                            <>
                              <Button variant="secondary" onClick={() => handleEditEmployee(idx)}>
                                Edit
                              </Button>
                              <Button
                                variant="primary"
                                onClick={() => openAudiogramEntry(idx, emp.baselineTest ? "Annual" : "Baseline")}
                              >
                                {emp.baselineTest ? "Add Periodic Test" : "Add Baseline Test"}
                              </Button>
                              <Button variant="danger" onClick={() => handleDeleteEmployee(idx)}>
                                Delete
                              </Button>
                            </>
                          )}
                          {/* View Summary Button - Always visible */}
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const summaryData = getAudiometrySummary(emp);
                              if (summaryData) {
                                alert(`Audiometry Summary for ${emp.firstName} ${emp.lastName}:\n\n${summaryData.recommendations.join("\n")}`);
                              }
                            }}
                          >
                            View Summary
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audiogram Entry Modal */}
      {showAudiogramEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl mx-4 my-8">
            <h3 className="text-xl font-bold mb-4">
              {testType} Audiogram Entry
              {selectedEmployeeForTest !== null && (
                <span className="text-sm text-gray-600 ml-2">
                  - {employees[selectedEmployeeForTest].firstName} {employees[selectedEmployeeForTest].lastName}
                </span>
              )}
            </h3>

            {/* Test Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field
                label="Test Date"
                type="date"
                value={testDate}
                onChange={setTestDate}
                required={true}
              />
              <Field
                label="Tester Name"
                type="text"
                value={testerName}
                onChange={setTesterName}
                placeholder="e.g., Dr. Smith"
                required={true}
              />
              <Field
                label="Tester Qualification"
                type="text"
                value={testerQualification}
                onChange={setTesterQualification}
                placeholder="e.g., Occupational Health Nurse"
                required={true}
              />
              <Field
                label="Audiometer Calibration Date"
                type="date"
                value={calibrationDate}
                onChange={setCalibrationDate}
                required={true}
              />
            </div>

            {/* Audiogram Grid */}
            <div className="mb-4">
              <h4 className="font-bold text-sm mb-2">Hearing Threshold Levels (dB HL)</h4>
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border px-2 py-1">Frequency (Hz)</th>
                      <th className="border px-2 py-1">Left Ear (dB HL)</th>
                      <th className="border px-2 py-1">Right Ear (dB HL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[500, 1000, 2000, 3000, 4000, 6000, 8000].map(freq => (
                      <tr key={freq}>
                        <td className="border px-2 py-1 font-medium text-center">{freq}</td>
                        <td className="border px-2 py-1">
                          <input
                            type="number"
                            value={audiogramDraft[freq as keyof AudiogramData]?.left || 0}
                            onChange={(e) => updateAudiogramValue(freq, "left", e.target.value)}
                            className="w-full border rounded px-2 py-1 text-center"
                            min="-10"
                            max="120"
                            step="5"
                          />
                        </td>
                        <td className="border px-2 py-1">
                          <input
                            type="number"
                            value={audiogramDraft[freq as keyof AudiogramData]?.right || 0}
                            onChange={(e) => updateAudiogramValue(freq, "right", e.target.value)}
                            className="w-full border rounded px-2 py-1 text-center"
                            min="-10"
                            max="120"
                            step="5"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Normal range: -10 to 25 dB HL. Values &gt;25 dB indicate hearing loss.
              </p>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block mb-1 text-sm font-medium">Notes (optional)</label>
              <textarea
                className="w-full border rounded px-2 py-2 text-sm"
                rows={3}
                value={testNotes}
                onChange={(e) => setTestNotes(e.target.value)}
                placeholder="Any additional observations or notes..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowAudiogramEntry(false)}>
                Cancel
              </Button>
              <Button variant="success" onClick={saveAudiogram}>
                Save Audiogram
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={onPrev}>
          Back
        </Button>
        {!readOnly && (
          <Button variant="success" onClick={onNext}>
            Next
          </Button>
        )}
        {readOnly && (
          <Button variant="secondary" onClick={onNext}>
            Next
          </Button>
        )}
      </div>

      {!readOnly && (
        <ConfirmDialog
          open={confirmOpen}
          title="Confirm"
          message={confirmMessage}
          onConfirm={confirmCallback}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </Section>
  );
}
