# GitHub Repository Setup Guide

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Configure the repository:
   - **Repository name**: `idp-backstage-app`
   - **Description**: `Backstage developer portal for Integrated Developer Platform (IDP)`
   - **Visibility**: Public (or Private based on your preference)
   - **DO NOT initialize with README, .gitignore, or license** (we already have these)

## Step 2: Push to GitHub

After creating the repository on GitHub, run these commands in the `idp-backstage-app` directory:

```bash
# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/idp-backstage-app.git

# Push to GitHub
git push -u origin main
```

## Step 3: Update IDP Platform Configuration

After pushing to GitHub, update the IDP platform configuration:

```bash
# Go back to the IDP platform directory
cd ../idp-platform

# Update the setup script with your actual GitHub repository URL
# Edit scripts/setup-backstage-external.sh and update BACKSTAGE_REPO_URL
# Replace the default URL with your actual GitHub repository URL
```

## Example Repository URLs

**If your GitHub username is `ayansasmal`:**
- Repository URL: `https://github.com/ayansasmal/idp-backstage-app.git`
- Clone URL: `https://github.com/ayansasmal/idp-backstage-app`

## Repository Information

**Repository Name**: `idp-backstage-app`
**Description**: `Backstage developer portal for Integrated Developer Platform (IDP)`
**Topics/Tags** (optional): `backstage`, `idp`, `developer-platform`, `kubernetes`, `typescript`, `nodejs`

## Repository Structure

Once pushed, your repository will contain:
- ✅ Complete Backstage application source code
- ✅ Multiple Dockerfile options for different build strategies
- ✅ Comprehensive README with integration instructions
- ✅ Package configuration with all dependencies
- ✅ TypeScript configuration and build setup
- ✅ Examples and templates for Backstage customization

## Integration with IDP Platform

The IDP platform will automatically:
1. Clone this repository during setup
2. Build the Backstage application
3. Create container images
4. Deploy via ArgoCD GitOps
5. Integrate with platform services (authentication, database, etc.)

## Next Steps After GitHub Setup

1. Update the repository URL in IDP platform scripts
2. Test the integration with `./scripts/setup-backstage-external.sh`
3. Verify automatic deployment via `./scripts/quick-start.sh`