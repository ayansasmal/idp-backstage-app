# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready Backstage developer portal application built as a monorepo using Yarn workspaces. It serves as the central hub for the Integrated Developer Platform (IDP), providing service catalogs, software templates, and feature flag management capabilities.

## Repository Architecture

**Monorepo Structure:**
- `packages/app/` - React frontend application with TypeScript
- `packages/backend/` - Node.js backend with Express.js
- `plugins/` - Custom plugin directory (currently contains only README)
- `examples/` - Entity definitions, templates, and organizational data

**Key Technologies:**
- **Frontend**: React 18, Material-UI, TypeScript
- **Backend**: Node.js with Express.js, better-sqlite3 for development
- **Authentication**: Guest provider (default), configurable for AWS Cognito/GitHub OAuth
- **Database**: SQLite (development), PostgreSQL (production)
- **Testing**: Playwright for E2E, Jest for unit tests

## Development Commands

### Primary Development Workflow
```bash
# Install dependencies
yarn install

# Start development servers (both frontend and backend)
yarn start

# Build specific packages
yarn build:backend          # Build backend only
yarn build:all              # Build all packages

# Build Docker image
yarn build-image            # Uses packages/backend/Dockerfile
```

### Testing & Quality Assurance
```bash
# Run tests
yarn test                   # Run tests since last commit
yarn test:all               # Run all tests with coverage
yarn test:e2e               # Run Playwright E2E tests

# Code quality
yarn lint                   # Lint since origin/master
yarn lint:all               # Lint all files
yarn prettier:check         # Check code formatting
yarn fix                    # Auto-fix linting issues

# Type checking
yarn tsc                    # Incremental type check
yarn tsc:full               # Full type check without incremental
```

### Utility Commands
```bash
yarn clean                  # Clean build artifacts
yarn new                    # Create new Backstage packages/plugins
```

## Configuration Management

**Multi-Environment Configuration:**
- `app-config.yaml` - Base configuration with guest authentication
- `app-config.production.yaml` - Production settings with PostgreSQL
- `app-config.local.yaml` - Local development overrides

**Key Configuration Areas:**
- **Authentication**: Guest provider default, extensible to AWS Cognito/GitHub
- **Database**: SQLite (dev) vs PostgreSQL (prod) 
- **Integrations**: GitHub integration with token-based access
- **Catalog**: File-based entity loading from examples/
- **TechDocs**: Local builder with Docker generator
- **Kubernetes**: Plugin enabled for container orchestration

## Custom Features & Extensions

### ArgoCD Integration (Available - Disabled for Local Development)
**Implementation:** Real-time deployment visibility with GitOps integration
- **Backend Plugin**: `@roadiehq/backstage-plugin-argo-cd-backend` - Full ArgoCD API integration (commented out)
- **Frontend Components**: `@roadiehq/backstage-plugin-argo-cd` - Overview and history cards
- **Entity Integration**: ArgoCD cards appear automatically on service overview pages
- **Multi-Instance Support**: Production and staging ArgoCD instances configured
- **Entity Annotations**: Services use `argocd/app-name` and `argocd/instance-name` annotations

### Guest + GitHub Authentication (Current Implementation)
**Implementation:** Simplified authentication with full access for development and optional GitHub OAuth
- **Primary Authentication**: Guest provider - immediate access with full functionality
- **Secondary Authentication**: GitHub OAuth for personalized experience
- **User Management**: Local user entities in `examples/org.yaml` (guest, ayansasmal)
- **Permission System**: Disabled RBAC for unrestricted access to all features
- **Configuration**: Streamlined to two config files (app-config.yaml, app-config.local.yaml)
- **No Registration Required**: Users can access immediately as guests or authenticate with GitHub

### Feature Flags System
**Implementation:** Custom Express.js router with Unleash integration
- **Backend**: `packages/backend/src/plugins/feature-flags-backend/index.ts`
- **Frontend**: `packages/app/src/components/featureFlags/FeatureFlagsPage.tsx`
- **API Endpoints**: 
  - `GET /api/feature-flags` - List all feature flags
  - `POST /api/feature-flags` - Create new feature flags
- **Naming Convention**: `tenant.environment.application.flagName`
- **Environment Variables**: `UNLEASH_URL`, `UNLEASH_API_TOKEN`

### Software Templates
**Location**: `examples/template/` contains scaffolding templates
**Integration**: Fully integrated with Backstage scaffolder for self-service app creation

### Service Catalog
**Entity Management**: Local file-based catalog with examples in `examples/entities.yaml`
**Organizational Data**: User and group definitions in `examples/org.yaml`

## Development Patterns & Architecture

### Monorepo Management
- **Yarn Workspaces**: Manages dependencies across packages
- **TypeScript**: Shared configuration via `tsconfig.json` 
- **Build System**: Backstage CLI handles compilation and bundling

### Plugin Architecture
- **Custom Plugins**: Minimal custom plugin structure (feature flags only)
- **Backstage Plugins**: Extensive use of official Backstage plugin ecosystem
- **Plugin Registration**: Backend plugins registered in `packages/backend/src/index.ts`

### Frontend Architecture
- **React Router**: App-level routing in `packages/app/src/App.tsx`
- **Material-UI**: Consistent design system throughout
- **Permission System**: Backstage RBAC integration with catalog permissions

### Backend Architecture
- **Plugin System**: New Backstage backend system with modular plugin loading
- **Database**: Configurable client (SQLite/PostgreSQL) via app-config
- **Express Integration**: Custom routers mounted alongside Backstage plugins

## Testing Strategy

### E2E Testing
**Framework**: Playwright with Backstage-specific utilities
**Configuration**: `playwright.config.ts` with auto-generated projects
**Execution**: Runs against development server (localhost:3000) or CI server

### Unit Testing  
**Framework**: Backstage CLI test runner (Jest-based)
**Coverage**: Available via `yarn test:all`
**Scope**: Component and utility function testing

## Container & Deployment

### Docker Support
**Dockerfile**: `packages/backend/Dockerfile` for backend service
**Build Command**: `yarn build-image` creates `backstage` image
**Production**: Designed for Kubernetes deployment with IDP platform

### Integration with IDP Platform
- **Service Mesh**: Configured for Istio integration
- **GitOps**: Deployed via ArgoCD from the broader IDP platform
- **Observability**: Structured for Prometheus/Grafana monitoring

## Environment Variables

**Optional for Enhanced Functionality:**
```bash
GITHUB_TOKEN=<github-personal-access-token>
GITHUB_CLIENT_SECRET=<github-oauth-client-secret>

# ArgoCD Integration (Available but disabled for local development)
# ARGOCD_SERVER_URL=http://localhost:8080
# ARGOCD_USERNAME=admin
# ARGOCD_PASSWORD=<argocd-admin-password>
# ARGOCD_AUTH_TOKEN=<argocd-auth-token>  # Alternative to username/password

# GitHub OAuth Authentication (Optional)
GITHUB_CLIENT_ID=<github-oauth-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-client-secret>
```

**Development vs Production:**
- Development uses SQLite + Guest authentication (with optional GitHub OAuth)
- Production uses PostgreSQL + Guest/GitHub authentication (RBAC disabled for full access)
- ArgoCD integration available but disabled in backend for simpler local development
- GitHub authentication allows personalized experience but guest access provides full functionality

## Common Development Tasks

### Adding New Backstage Plugin
```bash
yarn new  # Follow prompts to create plugin
# Edit packages/backend/src/index.ts to register backend plugins
# Edit packages/app/src/App.tsx to register frontend routes
```

### Extending Feature Flags
- Backend logic in `packages/backend/src/plugins/feature-flags-backend/index.ts`
- Frontend UI in `packages/app/src/components/featureFlags/FeatureFlagsPage.tsx`
- Follow tenant.environment.application.flag naming pattern

### Modifying Service Catalog
- Add entities to `examples/entities.yaml`
- Update organizational structure in `examples/org.yaml`
- Modify catalog rules in `app-config.yaml` if needed

### Debugging and Troubleshooting
- Backend logs available via console output during `yarn start`
- Frontend debugging via React DevTools
- Database inspection: SQLite browser for development database
- E2E test debugging: Playwright trace files in `node_modules/.cache/e2e-test-results`