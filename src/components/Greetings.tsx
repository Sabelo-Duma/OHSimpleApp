// src/components/Greetings.tsx
import React, { useState } from "react";
import { SurveyData } from "./types";
import Section from "./common/Section";
import Container from "./common/Container";
import ConfirmDialog from "./common/ConfirmDialog";
import GijimaLogo from "./assets/Gijima-Logo.jpg";

export interface GreetingsProps {
  username: string;
  surveys: SurveyData[];
  onNewSurvey: () => void;
  onResumeSurvey: (survey: SurveyData) => void;
  onViewSurvey: (survey: SurveyData) => void; 
  onDeleteSurvey: (surveyId: string) => void;
  onLogout: () => void;
}

export default function Greetings({
  username,
  surveys,
  onNewSurvey,
  onResumeSurvey,
  onDeleteSurvey,
  onViewSurvey,
  onLogout,
}: GreetingsProps) {
  const firstName = username.split("@")[0].replace(/\..*/, "");
  const capitalizedFirstName =
    firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const completedCount = surveys.filter(
    (s) => s.status === "Completed" || s.status === "Submitted"
  ).length;

  const inProgressCount = surveys.filter(
    (s) => s.status === "In Progress" || !s.status
  ).length;

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<string | null>(null);

  const handleDeleteClick = (surveyId: string) => {
    setSurveyToDelete(surveyId);
    setDeleteConfirmOpen(true);
  };

  const handleViewSurvey = (survey: SurveyData) => {
    // Call the parent handler to navigate to read-only view
    onViewSurvey(survey);
  };

  // Sort surveys: completed first, then by creation date
  const sortedSurveys = [...surveys].sort((a, b) => {
    // Completed surveys first
    if (a.status === "Completed" && b.status !== "Completed") return -1;
    if (a.status !== "Completed" && b.status === "Completed") return 1;
    
    // Then sort by creation date (newest first)
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  // Consistent button classes for all survey actions
  const buttonClasses = "px-3 py-1 rounded text-white text-sm font-medium transition";
  const viewButtonClasses = `${buttonClasses} bg-blue-600 hover:bg-blue-700`;
  const resumeButtonClasses = `${buttonClasses} bg-green-600 hover:bg-green-700`;
  const deleteButtonClasses = `${buttonClasses} bg-red-600 hover:bg-red-700`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8">
      <Container>
        {/* Header */}
        <div className="flex justify-between items-center mb-8 w-full">
          <img src={GijimaLogo} alt="Gijima Logo" className="h-12 w-auto" />
          <div className="flex gap-2">
            <button
              onClick={onNewSurvey}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
            >
              Start New Survey
            </button>
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Welcome message */}
        <div className="text-xl font-bold text-center mb-6 text-black-700">
          <h2 className="text-2xl font-bold text-black-700 mb-2">
            Welcome, {capitalizedFirstName}
          </h2>
          <p className="text-gray-600 font-medium text-lg">
            Manage your Occupational Health surveys.
          </p>
        </div>

        {/* Status circles */}
        <div className="flex justify-center gap-10 mb-8">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-green-500 border border-green-600 flex items-center justify-center text-white text-lg font-semibold shadow-sm">
              {completedCount}
            </div>
            <p className="mt-2 text-sm font-bold text-gray-700">Completed</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-yellow-400 border border-yellow-500 flex items-center justify-center text-white text-lg font-semibold shadow-sm">
              {inProgressCount}
            </div>
            <p className="mt-2 text-sm font-bold text-gray-700">In Progress</p>
          </div>
        </div>

        {/* Surveys Table */}
        <Section title="Track Surveys">
          <div className="w-full">
            {sortedSurveys.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed border border-gray-200 rounded-md">
                  <colgroup>
                    <col className="w-1/12" />
                    <col className="w-3/12" />
                    <col className="w-3/12" />
                    <col className="w-2/12" />
                    <col className="w-3/12" />
                  </colgroup>
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-bold text-black border-b whitespace-nowrap">#</th>
                      <th className="px-4 py-2 text-left text-sm font-bold text-black border-b">Client</th>
                      <th className="px-4 py-2 text-left text-sm font-bold text-black border-b">Project</th>
                      <th className="px-4 py-2 text-left text-sm font-bold text-black border-b">Status</th>
                      <th className="px-4 py-2 text-left text-sm font-bold text-black border-b">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedSurveys.map((s, i) => (
                      <tr key={s.id} className={s.status === "Completed" ? "bg-green-50" : ""}>
                        <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap font-medium">{i + 1}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 truncate font-medium">{s.client || "Untitled"}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 truncate font-medium">{s.project || "-"}</td>
                        <td className="px-4 py-2 text-sm font-medium">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            s.status === "Completed" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {s.status === "Completed" ? "Completed" : "In Progress"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <div className="flex gap-2">
                            {s.status === "Completed" ? (
                              <>
                                <button
                                  onClick={() => handleViewSurvey(s)}
                                  className={viewButtonClasses}
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(s.id)}
                                  className={deleteButtonClasses}
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => onResumeSurvey(s)}
                                  className={resumeButtonClasses}
                                >
                                  Resume
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(s.id)}
                                  className={deleteButtonClasses}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 mb-4 font-bold">No surveys available.</p>
            )}
          </div>
        </Section>
      </Container>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Logout"
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          onLogout();
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Survey"
        message="Are you sure you want to delete this survey? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => {
          if (surveyToDelete) onDeleteSurvey(surveyToDelete);
          setDeleteConfirmOpen(false);
          setSurveyToDelete(null);
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}