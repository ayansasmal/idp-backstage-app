# Environment Variables Configuration

This document contains all environment variables required for the IDP platform integration with Backstage.

## Core Platform Integration

### ArgoCD Integration

```bash
# ArgoCD Server Configuration
ARGOCD_SERVER_URL=https://argocd.idp-platform.local
ARGOCD_USERNAME=<argocd-username>
ARGOCD_PASSWORD=<argocd-password>
# Alternative: Token-based authentication
ARGOCD_AUTH_TOKEN=<argocd-auth-token>
```

### Kubernetes Clusters

```bash
# Primary Cluster Configuration
KUBERNETES_SERVICE_ACCOUNT_TOKEN=<k8s-service-account-token>
KUBERNETES_CLUSTER_URL=https://kubernetes.idp-platform.local
KUBERNETES_CLUSTER_NAME=idp-cluster

# Alternative: kubeconfig file path
KUBECONFIG=/path/to/kubeconfig
```

### Argo Workflows

```bash
# Argo Workflows Server
ARGO_WORKFLOWS_SERVER_URL=https://argo-workflows.idp-platform.local
ARGO_WORKFLOWS_AUTH_TOKEN=<argo-workflows-token>
ARGO_WORKFLOWS_NAMESPACE=argo
```

## Monitoring & Observability

### Grafana Integration

```bash
GRAFANA_URL=https://grafana.idp-platform.local
GRAFANA_API_KEY=<grafana-api-key>
# Alternative: Basic auth
GRAFANA_USERNAME=<grafana-username>
GRAFANA_PASSWORD=<grafana-password>
```

### Prometheus Integration

```bash
PROMETHEUS_URL=https://prometheus.idp-platform.local
PROMETHEUS_API_KEY=<prometheus-api-key>
```

### Jaeger Tracing

```bash
JAEGER_URL=https://jaeger.idp-platform.local
JAEGER_USERNAME=<jaeger-username>
JAEGER_PASSWORD=<jaeger-password>
```

## Service Mesh Integration

### Kiali (Service Mesh)

```bash
KIALI_URL=https://kiali.idp-platform.local
KIALI_SERVICE_ACCOUNT_TOKEN=<kiali-service-account-token>
# Alternative: Basic auth
KIALI_USERNAME=<kiali-username>
KIALI_PASSWORD=<kiali-password>
```

## Infrastructure Management

### Crossplane Integration

```bash
CROSSPLANE_KUBERNETES_URL=https://kubernetes.idp-platform.local
CROSSPLANE_SERVICE_ACCOUNT_TOKEN=<crossplane-service-account-token>
CROSSPLANE_NAMESPACE=crossplane-system
```

## Authentication & Authorization

### AWS Cognito OIDC

```bash
# Cognito Configuration
AWS_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=<cognito-user-pool-id>
AWS_COGNITO_CLIENT_ID=<cognito-client-id>
AWS_COGNITO_CLIENT_SECRET=<cognito-client-secret>
AWS_COGNITO_METADATA_URL=https://cognito-idp.us-east-1.amazonaws.com/<user-pool-id>/.well-known/openid_configuration

# AWS SDK Credentials (for user/group management)
AWS_ACCESS_KEY_ID=<aws-access-key>
AWS_SECRET_ACCESS_KEY=<aws-secret-key>

# RBAC Configuration
COGNITO_RBAC_ENABLED=true
COGNITO_ADMIN_GROUP=platform-admins
COGNITO_USER_GROUP=developers
```

## Container Registry

### AWS ECR Configuration

```bash
# ECR Repository Settings
AWS_ECR_REGION=us-east-1
AWS_ECR_REGISTRY_ID=<aws-account-id>
AWS_ECR_DEFAULT_REPOSITORY_PREFIX=idp-platform

# ECR Authentication (for Argo Workflows)
AWS_ECR_ACCESS_KEY_ID=<ecr-access-key>
AWS_ECR_SECRET_ACCESS_KEY=<ecr-secret-key>
```

## Database Configuration

### Production PostgreSQL

```bash
# Database Connection
POSTGRES_HOST=postgres.idp-platform.local
POSTGRES_PORT=5432
POSTGRES_USER=backstage
POSTGRES_PASSWORD=<postgres-password>
POSTGRES_DB=backstage

# SSL Configuration
POSTGRES_SSL_MODE=require
POSTGRES_SSL_CERT_PATH=/path/to/client-cert.pem
POSTGRES_SSL_KEY_PATH=/path/to/client-key.pem
POSTGRES_SSL_CA_PATH=/path/to/ca-cert.pem
```

## Feature Flags

### Enhanced Unleash Integration

```bash
# Unleash Server Configuration
UNLEASH_URL=https://unleash.idp-platform.local
UNLEASH_API_TOKEN=<unleash-admin-token>
UNLEASH_CLIENT_KEY=<unleash-client-key>
UNLEASH_ENVIRONMENT=production

# RBAC Configuration
UNLEASH_RBAC_ENABLED=true
UNLEASH_ADMIN_USERS=admin@company.com,platform-team@company.com
UNLEASH_PROJECT_OWNERS=project-leads@company.com
UNLEASH_DEVELOPERS=dev-team@company.com
```

## Source Control Integration

### GitHub Integration (Enhanced)

```bash
# GitHub Configuration
GITHUB_TOKEN=<github-personal-access-token>
GITHUB_ORG=<github-organization>
GITHUB_BASE_URL=https://github.com
GITHUB_API_BASE_URL=https://api.github.com

# Repository Discovery
GITHUB_DISCOVERY_SCHEDULE=0 */6 * * *  # Every 6 hours
```

### GitLab Integration (Optional)

```bash
GITLAB_TOKEN=<gitlab-access-token>
GITLAB_BASE_URL=https://gitlab.company.com
GITLAB_API_BASE_URL=https://gitlab.company.com/api/v4
```

## Application Configuration

### Backstage Core

```bash
# Base Configuration
APP_BASE_URL=https://backstage.idp-platform.local
BACKEND_BASE_URL=https://backstage.idp-platform.local
APP_LISTEN_PORT=7007
BACKEND_LISTEN_PORT=7007

# Session Configuration
APP_SESSION_SECRET=<secure-session-secret>

# CORS Configuration
CORS_ORIGIN=https://backstage.idp-platform.local
```

### Logging & Monitoring

```bash
# Log Level Configuration
LOG_LEVEL=info
BACKEND_LOG_LEVEL=info

# Metrics and Telemetry
TELEMETRY_ENABLED=true
METRICS_PORT=9090
```

## Template Configuration

### Software Templates

```bash
# Template Repository
TEMPLATE_REPOSITORY_URL=https://github.com/your-org/backstage-templates
TEMPLATE_REPOSITORY_BRANCH=main

# Default Values
DEFAULT_NODE_VERSION=18
DEFAULT_PACKAGE_MANAGER=npm
DEFAULT_BUILD_COMMAND=npm run build
```

### Workflow Templates

```bash
# Argo Workflows Template Defaults
DEFAULT_WORKFLOW_NAMESPACE=argo
DEFAULT_BUILD_TIMEOUT=30m
DEFAULT_DEPLOY_TIMEOUT=15m

# Container Registry Defaults
DEFAULT_DOCKER_REGISTRY=docker.io
DEFAULT_IMAGE_TAG_STRATEGY=commit-sha
```

## Security Configuration

### TLS/SSL Certificates

```bash
# TLS Configuration
TLS_CERT_PATH=/etc/ssl/certs/backstage.crt
TLS_KEY_PATH=/etc/ssl/private/backstage.key
TLS_CA_PATH=/etc/ssl/certs/ca.crt

# Certificate Validation
TLS_VERIFY_CERTIFICATES=true
TLS_MIN_VERSION=1.2
```

### Security Headers

```bash
# Security Configuration
SECURITY_FRAME_OPTIONS=DENY
SECURITY_CONTENT_TYPE_OPTIONS=nosniff
SECURITY_XSS_PROTECTION=1; mode=block
SECURITY_HSTS_MAX_AGE=31536000
```

## Development vs Production

### Development Environment

```bash
# Development Overrides
NODE_ENV=development
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000,http://localhost:7007

# Development Database (SQLite)
# Note: PostgreSQL recommended for production
DATABASE_TYPE=sqlite3
DATABASE_CONNECTION=:memory:
```

### Production Environment

```bash
# Production Configuration
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://backstage.idp-platform.local

# Production Database
DATABASE_TYPE=postgres
DATABASE_CONNECTION_STRING=postgresql://backstage:<password>@postgres.idp-platform.local:5432/backstage
```

## Environment-Specific Overrides

### Staging Environment

```bash
# Staging-specific URLs
ARGOCD_SERVER_URL=https://argocd-staging.idp-platform.local
GRAFANA_URL=https://grafana-staging.idp-platform.local
UNLEASH_URL=https://unleash-staging.idp-platform.local
UNLEASH_ENVIRONMENT=staging
```

### Development Environment

```bash
# Development-specific URLs
ARGOCD_SERVER_URL=https://argocd-dev.idp-platform.local
GRAFANA_URL=https://grafana-dev.idp-platform.local
UNLEASH_URL=https://unleash-dev.idp-platform.local
UNLEASH_ENVIRONMENT=development
```

## Configuration Management

### Kubernetes Secrets

```yaml
# Example: backstage-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: backstage-secrets
  namespace: backstage
type: Opaque
stringData:
  POSTGRES_PASSWORD: <postgres-password>
  GITHUB_TOKEN: <github-token>
  AWS_SECRET_ACCESS_KEY: <aws-secret>
  ARGOCD_AUTH_TOKEN: <argocd-token>
```

### ConfigMap Example

```yaml
# Example: backstage-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backstage-config
  namespace: backstage
data:
  APP_BASE_URL: 'https://backstage.idp-platform.local'
  ARGOCD_SERVER_URL: 'https://argocd.idp-platform.local'
  GRAFANA_URL: 'https://grafana.idp-platform.local'
  LOG_LEVEL: 'info'
```

## Validation Checklist

- [ ] All required environment variables are set
- [ ] Database connection is established
- [ ] Authentication providers are configured
- [ ] Platform integrations are accessible
- [ ] Container registry access is working
- [ ] Monitoring endpoints are reachable
- [ ] Feature flag service is connected
- [ ] Template repositories are accessible

## Security Notes

1. **Secrets Management**: Use Kubernetes secrets or external secret management
2. **Least Privilege**: Grant minimal required permissions to service accounts
3. **Rotation**: Regularly rotate API keys and tokens
4. **Encryption**: Use TLS for all external communications
5. **Audit**: Monitor access to sensitive environment variables

---

**Last Updated**: August 7, 2025  
**Owner**: Platform Team  
**Review Frequency**: Monthly
