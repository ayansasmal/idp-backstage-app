# Workflow Templates for CI/CD Automation

**Task 14: Argo Workflows Templates**  
**Objective:** Provide standardized CI/CD templates for different application types with AWS ECR and Kubernetes deployment

## Overview

This task creates comprehensive Argo Workflows templates for modern application stacks, providing automated build and deployment pipelines that integrate with AWS ECR and Kubernetes.

## Template Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Argo Workflow                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Git Clone       │  Clone source repository                │
│  2. Build App       │  npm/yarn/pnpm install & build         │
│  3. Docker Build    │  Multi-stage Dockerfile with Kaniko    │
│  4. Push to ECR     │  Secure AWS ECR registry upload        │
│  5. K8s Deploy      │  kubectl apply with health checks      │
├─────────────────────────────────────────────────────────────────┤
│                        Output                                   │
├─────────────────────────────────────────────────────────────────┤
│  • Docker Image: ECR_REGISTRY/repo:tag                        │
│  • Kubernetes Deployment: Namespace with replicas             │
│  • Service: ClusterIP with port forwarding                    │
│  • Ingress: Istio-compatible external access                  │
│  • ArgoCD App: GitOps sync and monitoring                     │
└─────────────────────────────────────────────────────────────────┘
```

## Templates

### 1. React + Vite Template

- **Use Case**: Static web applications with CDN deployment
- **Deployment**: Static files → nginx container + future CloudFront/S3 support
- **Health Check**: Basic nginx health endpoint
- **Optimization**: Multi-stage build with static file serving

### 2. Next.js Template

- **Use Case**: Server-side rendered applications
- **Deployment**: Full Next.js server with dynamic routing
- **Health Check**: API endpoint (`/api/health`)
- **Optimization**: Standalone build with production optimizations

### 3. NestJS Template

- **Use Case**: Backend APIs and microservices
- **Deployment**: Node.js server with Swagger documentation
- **Health Check**: Built-in health check module (`/health`)
- **Optimization**: Production build with dependency optimization

## Common Features

### 🏗️ **AWS ECR Integration**

- Secure Docker registry with IAM authentication
- Multi-region support (us-east-1, us-west-2, eu-west-1, ap-southeast-1)
- Automatic repository targeting with account ID
- Image versioning (latest + unique workflow tags)

### 🐳 **Advanced Docker Builds**

- Multi-stage Dockerfiles for optimized production images
- Kaniko for secure, rootless container builds in Kubernetes
- Security best practices (non-root users, minimal attack surface)
- Health checks and proper signal handling

### ☸️ **Kubernetes Production Ready**

- Configurable resource requests and limits
- Liveness and readiness probes with custom health check paths
- Security contexts with non-root containers
- Horizontal scaling with configurable replica counts
- Service discovery with ClusterIP services
- Istio-compatible ingress configuration

### 🔄 **ArgoCD GitOps**

- Automated sync with self-healing capabilities
- Revision history and rollback support
- Namespace management with automatic creation
- Configurable sync policies and retry strategies

### 📊 **Monitoring & Observability**

- Built-in health endpoints for all application types
- Resource usage monitoring and alerting hooks
- Deployment status tracking with rollout monitoring
- Centralized logging integration ready

## Implementation Tasks

- [ ] **Create Template Directory Structure**

  ```
  examples/templates/argo-workflows/
  ├── react-build-deploy-template/
  ├── nextjs-build-deploy-template/
  └── nestjs-build-deploy-template/
  ```

- [ ] **React + Vite Workflow Template**

  - Static site build and nginx deployment
  - CloudFront + S3 future support
  - Optimized for CDN distribution

- [ ] **Next.js Workflow Template**

  - Server-side rendering deployment
  - AWS ECR integration
  - Production-optimized Node.js server

- [ ] **NestJS Workflow Template**

  - Backend API deployment
  - Health check integration
  - Swagger documentation support

- [ ] **Common Template Features**

  - Package manager detection (npm, yarn, pnpm)
  - Configurable Node.js versions
  - Security best practices
  - Resource optimization

- [ ] **Register Templates in Backstage**
  - Update `app-config.yaml` catalog locations
  - Enable scaffolder plugin routes
  - Add create button to sidebar navigation

## Template Specifications

### Next.js Template Configuration

```yaml
parameters:
  - title: AWS ECR Configuration
    required:
      - ecrRepository
      - awsRegion
      - ecrRegistryId
    properties:
      ecrRepository:
        title: ECR Repository Name
        type: string
        description: AWS ECR repository name for Docker images
        ui:placeholder: 'my-org/nextjs-app'
      awsRegion:
        title: AWS Region
        type: string
        default: 'us-east-1'
        enum: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
      ecrRegistryId:
        title: ECR Registry ID (AWS Account ID)
        type: string
        description: AWS Account ID for ECR registry
        ui:placeholder: '123456789012'
```

### NestJS Template Configuration

```yaml
parameters:
  - title: Application Configuration
    properties:
      serverPort:
        title: Server Port
        type: number
        default: 3000
        description: Port on which NestJS server will run
      healthCheckPath:
        title: Health Check Path
        type: string
        default: '/health'
        description: Path for Kubernetes health checks
      enableSwagger:
        title: Enable Swagger Documentation
        type: boolean
        default: true
        description: Include Swagger API documentation
```

## Workflow Template Features

### Multi-Stage Docker Build Process

1. **Dependencies Stage**: Install and cache dependencies
2. **Build Stage**: Compile TypeScript and build application
3. **Production Stage**: Create minimal runtime image
4. **Security**: Non-root user, minimal attack surface
5. **Health Checks**: Container-level health monitoring

### Kubernetes Deployment Strategy

1. **Rolling Updates**: Zero-downtime deployments
2. **Health Monitoring**: Readiness and liveness probes
3. **Resource Management**: CPU/memory requests and limits
4. **Security Context**: Pod security standards compliance
5. **Service Discovery**: Internal and external access configuration

### ECR Integration Pattern

1. **Authentication**: IAM roles and Kubernetes secrets
2. **Image Management**: Automated tagging and versioning
3. **Registry Security**: Private repository access
4. **Multi-Region**: Flexible region configuration
5. **Cache Optimization**: Layer caching for faster builds

## Expected Outcomes

### Developer Experience

- **Self-Service**: Template-driven workflow creation
- **Standardization**: Consistent deployment patterns
- **Flexibility**: Configurable build and deployment options
- **Documentation**: Auto-generated setup guides

### Platform Integration

- **ArgoCD**: GitOps-based deployment management
- **Kubernetes**: Production-ready container orchestration
- **AWS ECR**: Secure container registry
- **Monitoring**: Built-in observability hooks

### Operational Benefits

- **Security**: Best practices built into templates
- **Scalability**: Horizontal scaling support
- **Reliability**: Health checks and automatic recovery
- **Maintainability**: Standardized deployment patterns

## Environment Variables Required

```bash
# AWS ECR Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<aws-access-key>
AWS_SECRET_ACCESS_KEY=<aws-secret-key>

# Kubernetes Cluster
KUBECONFIG=/path/to/kubeconfig
KUBERNETES_CLUSTER_URL=https://kubernetes.cluster.local

# ArgoCD Integration
ARGOCD_SERVER_URL=https://argocd.platform.local
ARGOCD_AUTH_TOKEN=<argocd-token>

# Template Configuration
DEFAULT_ECR_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com
DEFAULT_KUBERNETES_NAMESPACE=default
```

## Success Criteria

1. ✅ **Template Functionality**: All templates generate working workflows
2. ✅ **Build Success**: Applications build successfully in all templates
3. ✅ **Deployment Success**: Kubernetes deployments complete without errors
4. ✅ **Health Checks**: All health monitoring works correctly
5. ✅ **ECR Integration**: Images push to AWS ECR successfully
6. ✅ **ArgoCD Sync**: GitOps workflows sync and deploy correctly
7. ✅ **Developer Adoption**: Templates are easy to use and understand

## Next Steps

1. **Create Template Skeletons**: Set up directory structure and base files
2. **Implement Workflow Logic**: Create Argo Workflow definitions
3. **Test Templates**: Validate with sample applications
4. **Documentation**: Create usage guides and troubleshooting docs
5. **Team Training**: Onboard developers on template usage

---

**Priority**: High  
**Dependencies**: ArgoCD, Kubernetes, AWS ECR access  
**Estimated Effort**: 1 week  
**Owner**: Platform Team
