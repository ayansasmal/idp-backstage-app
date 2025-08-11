# Kubernetes Deployment Guide

This guide covers deploying the IDP Backstage App to Kubernetes, specifically designed for the IDP platform.

## Prerequisites

1. **IDP Platform Running**: The IDP platform should be operational with:
   - Kubernetes cluster (Docker Desktop/Kind/Minikube or cloud)
   - ArgoCD for GitOps
   - Istio service mesh
   - Argo Workflows for CI/CD
   - External Secrets Operator
   - LocalStack or AWS services

2. **Tools Required**:
   - `kubectl` configured and connected to the cluster
   - `argo` CLI (for building images)
   - Docker images built and pushed to the registry

## Quick Start

### Option 1: Using WebApplication CRD (Recommended)

The IDP platform provides a custom WebApplication CRD that handles everything automatically:

```bash
# 1. Configure secrets
kubectl apply -f k8s/secret-template.yaml  # Edit with your values first

# 2. Deploy using WebApplication CRD
./k8s-deploy.sh webapplication

# 3. Check status
./k8s-deploy.sh status
```

### Option 2: Standard Kubernetes Manifests

```bash
# 1. Configure secrets
kubectl apply -f k8s/secret-template.yaml  # Edit with your values first

# 2. Deploy with standard manifests
./k8s-deploy.sh deploy

# 3. Check status
./k8s-deploy.sh status
```

## Building Images with Argo Workflows

The IDP platform uses Argo Workflows for building container images:

```bash
# Build images using Argo Workflows
./k8s-deploy.sh build -i v1.2.3

# Monitor the build
argo list -n argo
argo get -n argo <workflow-name>
argo logs -n argo <workflow-name>
```

## Configuration

### Secrets Management

1. **Copy the secret template**:
   ```bash
   cp k8s/secret-template.yaml k8s/secret.yaml
   ```

2. **Edit with your values**:
   ```bash
   nano k8s/secret.yaml
   ```

3. **Apply the secret**:
   ```bash
   kubectl apply -f k8s/secret.yaml
   ```

**Required secrets for OAuth2**:
- `BACKEND_SECRET`
- `GITHUB_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

### ConfigMaps

Non-sensitive configuration is managed via ConfigMaps:

- `backstage-config`: Contains the main app-config.yaml
- `backstage-env-config`: Contains environment variables

## Architecture

### Microservices Deployment

The Kubernetes deployment uses a microservices architecture:

- **Backend**: Node.js service (port 7007)
- **Frontend**: Nginx serving static files (port 3000)
- **Database**: External AWS RDS PostgreSQL
- **Service Mesh**: Istio for routing and security

### Networking

- **Istio VirtualService**: Routes traffic based on path
  - `/api/*` → Backend service
  - `/*` → Frontend service
- **mTLS**: Automatic service-to-service encryption
- **External Access**: Through IDP platform gateway

### Storage

- **App Config**: Mounted as ConfigMap volume
- **Secrets**: Mounted as environment variables
- **Logs**: Stdout/stderr captured by Kubernetes

## Monitoring & Observability

The deployment includes:

- **Health Checks**: Kubernetes readiness/liveness probes
- **Metrics**: Prometheus metrics collection
- **Logging**: Structured JSON logs
- **Tracing**: Istio distributed tracing
- **Service Mesh**: Kiali for service topology

## Scaling

### Horizontal Pod Autoscaler

```yaml
scaling:
  replicas: 2
  horizontalPodAutoscaler:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
```

### Resource Requests/Limits

- **Backend**: 250m CPU, 512Mi memory (requests)
- **Frontend**: 100m CPU, 128Mi memory (requests)

## Security

### RBAC

The deployment includes:
- **ServiceAccount**: `backstage-backend`
- **ClusterRole**: Read-only access to Kubernetes resources
- **ClusterRoleBinding**: Binds the service account to the role

### Security Context

- **Non-root**: Runs as user 1001 (backend) / 101 (frontend)
- **Read-only filesystem**: Where possible
- **Security policies**: Enforced by IDP platform

## Troubleshooting

### Check Deployment Status

```bash
./k8s-deploy.sh status
```

### View Logs

```bash
# Backend logs
kubectl logs -n backstage deployment/backstage-backend -f

# Frontend logs  
kubectl logs -n backstage deployment/backstage-frontend -f

# All pods
kubectl logs -n backstage -l app.kubernetes.io/name=backstage -f
```

### Debug Pods

```bash
# Describe pods
kubectl describe pods -n backstage

# Shell into backend pod
kubectl exec -it -n backstage deployment/backstage-backend -- /bin/bash

# Check environment variables
kubectl exec -n backstage deployment/backstage-backend -- env | sort
```

### Common Issues

1. **Image Pull Errors**: Check registry credentials
2. **Database Connection**: Verify RDS credentials in secrets
3. **OAuth2 Issues**: Check GitHub OAuth app configuration
4. **Health Check Failures**: Verify endpoints are responding

## Cleanup

```bash
./k8s-deploy.sh cleanup
```

## Integration with IDP Platform

This deployment is designed to integrate with the broader IDP platform:

1. **GitOps**: ArgoCD monitors this repository for changes
2. **CI/CD**: Argo Workflows builds and deploys automatically
3. **Service Mesh**: Istio provides networking and security
4. **Monitoring**: Integrated with platform monitoring stack
5. **Secrets**: Managed by External Secrets Operator

The WebApplication CRD provides a higher-level abstraction that leverages all these platform capabilities automatically.