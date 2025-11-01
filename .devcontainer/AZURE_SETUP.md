# Azure AD Configuration for Codespaces

## IMPORTANT: Configure Azure AD Redirect URIs

For this app to work in GitHub Codespaces, you need to add the Codespaces URL to your Azure AD app registration.

### Current Issue
Your Azure AD app is configured with redirect URI: `http://localhost:3000`

This ONLY works locally. For Codespaces, you need to add the Codespaces URL.

### Steps to Fix

#### 1. Find Your Codespace URL

When you run `npm start` in Codespaces, note the forwarded URL in the PORTS tab. It will look like:
```
https://USERNAME-REPONAME-xxxxx.github.dev
```

#### 2. Add to Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app: **OH Survey App** (Client ID: `b1d4d3c7-6337-48be-9748-42c1b03d59dc`)
4. Click **Authentication** in the left menu
5. Under **Platform configurations** → **Single-page application**, click **Add URI**
6. Add your Codespaces URL (e.g., `https://username-repo-xxxxx.github.dev`)
7. Click **Save**

#### 3. Recommended Setup

Add BOTH URLs to support local development AND Codespaces:
- `http://localhost:3000` (for local development)
- `https://your-codespace-url.github.dev` (for Codespaces)

**OR** use a wildcard pattern if your Azure AD plan supports it:
- `https://*.github.dev`
- `https://*.githubpreview.dev`

### Alternative: Use Environment Variable (Advanced)

If you need different Azure AD apps for local vs production:

1. Create `.env` file in the root:
```env
REACT_APP_AZURE_CLIENT_ID=your-client-id
REACT_APP_AZURE_TENANT_ID=your-tenant-id
```

2. Update `src/authConfig.ts` to use environment variables

### Testing

After adding the redirect URI:
1. Restart your Codespace (if running)
2. Run `npm start`
3. Click "Open in Browser" from the port forward notification
4. Try to sign in - it should now work!

### Still Getting Errors?

Check the browser console (F12) for specific MSAL errors. Common issues:
- **AADSTS50011**: The redirect URI mismatch
- **CORS errors**: Make sure the Codespaces URL is public
- **Network errors**: Check your internet connection
