# IDP Backstage Application

This is the Backstage developer portal application for the Integrated Developer Platform (IDP). This repository has been separated from the main IDP platform to enable independent development and deployment.

## Overview

This Backstage application provides:
- **Service Catalog**: Central registry of all services and components
- **Software Templates**: Self-service application scaffolding
- **Kubernetes Integration**: Live cluster and workload information
- **CI/CD Integration**: Argo Workflows and ArgoCD integration
- **AWS Cognito Authentication**: Centralized authentication for the platform

## Architecture

- **Framework**: Backstage.io (Node.js/TypeScript)
- **Database**: PostgreSQL (managed by IDP platform)
- **Authentication**: AWS Cognito OAuth/OIDC
- **Container Registry**: LocalStack ECR for development, AWS ECR for production
- **Deployment**: Kubernetes via ArgoCD GitOps

## Quick Start

### Prerequisites

- Node.js 20 or 22
- Yarn package manager
- Docker (for container builds)
- Access to IDP platform Kubernetes cluster

### Local Development

```bash
# Install dependencies
yarn install

# Start development server
yarn start

# The app will be available at http://localhost:3000
```

### Building

```bash
# Build all packages
yarn build:all

# Build backend only
yarn build:backend

# Build container image
docker build -t idp/backstage-app:latest .
```

### Testing

```bash
# Run unit tests
yarn test

# Run all tests with coverage
yarn test:all

# Run end-to-end tests
yarn test:e2e

# Type checking
yarn tsc

# Linting
yarn lint:all

# Code formatting
yarn prettier:check
```

## Integration with IDP Platform

This Backstage application integrates with the IDP platform through:

1. **Automated Build & Deploy**: IDP platform's `setup-backstage-external.sh` script handles the complete workflow
2. **Container Registry**: Built images pushed to platform's container registry
3. **GitOps Deployment**: ArgoCD automatically deploys the application
4. **Platform Services**: Integrated with Kubernetes, ArgoCD, and other platform services

### Integration Workflow

1. IDP platform clones this repository
2. Builds the Backstage application (`yarn build:all`)
3. Creates container image and pushes to registry
4. Updates platform deployment manifests
5. ArgoCD syncs and deploys the updated application
