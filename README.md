# OH Survey App

A React-based application for Occupational Health and Safety noise survey reporting with SANAS compliance.

---

## 🚨 CRITICAL: If You See "localhost refused to connect"

**You're trying to use `localhost:3000` - this does NOT work in Codespaces!**

**Quick Fix:**
1. Look at the bottom of VSCode
2. Click the **PORTS** tab
3. Find port **3000**
4. Right-click → **Open in Browser**

**Full Guide:** [.devcontainer/HOW_TO_ACCESS.md](.devcontainer/HOW_TO_ACCESS.md)

---

## Testing in GitHub Codespaces

### Quick Start

1. Click the **"Code"** button on the GitHub repository
2. Select **"Codespaces"** tab
3. Click **"Create codespace on main"**
4. Wait for the environment to set up (it will automatically run `npm install`)
5. Once ready, run: `npm start`
6. **CRITICAL:** When the app starts, click the popup notification "Open in Browser"

### Accessing the App - IMPORTANT!

**DO NOT USE `localhost:3000`** - This will fail in Codespaces!

When the app starts, you MUST use the Codespaces forwarded URL:

**Option 1: Automatic (Recommended)**
- A popup will appear saying "Your application running on port 3000 is available"
- Click **"Open in Browser"**
- This will open the correct HTTPS URL automatically

**Option 2: Manual**
1. Look at the **PORTS** tab at the bottom of VSCode
2. Find port **3000**
3. Right-click → **"Open in Browser"**
4. The URL will look like: `https://username-repo-xxxxx.github.dev`

**Option 3: Share with Others**
1. In the **PORTS** tab, find port 3000
2. Right-click → Change Port Visibility → **"Public"**
3. Copy the forwarded address and share it

### Common Issues & Solutions

#### "Failed to connect to localhost" ❌
**Problem:** You're trying to access `http://localhost:3000`
**Solution:** You MUST use the Codespaces forwarded URL (see "Accessing the App" above)

The app authentication is now configured to work with ANY URL (local or Codespaces), but you still need to access it through the forwarded address in Codespaces.

#### postCreateCommand fails ❌
**Problem:** `npm install` failed during setup
**Solutions:**
- Check the creation log: Cmd/Ctrl + Shift + P → "View Creation Log"
- Delete the codespace and recreate it
- Check for network issues during dependency installation
- The devcontainer uses Node 18 (more stable than Node 16)

#### Port 3000 not showing ❌
**Solutions:**
- Open the **PORTS** tab: View → PORTS
- Click **"Forward a Port"** and enter `3000`
- Set visibility to **"Public"** to share with others

#### Authentication redirects to localhost ❌
**Problem:** This was caused by hardcoded redirect URI
**Solution:** Already fixed! The app now uses `window.location.origin` which works everywhere

#### Azure AD Authentication Fails (AADSTS50011) ❌
**Problem:** Your Codespaces URL is not registered in Azure AD
**Solution:** See [.devcontainer/AZURE_SETUP.md](.devcontainer/AZURE_SETUP.md) for step-by-step instructions to add your Codespaces URL to Azure AD app registration

## Local Development

### Prerequisites
- Node.js 16.x or higher
- npm

### Installation
```bash
npm install
```

### Running the App
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Building for Production
```bash
npm run build
```

### Running Tests
```bash
npm test
```

## Features

- Noise survey data collection and analysis
- SANAS-compliant report generation
- PDF export functionality
- Interactive charts and visualizations
- Employee exposure tracking

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Chart.js
- jsPDF / pdfmake for report generation
- Azure MSAL for authentication
