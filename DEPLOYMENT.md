# Azure Static Web Apps Deployment Guide

## Files Created

1. **[staticwebapp.config.json](staticwebapp.config.json)** - Azure Static Web Apps configuration
2. **[.github/workflows/azure-static-web-apps.yml](.github/workflows/azure-static-web-apps.yml)** - GitHub Actions workflow for automated deployment

## Deployment Steps

### Step 1: Create Azure Static Web App

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource" and search for "Static Web App"
3. Click "Create"

### Step 2: Configure the Static Web App

Fill in the following details:

- **Subscription**: Select your Azure subscription
- **Resource Group**: Create new or use existing (e.g., "oh-survey-rg")
- **Name**: Choose a unique name (e.g., "oh-survey-app")
- **Plan type**: Select "Free" for development or "Standard" for production
- **Region**: Choose the closest region to your users
- **Deployment source**: Select "GitHub"

### Step 3: Connect to GitHub (DETAILED)

When you reach the "Deployment details" section in the Azure portal:

1. **Click "Sign in with GitHub"** button
   - A popup window will open asking you to authenticate with GitHub
   - Enter your GitHub credentials if not already logged in

2. **Authorize Azure Static Web Apps**
   - GitHub will ask: "Azure Static Web Apps wants to access your Sabelo-Duma account"
   - Review the permissions (it needs access to read/write workflows and secrets)
   - Click **"Authorize Azure Static Web Apps"** button (green button)
   - You may need to enter your GitHub password again to confirm

3. **Select your repository details**

   After authorization, you'll see dropdown menus in the Azure portal:

   - **Organization**: Click the dropdown and select `Sabelo-Duma`
     (This is your GitHub username/organization)

   - **Repository**: Click the dropdown and select `OHSimpleApp`
     (This is your repository name - it should appear in the list)

   - **Branch**: Click the dropdown and select `main`
     (This is the branch that will trigger deployments)

4. **What happens behind the scenes**:
   - Azure will automatically add a secret called `AZURE_STATIC_WEB_APPS_API_TOKEN` to your GitHub repository
   - This secret allows GitHub Actions to deploy to your Azure Static Web App
   - Azure will use the workflow file we created at `.github/workflows/azure-static-web-apps.yml`

**Troubleshooting:**
- **Can't see your repository?** Make sure you've pushed the code to GitHub first
- **Authorization failed?** Check your GitHub account has admin access to the repository
- **Wrong organization?** Make sure you're selecting `Sabelo-Duma`, not another organization

### Step 4: Build Configuration

Azure will auto-detect these settings (verify they match):

- **App location**: `/`
- **Api location**: (leave empty)
- **Output location**: `build`

### Step 5: Review and Create

1. Click "Review + create"
2. Review all settings
3. Click "Create"

Azure will:
- Create the Static Web App resource
- Add a GitHub Action workflow secret to your repository (`AZURE_STATIC_WEB_APPS_API_TOKEN`)
- Trigger the first deployment automatically

### Step 6: Update Azure AD App Registration

Once deployed, you need to update your authentication redirect URIs:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Select your app registration (used in [authConfig.ts](src/authConfig.ts))
4. Go to "Authentication" > "Platform configurations" > "Single-page application"
5. Add your new Azure Static Web App URL:
   - Format: `https://<your-app-name>.azurestaticapps.net`
   - Example: `https://oh-survey-app.azurestaticapps.net`
6. Click "Save"

### Step 7: Update Environment Variables (if needed)

If you have environment variables in your `.env` file:

1. In Azure Portal, go to your Static Web App
2. Click "Configuration" in the left menu
3. Add any required environment variables (prefix with `REACT_APP_`)
4. Click "Save"

## Monitoring Deployment

### View Deployment Status

1. Go to your GitHub repository: https://github.com/Sabelo-Duma/OHSimpleApp
2. Click the "Actions" tab
3. You'll see the "Azure Static Web Apps CI/CD" workflow running

### View App URL

After successful deployment:

1. Go to your Static Web App in Azure Portal
2. The URL will be displayed on the Overview page
3. Format: `https://<your-app-name>.azurestaticapps.net`

## Automatic Deployments

The workflow is configured to automatically deploy when:

- You push to the `main` branch
- A pull request is opened, updated, or closed

## Troubleshooting

### Build Fails

Check the GitHub Actions logs:
1. Go to "Actions" tab in your repository
2. Click on the failed workflow run
3. Expand the build logs to see errors

### App Doesn't Load

1. Check browser console for errors
2. Verify the Static Web App URL is added to Azure AD redirect URIs
3. Check that environment variables are set correctly

### Authentication Issues

Make sure your Azure AD app registration includes:
- The Azure Static Web App URL in redirect URIs
- Correct permissions configured
- Correct tenant ID and client ID in [authConfig.ts](src/authConfig.ts)

## Custom Domain (Optional)

To add a custom domain:

1. In Azure Portal, go to your Static Web App
2. Click "Custom domains" in the left menu
3. Click "Add"
4. Follow the instructions to verify domain ownership

## Next Steps

After deployment:
1. Test your app at the Azure Static Web App URL
2. Verify authentication works
3. Test all features
4. Share the URL with your team
5. Consider setting up monitoring and analytics

## Support

For issues or questions:
- Azure Static Web Apps: https://docs.microsoft.com/azure/static-web-apps/
- GitHub Actions: https://docs.github.com/actions
