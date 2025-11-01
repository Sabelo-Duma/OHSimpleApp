import { Configuration, LogLevel } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: "b1d4d3c7-6337-48be-9748-42c1b03d59dc",
    authority: "https://login.microsoftonline.com/304a744d-e751-4784-ab75-8f3d44b8dbd5",
    redirectUri: window.location.origin, // ✅ Works in both local and Codespaces
    navigateToLoginRequestUrl: false, // ✅ prevents reload loops after redirect
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
        }
      },
      logLevel: LogLevel.Info,
      piiLoggingEnabled: false,
    },
  },
};

// Request scopes for login
export const loginRequest = {
  scopes: ["User.Read"],
};

