// src/components/StartSurvey.tsx
import React, { useState, useEffect } from "react";
import { SurveyData } from "./types";
import Section from "./common/Section";
import Field from "./common/Field";
import Button from "./common/Button";
import ConfirmDialog from "./common/ConfirmDialog";
import { isStepValid } from "./helpers";
import { validateSurveyInfo, getFieldError, isFieldValid } from "../utils/validation";

interface StartSurveyProps {
  data: SurveyData;
  onChange: (patch: Partial<SurveyData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onLogout?: () => void;
  onNewSurvey?: () => void;
  readOnly?: boolean;
}

export default function StartSurvey({
  data,
  onChange,
  onNext,
  onBack,
  onSave,
  readOnly = false,
}: StartSurveyProps) {
  const valid = isStepValid(1, data);

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate on data change
  useEffect(() => {
    const validation = validateSurveyInfo(data);
    setErrors(validation.errors);
  }, [data]);

  // Handle field blur to mark as touched
  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  };

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<() => void>(() => {});

  const handleSaveConfirm = () => {
    setConfirmMessage("Save changes to this survey?");
    setConfirmCallback(() => () => {
      onSave();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  // Required fields check
  const allRequiredFilled =
    !!data.client &&
    !!data.project &&
    !!data.site &&
    !!data.startDate &&
    !!data.endDate &&
    !!data.description;

  const showClientProject = !!data.client || !!data.project;

  return (
    <Section title="">
      {/* Custom header: centered title + right-aligned client/project */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-2">
        {/* Centered heading */}
        <h2 className="text-xl font-bold text-center md:absolute md:left-1/2 md:transform md:-translate-x-1/2">
          Start New Survey
        </h2>

        {/* Right side client/project (only show if at least one exists) */}
        {showClientProject && (
          <div className="ml-auto text-sm text-gray-700 text-right">
            {data.client && (
              <div>
                <span className="font-bold">Client:</span>{" "}
                <span>{data.client}</span>
              </div>
            )}
            {data.project && (
              <div>
                <span className="font-bold">Project:</span>{" "}
                <span>{data.project}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Client & Project fields */}
      <div className="flex gap-4 mb-4">
        <div className="w-1/2">
          <Field
            label="Client"
            value={data.client || ""}
            onChange={(val: string) => onChange({ client: val })}
            placeholder="e.g., Gijima Digital"
            disabled={readOnly}
            required={true}
            error={getFieldError("client", errors, touched)}
            success={isFieldValid(data.client, "client", errors)}
            onBlur={() => handleBlur("client")}
          />
        </div>
        <div className="w-1/2">
          <Field
            label="Project"
            value={data.project || ""}
            onChange={(val: string) => onChange({ project: val })}
            placeholder="e.g., Noise Study 2025"
            disabled={readOnly}
            required={true}
            error={getFieldError("project", errors, touched)}
            success={isFieldValid(data.project, "project", errors)}
            onBlur={() => handleBlur("project")}
          />
        </div>
      </div>

      {/* Start Date & End Date */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="w-full md:w-1/2">
          <Field
            label="Start Date"
            value={data.startDate || ""}
            onChange={(val: string) => onChange({ startDate: val })}
            type="date"
            placeholder="Select Start Date"
            disabled={readOnly}
            required={true}
            error={getFieldError("startDate", errors, touched)}
            success={isFieldValid(data.startDate, "startDate", errors)}
            onBlur={() => handleBlur("startDate")}
          />
        </div>
        <div className="w-full md:w-1/2">
          <Field
            label="End Date"
            value={data.endDate || ""}
            onChange={(val: string) => onChange({ endDate: val })}
            type="date"
            placeholder="Select End Date"
            disabled={readOnly}
            required={true}
            error={getFieldError("endDate", errors, touched)}
            success={isFieldValid(data.endDate, "endDate", errors)}
            onBlur={() => handleBlur("endDate")}
          />
        </div>
      </div>

      {/* Survey Type - Auto-filled, read-only */}
      <div className="mb-6">
        <Field
          label="Survey Type"
          value={data.surveyType || "Noise Zoning"}
          onChange={() => {}}
          disabled={true}
          required={false}
        />
      </div>

      {/* Site */}
      <div className="mb-4">
        <Field
          label="Site"
          value={data.site || ""}
          onChange={(val: string) => onChange({ site: val })}
          placeholder="e.g., Durban Plant"
          disabled={readOnly}
          required={true}
          error={getFieldError("site", errors, touched)}
          success={isFieldValid(data.site, "site", errors)}
          onBlur={() => handleBlur("site")}
        />
      </div>

      {/* Process and Task Description */}
      <Field
        label="Process and Task Description"
        value={data.description || ""}
        onChange={(val: string) => onChange({ description: val })}
        placeholder="Describe the task being surveyed"
        disabled={readOnly}
        required={true}
        error={getFieldError("description", errors, touched)}
        success={isFieldValid(data.description, "description", errors)}
        onBlur={() => handleBlur("description")}
      />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6">
        {/* Back button on the left */}
        <Button onClick={onBack} variant="secondary" className="w-full sm:w-auto">
          Back
        </Button>

        {/* Save + Next buttons on the right */}
        <div className="flex gap-2 flex-col sm:flex-row">
          {!readOnly ? (
            <>
              <Button
                onClick={handleSaveConfirm}
                disabled={!valid || !allRequiredFilled}
                variant="primary"
                className="w-full sm:w-auto"
              >
                Save
              </Button>
              <Button
                onClick={onNext}
                disabled={!valid || !allRequiredFilled}
                variant="success"
                className="w-full sm:w-auto"
              >
                Next
              </Button>
            </>
          ) : (
            <Button onClick={onNext} variant="secondary" className="w-full sm:w-auto">
              Next
            </Button>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Action"
        message={confirmMessage}
        onConfirm={confirmCallback}
        onCancel={() => setConfirmOpen(false)}
      />
    </Section>
  );
}