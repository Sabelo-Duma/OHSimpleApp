import React from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";

export default function Login() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((error) => {
      console.error("Login failed:", error);
    });
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white p-10 rounded-3xl shadow-xl w-96 text-center">
        <h2 className="text-2xl font-bold mb-4 text-blue-800">
          Welcome to OH Survey
        </h2>
        <p className="text-gray-600 mb-8">
          Sign in to continue.
        </p>

        {/* Microsoft Login Button */}
        <button
          onClick={handleLogin}
          className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 shadow-md"
        >
          {/* Microsoft logo with colors */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6">
            <rect width="12" height="12" fill="#F35325" />
            <rect x="12" width="12" height="12" fill="#81BC06" />
            <rect y="12" width="12" height="12" fill="#05A6F0" />
            <rect x="12" y="12" width="12" height="12" fill="#FFBA08" />
          </svg>
          <span className="text-gray-800 font-semibold">Sign in with Microsoft</span>
        </button>

        <p className="text-gray-400 text-sm mt-6">
          OH Survey & Automation &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}









