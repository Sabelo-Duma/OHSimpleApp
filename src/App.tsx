// src/App.tsx
import React, { useEffect, useState } from "react";
import { MsalProvider, useMsal, useIsAuthenticated } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";
import OHSimpleApp from "./components/OHSimpleApp";
import Login from "./components/Login";
import Greetings from "./components/Greetings";
import { SurveyData, emptySurvey } from "./components/types";

const pca = new PublicClientApplication(msalConfig);

function AppContent() {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [loaded, setLoaded] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveys, setSurveys] = useState<SurveyData[]>(() => {
    const saved = localStorage.getItem("surveysInProgress");
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSurvey, setCurrentSurvey] = useState<SurveyData | null>(null);
  const [isViewMode, setIsViewMode] = useState(false); // Add this state for view mode

  // ✅ Proper MSAL initialization
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        await instance.initialize(); // must await first
        const response = await instance.handleRedirectPromise();
        const allAccounts = instance.getAllAccounts();

        if (!instance.getActiveAccount()) {
          if (response?.account) instance.setActiveAccount(response.account);
          else if (allAccounts.length > 0) instance.setActiveAccount(allAccounts[0]);
        }

        if (active) setAccounts(instance.getAllAccounts());
      } catch (err) {
        console.error("MSAL initialization error:", err);
      } finally {
        if (active) setLoaded(true);
      }
    };

    init();
    return () => { active = false; };
  }, [instance]);

  if (!loaded || inProgress === "login") {
    return (
      <div className="flex h-screen items-center justify-center text-xl text-blue-700">
        Signing you in...
      </div>
    );
  }

  if (!isAuthenticated || accounts.length === 0) return <Login />;

  const user = { username: accounts[0].username };

  // --- Survey Handlers ---
  const startNewSurvey = () => {
    const newSurvey: SurveyData = { ...emptySurvey, id: Date.now().toString() };
    setCurrentSurvey(newSurvey);
    setShowSurvey(true);
    setIsViewMode(false); // Not view mode for new surveys
  };

  const handleResumeSurvey = (survey: SurveyData) => {
    setCurrentSurvey(survey);
    setShowSurvey(true);
    setIsViewMode(false); // Not view mode for resuming
  };

  // Handle viewing completed surveys in read-only mode
  const handleViewSurvey = (survey: SurveyData) => {
    setCurrentSurvey(survey);
    setShowSurvey(true);
    setIsViewMode(true); // Set to view mode for completed surveys
  };

  // commit only if user confirms save
  const handleSaveSurvey = (survey: SurveyData) => {
    const updated = [...surveys.filter((s) => s.id !== survey.id), survey];
    setSurveys(updated);
    localStorage.setItem("surveysInProgress", JSON.stringify(updated));
  };

  // exit without saving (unless user confirms save inside OHSimpleApp)
  const handleExitSurvey = (survey: SurveyData) => {
    setCurrentSurvey(null);
    setShowSurvey(false);
    setIsViewMode(false); // Reset view mode when exiting
  };

  const handleDeleteSurvey = (surveyId: string) => {
    const updated = surveys.filter((s) => s.id !== surveyId);
    setSurveys(updated);
    localStorage.setItem("surveysInProgress", JSON.stringify(updated));
  };

  const handleLogout = () => {
    setShowSurvey(false);
    setIsViewMode(false);
    instance.logoutPopup();
  };

  if (!showSurvey || currentSurvey === null) {
    return (
      <Greetings
        username={user.username}
        surveys={surveys}
        onNewSurvey={startNewSurvey}
        onResumeSurvey={handleResumeSurvey}
        onViewSurvey={handleViewSurvey}
        onDeleteSurvey={handleDeleteSurvey}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <OHSimpleApp
      initialSurvey={currentSurvey}
      onExit={handleExitSurvey}
      onSaveSurvey={handleSaveSurvey}
      readOnly={isViewMode}
    />
  );
}

export default function App() {
  return (
    <MsalProvider instance={pca}>
      <AppContent />
    </MsalProvider>
  );
}