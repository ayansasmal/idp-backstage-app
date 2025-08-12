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

## Latest Platform Updates

### 🚀 Unleash Feature Flags Integration (JUST COMPLETED)
**Status**: Complete enterprise-grade feature flags API with Unleash OSS integration

#### **Decoupled Backend Plugin Architecture**
- Created `@internal/plugin-unleash-feature-flags-backend` as standalone Backstage plugin
- Fully decoupled from Backstage implementation for better maintainability
- Professional plugin structure with proper TypeScript types and error handling

#### **Comprehensive API Endpoints**
```bash
# Feature Flag Management
GET    /api/unleash-feature-flags          # List flags with optional filtering
POST   /api/unleash-feature-flags          # Create new feature flag
GET    /api/unleash-feature-flags/:name    # Get feature flag details
PATCH  /api/unleash-feature-flags/:name/toggle  # Toggle feature flag state
DELETE /api/unleash-feature-flags/:name    # Delete (archive) feature flag

# Feature Flag Evaluation
POST   /api/unleash-feature-flags/evaluate/:name  # Evaluate flag for user context

# Health Monitoring
GET    /api/unleash-feature-flags/health/status   # Service health check
```

#### **Dual-Mode Operation**
- **Development Mode**: Uses mock data when no Unleash token is configured
- **Production Mode**: Full integration with Unleash OSS when deployed on IDP platform
- **Graceful Fallback**: Automatic fallback to mock data if Unleash is unavailable

#### **Configuration Support**
```yaml
unleash:
  url: http://localhost:4242/api              # Unleash client API URL
  adminUrl: http://localhost:4242/api/admin   # Unleash admin API URL
  apiToken: your-unleash-api-token            # API token for admin operations
  instanceId: idp-backstage                   # Unique instance identifier
```

#### **Enterprise Features**
- **Naming Convention**: `{tenant}.{environment}.{application}.{flagName}`
- **Multi-Tenant Support**: Support for multiple tenants and environments
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Security**: JWT validation and authentication policies
- **Observability**: Structured logging and health monitoring

### 🐳 Production Docker Support (JUST ADDED)
**Status**: Multi-stage Docker builds ready for IDP platform deployment

#### **Container Features**
- **Multi-Stage Build**: Optimized for production deployment
- **Health Checks**: Kubernetes-ready health endpoints for ArgoCD
- **Security**: Non-root user, minimal attack surface
- **Signal Handling**: Uses dumb-init for proper container lifecycle
- **Size Optimization**: Optimized .dockerignore for minimal build context

#### **Complete Frontend + Backend Docker Support**
```bash
# Multi-stage builds with three targets:

# 1. Full-stack single container (frontend + backend)
docker build -t idp/backstage-app .
# OR using docker-compose
./deploy.sh fullstack

# 2. Backend-only container (microservices)
docker build --target backend -t idp/backstage-backend .
# OR
./deploy.sh backend-only

# 3. Frontend-only container (nginx + static files)
docker build --target frontend -t idp/backstage-frontend .
# OR 
./deploy.sh microservices

# 4. Legacy backend-only (packages/backend/Dockerfile)
yarn build-image
```

#### **Deployment Options**
```bash
# Easy deployment script with multiple options
./deploy.sh fullstack              # Single container with both services
./deploy.sh microservices -u      # Separate containers + Unleash
./deploy.sh backend-only -d       # Backend only in background
./deploy.sh build-only             # Just build the containers

# Docker Compose profiles
docker-compose --profile fullstack up      # Single container
docker-compose --profile microservices up  # Separate services
docker-compose --profile unleash up        # Include Unleash OSS
```

#### **Container Configuration**
- **Frontend Port**: 3000 (nginx serving React app)
- **Backend Port**: 7007 (Node.js API server)
- **Health Checks**: 
  - Frontend: `http://localhost:3000/health`
  - Backend: `http://localhost:7007/api/unleash-feature-flags/health/status`
- **User**: node (non-root for security)
- **Base Images**: node:20-bookworm-slim, nginx:alpine
- **Process Management**: supervisord for multi-process containers

#### **ArgoCD Deployment Ready**
The containers include health checks and proper configuration for Kubernetes deployment:
```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage-app
spec:
  template:
    spec:
      containers:
      - name: backstage
        image: idp/backstage-app:latest
        ports:
        - containerPort: 7007
        livenessProbe:
          httpGet:
            path: /api/unleash-feature-flags/health/status
            port: 7007
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /api/unleash-feature-flags/health/status
            port: 7007
          initialDelaySeconds: 5
```

### Frontend Integration
- Updated existing feature flags UI to consume new API endpoints
- Seamless transition from old to new backend
- All existing UI functionality preserved and enhanced
- Real-time feature flag management through Backstage interface

## Platform Integration Status

### ✅ **Completed Integrations**

#### **Task 1: ArgoCD Integration (COMPLETED)**
- **Status**: Production-ready ArgoCD integration with comprehensive UI components
- **Backend**: `@roadiehq/backstage-plugin-argo-cd-backend@4.4.0` integrated and enabled
- **Frontend**: `@roadiehq/backstage-plugin-argo-cd@2.10.0` with overview cards and dedicated tabs
- **Configuration**: Multi-environment support (production/staging) in `app-config.yaml`
- **Entity Integration**: ArgoCD annotations in service entities (`argocd/app-name`, `argocd/instance-name`)
- **Features**: Real-time deployment status, GitOps sync information, multi-environment support
- **Access**: Available on "ArgoCD" tab in service entity pages

#### **Task 2: Argo Workflows CI/CD Integration (COMPLETED)**
- **Status**: Comprehensive Argo Workflows integration with full workflow management capabilities
- **Backend Implementation**:
  - Custom `ArgoWorkflowsProvider` with complete Kubernetes API integration
  - REST API endpoints for workflow management (`/api/argo-workflows/*`)
  - Support for workflows, templates, and cluster templates
  - Advanced features: workflow submission, retry/stop operations, log streaming
- **Frontend Implementation**:
  - Complete React dashboard (`ArgoWorkflowsPage`) with Material-UI components
  - Multi-tab interface: Active Workflows, Templates, Cluster Templates, History
  - Interactive features: Submit workflows, manage execution, view logs
  - Real-time status indicators and progress tracking
- **Dependencies**: `@kubernetes/client-node`, `yaml`, `axios` for Kubernetes integration
- **Configuration**: Complete Argo Workflows configuration in `app-config.yaml`
- **Entity Integration**: Workflow annotations (`argoproj.io/workflow-template`, `argoproj.io/workflow-namespace`)
- **Access**: Available on "CI/CD" tab in service entity pages
- **Environment Variables**: 
  ```bash
  ARGO_WORKFLOWS_SERVER_URL=https://argo-workflows.idp-platform.local
  ARGO_WORKFLOWS_AUTH_TOKEN=<bearer-token>
  ARGO_WORKFLOWS_NAMESPACE=argo
  ```

### 🔄 **Pending Integrations**

#### **Task 3: Istio Kiali Integration (PENDING)**
- **Objective**: Service mesh topology visualization and traffic monitoring
- **Status**: Ready for implementation

#### **Task 4: Kubernetes Integration (PENDING)**  
- **Objective**: Enhanced cluster visibility and resource management
- **Status**: Ready for implementation

#### **Task 5: GitOps Discovery (PENDING)**
- **Objective**: Automatic service discovery from Git repositories  
- **Status**: Ready for implementation

#### **Task 6: Monitoring Integration (PENDING)**
- **Objective**: Grafana, Prometheus, and Jaeger integration
- **Status**: Ready for implementation

#### **Task 7: Crossplane Integration (PENDING)**
- **Objective**: Infrastructure-as-code visibility and management
- **Status**: Ready for implementation

#### **Task 8: API Documentation (PENDING)**
- **Objective**: Enhanced API documentation with validation
- **Status**: Ready for implementation

#### **Task 9: Platform Entities (PENDING)**  
- **Objective**: Service catalog for IDP platform components
- **Status**: Ready for implementation

### 🎯 **Integration Benefits Delivered**

**Developer Experience Enhancements:**
- **Unified GitOps Visibility**: ArgoCD integration provides real-time deployment status across environments
- **Self-Service CI/CD**: Argo Workflows integration enables template-based pipeline execution and management
- **Integrated Workflow Management**: Developers can submit, monitor, and troubleshoot workflows directly from Backstage
- **Multi-Environment Support**: Production and staging configurations for both ArgoCD and Argo Workflows

**Platform Capabilities:**
- **Production-Ready Components**: Both integrations include comprehensive error handling and monitoring
- **Enterprise-Grade Security**: Token-based authentication and proper RBAC integration
- **Extensible Architecture**: Well-structured plugin system ready for additional integrations
- **Comprehensive API Coverage**: Full REST API support for programmatic access

**Operational Excellence:**
- **Build Verification**: All integrations pass TypeScript compilation and full build processes
- **Configuration Management**: Environment-based configuration with sensible defaults
- **Documentation**: Comprehensive implementation documentation and usage examples

### Complete Architecture Overview

#### **Frontend (Port 3000)**
- **Technology**: React 18 + Material-UI served by nginx
- **Features**: 
  - Client-side routing with React Router
  - Real-time feature flag management UI
  - Service catalog, scaffolder, TechDocs
  - AWS Cognito + GitHub OAuth + Guest authentication
- **Container**: nginx:alpine with built static assets
- **Health Check**: `GET /health`

#### **Backend (Port 7007)**
- **Technology**: Node.js + Express with Backstage plugin system
- **Features**:
  - RESTful API for all Backstage functionality
  - Unleash Feature Flags integration (`/api/unleash-feature-flags`)
  - AWS Cognito authentication backend
  - SQLite (dev) / PostgreSQL (prod) database
- **Container**: node:20-bookworm-slim with built application
- **Health Check**: `GET /api/unleash-feature-flags/health/status`

#### **Communication Flow**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Unleash OSS   │
│   (nginx:3000)  │───▶│  (node:7007)     │───▶│   (optional)    │
│                 │    │                  │    │   (:4242)       │
│ • React App     │    │ • REST APIs      │    │ • Feature Flags │
│ • Static Assets │    │ • Authentication │    │ • Admin UI      │
│ • Proxy /api/*  │    │ • Database       │    │ • Strategies    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Next Steps for IDP Integration
1. **ArgoCD Workflows**: Deploy using Argo Workflows on IDP platform
2. **Unleash OSS Connection**: Configure connection to platform Unleash instance  
3. **Service Mesh**: Integration with Istio for secure service communication
4. **Monitoring**: Connect with platform Prometheus/Grafana stack
5. **Database**: Use platform PostgreSQL for production deployments