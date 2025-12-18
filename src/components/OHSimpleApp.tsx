// src/components/OHSimpleApp.tsx
import React, { useState, useRef, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { SurveyData, Step, emptySurvey, AreaPath } from "./types";
import Container from "./common/Container";
import ProgressBar from "./common/ProgressBar";
import StartSurvey from "./StartSurvey";
import EquipmentEntry from "./EquipmentEntry";
import AreaAndNoise from "./AreaAndNoise";
import NoiseSources from "./NoiseSources";
import MeasurementForm from "./MeasurementForm";
import ControlsForm from "./ControlsForm";
import Summary from "./Summary";
import GijimaLogo from "./assets/Gijima-Logo.jpg";
import HearingProtectionForm from "./HearingProtectionForm";
import ExposuresForm from "./ExposuresForm";
import CommentsForm from "./CommentsForm";
import Preview from "./Preview";
import LastSaved from "./common/LastSaved";

interface OHSimpleAppProps {
  initialSurvey: SurveyData;
  onExit: (survey: SurveyData) => void;
  onSaveSurvey: (survey: SurveyData) => void;
  readOnly?: boolean;
}

export default function OHSimpleApp({
  initialSurvey,
  onExit,
  onSaveSurvey,
  readOnly = false
}: OHSimpleAppProps) {
  const { instance } = useMsal();
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Top-level survey flow ---
  const surveySteps = ["Survey", "Equipment", "Areas & Noise", "Summary", "Preview"];
  const [surveyStep, setSurveyStep] = useState<Step>(1);

  // --- Area details flow ---
  const detailSteps = [
    "Noise Sources",
    "Measurement",
    "Controls",
    "Hearing",
    "Exposures",
    "Comments",
  ];
  const modeToStepIndex: Record<string, number> = {
    noise: 0,
    measurement: 1,
    controls: 2,
    hearing: 3,
    exposures: 4,
    comments: 5,
  };

  const [mode, setMode] = useState<
    "survey" | "noise" | "measurement" | "controls" | "hearing" | "exposures" | "comments"
  >("survey");

  const [data, setData] = useState<SurveyData>(initialSurvey);
  const [currentAreaPath, setCurrentAreaPath] = useState<AreaPath | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- Utility Patch Helper ---
  const patch = (patchData: Partial<SurveyData>) =>
    setData((prev) => ({ ...prev, ...patchData }));

  // --- Auto-Save: Save survey every 30 seconds ---
  useEffect(() => {
    if (readOnly) return; // Don't auto-save in read-only mode

    const autoSaveInterval = setInterval(() => {
      setIsSaving(true);
      try {
        onSaveSurvey(data);
        setLastSaved(new Date());
      } catch (error) {
        console.error("Auto-save failed:", error);
      } finally {
        setIsSaving(false);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [data, readOnly, onSaveSurvey]);

  // --- Auto scroll top when navigating ---
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [surveyStep, mode]);

  // Read-only mode is handled via UI - no logging needed

  const startNewSurvey = () => {
    setData({ ...emptySurvey, id: Date.now().toString() });
    setSurveyStep(1);
    setMode("survey");
    setCurrentAreaPath(null);
  };

  // --- Mark Area as Completed (Immutable) ---
  const markCompleted = (areas: typeof data.areas, path: AreaPath): typeof data.areas => {
    const main = areas[path.main];
    if (!main) return areas;

    const updatedAreas = [...areas];

    if (path.ss !== undefined) {
      // Deep clone for sub-sub-area update
      const subAreas = main.subAreas ?? [];
      const subIndex = path.sub ?? 0;
      const subSubAreas = subAreas[subIndex]?.subAreas ?? [];

      const updatedSubSubAreas = [...subSubAreas];
      updatedSubSubAreas[path.ss] = {
        ...subSubAreas[path.ss],
        detailsCompleted: true
      };

      const updatedSubAreas = [...subAreas];
      updatedSubAreas[subIndex] = {
        ...subAreas[subIndex],
        subAreas: updatedSubSubAreas
      };

      updatedAreas[path.main] = {
        ...main,
        subAreas: updatedSubAreas
      };
    } else if (path.sub !== undefined) {
      // Deep clone for sub-area update
      const subAreas = main.subAreas ?? [];
      const updatedSubAreas = [...subAreas];
      updatedSubAreas[path.sub] = {
        ...subAreas[path.sub],
        detailsCompleted: true
      };

      updatedAreas[path.main] = {
        ...main,
        subAreas: updatedSubAreas
      };
    } else {
      // Main area update
      updatedAreas[path.main] = {
        ...main,
        detailsCompleted: true
      };
    }

    return updatedAreas;
  };

  // --- Handle Preview Completion ---
  const handlePreviewComplete = (completedSurvey: SurveyData) => {
    if (readOnly) {
      // In read-only mode, just go back to the beginning
      onExit(data);
      return;
    }

    // Save the completed survey with all verification data
    onSaveSurvey(completedSurvey);

    // Return to Greetings screen
    onExit(completedSurvey);
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50">
      <Container>
        {/* --- Header --- */}
        <div className="flex justify-between items-center p-2 sm:p-4 border-b bg-white shadow-sm gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <img src={GijimaLogo} alt="Gijima Logo" className="h-8 sm:h-12 w-auto" />
            {readOnly && (
              <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs sm:text-sm font-medium">
                View Only
              </div>
            )}
          </div>

          {/* Last Saved Indicator & Logout */}
          <div className="flex items-center gap-3">
            {!readOnly && (
              <LastSaved lastSaved={lastSaved} isSaving={isSaving} />
            )}
            <button
              onClick={() => {
                onExit(data);
                instance.logoutPopup();
              }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-md bg-red-600 text-white text-xs sm:text-sm font-medium hover:bg-red-700 transition whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </div>

        {/* --- Main Survey Flow --- */}
        {mode === "survey" && (
          <>
            <ProgressBar
              step={surveyStep}
              totalSteps={surveySteps.length}
              steps={surveySteps}
            />

            {surveyStep === 1 && (
              <StartSurvey
                data={data}
                onChange={patch}
                onNext={() => setSurveyStep(2)}
                onBack={() => onExit(data)}
                onSave={() => onSaveSurvey(data)}
                readOnly={readOnly}
              />
            )}

            {surveyStep === 2 && (
              <EquipmentEntry
                data={data}
                onChange={patch}
                onPrev={() => setSurveyStep(1)}
                onNext={() => setSurveyStep(3)}
                onSave={() => onSaveSurvey(data)}
                onDetails={() => setMode("noise")}
                readOnly={readOnly}
              />
            )}

            {surveyStep === 3 && (
              <AreaAndNoise
                data={data}
                onChange={patch}
                onPrev={() => setSurveyStep(2)}
                onNext={() => setSurveyStep(4)}
                onSave={() => onSaveSurvey(data)}
                onOpenDetails={(path) => {
                  setCurrentAreaPath(path ?? null);
                  setMode("noise");
                }}
                readOnly={readOnly}
              />
            )}

            {surveyStep === 4 && (
              <Summary
                data={data}
                onPrev={() => setSurveyStep(3)}
                onNext={() => setSurveyStep(5)}
                onReset={startNewSurvey}
                readOnly={readOnly}
              />
            )}

            {surveyStep === 5 && (
              <Preview
                data={data}
                onPrev={() => setSurveyStep(4)}
                onNext={handlePreviewComplete}
                readOnly={readOnly}
              />
            )}
          </>
        )}

        {/* --- Detailed Area Flow --- */}
        {mode !== "survey" && currentAreaPath && (
          <>
            <ProgressBar
              step={modeToStepIndex[mode] + 1}
              totalSteps={detailSteps.length}
              steps={detailSteps}
            />

            {mode === "noise" && (
              <NoiseSources
                data={data}
                onChange={patch}
                onNext={() => setMode("measurement")}
                onSave={() => onSaveSurvey(data)}
                onBackToSurvey={() => setMode("survey")}
                selectedAreaPath={currentAreaPath}
                readOnly={readOnly}
              />
            )}

            {mode === "measurement" && (
              <MeasurementForm
                data={data}
                selectedAreaPath={currentAreaPath}
                equipmentOptions={data.equipment
                  .filter((eq) => eq.type === "SLM")
                  .map((eq) => ({
                    label: eq.name,
                    value: eq.id,
                  }))}
                onNext={() => setMode("controls")}
                onPrev={() => setMode("noise")}
                onChange={(patchData) => {
                  // Merge the patch into main survey data immutably
                  setData((prev) => {
                    const updated = { ...prev, ...patchData };
                    onSaveSurvey(updated); // optional persistence
                    return updated;
                  });
                }}
                onSave={() => onSaveSurvey(data)} // optional external save
                readOnly={readOnly}
              />
            )}

            {mode === "controls" && (
              <ControlsForm
                data={data}
                selectedAreaPath={currentAreaPath}
                onNext={() => setMode("hearing")}
                onPrev={() => setMode("measurement")}
                onChange={patch}
                onSave={() => onSaveSurvey(data)}
                readOnly={readOnly}
              />
            )}

            {mode === "hearing" && (
  <HearingProtectionForm
    data={data}
    selectedAreaPath={currentAreaPath}
    onChange={patch}
    onSave={() => onSaveSurvey(data)}
    onNext={() => setMode("exposures")}
    onPrev={() => setMode("controls")}
    readOnly={readOnly}
  />
)}

            {mode === "exposures" && (
              <ExposuresForm
                data={data}
                onChange={patch}
                selectedAreaPath={currentAreaPath}
                onNext={() => setMode("comments")}
                onPrev={() => setMode("hearing")}
                readOnly={readOnly}
              />
            )}

            {mode === "comments" && (
              <CommentsForm
                data={data}
                onChange={patch}
                onPrev={() => setMode("exposures")}
                currentStep={modeToStepIndex["comments"] + 1}
                totalSteps={detailSteps.length}
                currentAreaPath={currentAreaPath}
                onFinishArea={(path) => {
                  if (readOnly) {
                    setMode("survey");
                    setCurrentAreaPath(null);
                    return;
                  }

                  setData((prev) => {
                    const updatedAreas = markCompleted(prev.areas, path);
                    return { ...prev, areas: updatedAreas };
                  });
                  setMode("survey");
                  setCurrentAreaPath(null);
                }}
                readOnly={readOnly}
              />
            )}
          </>
        )}
      </Container>
    </div>
  );
}