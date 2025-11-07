# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React TypeScript single-page application for Occupational Health and Safety noise survey reporting with SANAS (South African National Accreditation System) compliance. The application uses Azure AD authentication and generates Word/PDF documents with survey data.

## Development Commands

```bash
# Start development server (port 3000)
npm start

# Build for production (outputs to /build directory)
npm run build

# Run tests (Jest + React Testing Library)
npm test
```

**Note:** This project uses Create React App (react-scripts), so Webpack configuration is abstracted. Run `npm run eject` only if you need to customize build configuration (irreversible).

## Technology Stack

- **Frontend:** React 18.3.1 with TypeScript 4.9.5
- **Styling:** Tailwind CSS 3.4.17
- **Authentication:** @azure/msal-react for Azure AD integration
- **Document Generation:** docx (Word), pdfmake (PDF)
- **Data Visualization:** Chart.js + react-chartjs-2
- **Build System:** react-scripts (Create React App)

## Application Architecture

### Multi-Step Survey Workflow

The application implements a wizard pattern with two parallel flows:

**Main Survey Flow (5 steps):**
1. Survey Information - Client, project details, dates
2. Equipment Entry - Calibration data for sound level meters
3. Areas & Noise - Hierarchical area structure (3 levels deep)
4. Summary - Review all data
5. Preview - Generate and verify PDF/Word documents

**Area Details Flow (6 steps per area):**
1. Noise Sources - Identify equipment/processes
2. Measurements - Record noise levels (linked to equipment)
3. Controls - Engineering and administrative controls
4. Hearing Protection - PPE documentation
5. Exposures - Employee exposure data
6. Comments - Additional notes

### Component Organization

```
src/components/
├── common/              # Reusable UI components
│   ├── Button.tsx       # Primary UI button
│   ├── Field.tsx        # Form field wrapper with labels
│   ├── Section.tsx      # Content section containers
│   ├── ProgressBar.tsx  # Step progress indicator
│   └── ...
├── OHSimpleApp.tsx      # Main application orchestrator (step management)
├── Greetings.tsx        # Landing page with survey list management
├── StartSurvey.tsx      # Survey initialization
├── AreaAndNoise.tsx     # Area hierarchy management
├── MeasurementForm.tsx  # Noise measurement entry
├── Preview.tsx          # Document generation and preview
├── helpers.ts           # Document generation utilities (118KB)
└── types.ts             # TypeScript type definitions
```

### State Management Pattern

- **Local State:** React hooks (useState, useEffect)
- **Persistence:** localStorage for draft surveys
- **Data Structure:** Single nested object with area-specific data indexed by `areaRef` strings
- **Survey Status:** "In Progress" | "Completed" | "Submitted"

**Critical:** Area-specific data is indexed by `areaRef` (e.g., "A1", "A1-S1") to avoid TypeScript index signature issues. Always use this pattern when accessing area data.

### Authentication Flow

1. MSAL initialization with redirect handling in `App.tsx`
2. `authConfig.ts` contains Azure AD configuration
3. Redirect URI uses `window.location.origin` for environment flexibility (local, Codespaces, production)
4. Login component handles interactive login/logout
5. Token caching in localStorage

**Azure AD Configuration:**
- Client ID: b1d4d3c7-6337-48be-9748-42c1b03d59dc
- Tenant ID: 304a744d-e751-4784-ab75-8f3d44b8dbd5
- Authority: login.microsoftonline.com

## Document Generation

Located in `src/components/helpers.ts` (118KB file):

- **Word Export:** Uses `docx` library with yellow highlighting for user-entered data
- **PDF Export:** Uses pdfmake with custom styling and SANAS-compliant formatting
- **Document Structure:** Title page, equipment calibration, area details, measurements, controls, exposures

**Pattern:** All document generation functions accept the full survey data object and return document definitions.

## Data Model Key Concepts

### Area Hierarchy
```typescript
{
  areas: [
    {
      ref: "A1",                    // Main area reference
      name: "Factory Floor",
      subAreas: [
        {
          ref: "A1-S1",            // Sub-area reference
          name: "Press Section",
          subSubAreas: [
            {
              ref: "A1-S1-SS1",    // Sub-sub-area reference
              name: "Press 1"
            }
          ]
        }
      ]
    }
  ]
}
```

### Area-Specific Data Indexing
```typescript
// Always use areaRef as string key
areaData[areaRef] = {
  noiseSources: [...],
  measurements: [...],
  controls: {...},
  hearingProtection: {...},
  exposures: [...],
  comments: ""
}
```

### Equipment Linking
Equipment entries have unique IDs that are referenced in measurements to link calibration data with noise readings.

## Development Environment Support

### Local Development
```bash
npm install
npm start
# Opens at http://localhost:3000
```

### GitHub Codespaces
The project is fully configured for Codespaces:
- `.devcontainer/devcontainer.json` - Node 18 container
- Automatic `npm install` on creation
- Port 3000 forwarding with HTTPS

**Critical:** In Codespaces, you MUST use the forwarded URL (not localhost). Click "Open in Browser" from the PORTS tab when prompted.

**Authentication:** Dynamic redirect URI (`window.location.origin`) works automatically in Codespaces, but the Codespaces URL must be registered in Azure AD. See `.devcontainer/AZURE_SETUP.md` for instructions.

## Deployment

### Azure Static Web Apps
Deployed via GitHub Actions CI/CD:
- Workflow: `.github/workflows/azure-static-web-apps-victorious-ocean-0249ea500.yml`
- Trigger: Push to `main` branch
- Build: Automated `npm run build`
- Production URL: https://victorious-ocean-0249ea500.azurestaticapps.net

### Configuration
- `staticwebapp.config.json` - Routing rules, CSP headers, MIME types
- Environment variables in `.env` for development proxy and Codespaces compatibility

## Code Patterns and Conventions

### Form Components
All form steps follow this pattern:
1. Receive survey data and setter as props
2. Implement controlled inputs bound to survey state
3. Validate on "Next" button click
4. Return validation results to parent (OHSimpleApp)

### Step Navigation
Managed by `OHSimpleApp.tsx`:
- Main flow: 5 steps
- Area details: 6 sub-steps with step 0 as area selection
- Progress bar shows completion percentage
- "Previous" navigation allowed at any step
- Validation required before "Next"

### Read-Only Mode
When viewing completed surveys:
- All inputs disabled with `disabled={true}` or `readOnly={true}`
- No edit/save functionality
- Preview step still generates documents

### Document Generation Workflow
1. User completes all survey steps
2. Summary page shows all data
3. Preview page generates PDF/Word documents
4. User verifies document accuracy
5. Download buttons available for both formats

## Common Development Scenarios

### Adding a New Form Step
1. Create component in `src/components/`
2. Accept `data`, `setData`, `isReadOnly` props
3. Implement validation logic
4. Add to step sequence in `OHSimpleApp.tsx`
5. Update progress bar step count

### Modifying Document Output
1. Edit functions in `src/components/helpers.ts`
2. Test with sample survey data
3. Verify SANAS compliance requirements
4. Test both Word and PDF outputs

### Adding New Area Data Fields
1. Update types in `src/components/types.ts`
2. Add form fields in relevant step component
3. Update `areaData[areaRef]` initialization
4. Update document generation functions in `helpers.ts`

### Testing Authentication
For local/Codespaces testing:
- Ensure your user account is in the Azure AD tenant
- Add new redirect URIs to Azure AD app registration
- Test login/logout flow
- Verify token caching and refresh

## Important Files

- `src/components/OHSimpleApp.tsx` - Main app logic and step management (entry point)
- `src/components/helpers.ts` - Document generation (Word/PDF)
- `src/components/types.ts` - TypeScript definitions for survey data model
- `src/authConfig.ts` - Azure AD authentication configuration
- `staticwebapp.config.json` - Production routing and security headers
- `.devcontainer/devcontainer.json` - Codespaces environment setup

## Known Issues and Workarounds

### Codespaces Authentication
If Azure AD returns AADSTS50011 error, the Codespaces forwarded URL is not registered in Azure AD. Follow `.devcontainer/AZURE_SETUP.md` to add the URL to the app registration.

### TypeScript Index Signatures
The codebase uses string keys (areaRef) instead of numeric indices to avoid TypeScript errors with complex nested objects. Maintain this pattern when adding new area-related data structures.

### Large Helper File
`helpers.ts` is 118KB because it contains all document generation logic. Consider splitting into separate modules if adding significant new document types.

## SANAS Compliance

Documents must include:
- Company name and logo
- Survey date and location
- Calibration data for all equipment
- Detailed noise measurements with equipment references
- Engineering and administrative controls
- Employee exposure calculations
- Signature blocks for approval

Always verify generated documents meet these requirements when modifying document generation code.
