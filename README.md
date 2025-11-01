# OH Survey App

A React-based application for Occupational Health and Safety noise survey reporting with SANAS compliance.

## Testing in GitHub Codespaces

### Quick Start

1. Click the "Code" button on the GitHub repository
2. Select "Codespaces" tab
3. Click "Create codespace on main"
4. Wait for the environment to set up (it will automatically run `npm install`)
5. Once ready, run: `npm start`
6. The app will open automatically at port 3000

### Accessing the App

When the app starts, GitHub Codespaces will:
- Automatically forward port 3000
- Show a notification with a button to "Open in Browser"
- You can also find the forwarded URL in the "PORTS" tab at the bottom of VSCode

### Troubleshooting

#### "Failed to connect to localhost"
- Make sure you're using the forwarded URL from Codespaces (e.g., `https://username-repository-xxxxx.githubpreview.dev`)
- **Do NOT use** `localhost:3000` - this won't work in Codespaces
- Check the PORTS tab to see the correct forwarded address

#### postCreateCommand fails
- This usually means `npm install` failed
- Check the creation log: Cmd/Ctrl + Shift + P → "View Creation Log"
- Common fixes:
  - Ensure package.json is valid
  - Check for network issues during dependency installation
  - The devcontainer now uses Node 18 (more stable than Node 16)

#### Port 3000 not showing
- Open the PORTS tab (View → PORTS)
- Click "Add Port" and enter `3000`
- Set visibility to "Public" if you want to share with others

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
