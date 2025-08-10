# NestJS Build & Deploy Workflow Template

**Part of Task 14: Workflow Templates**  
**Application Type**: Backend APIs and Microservices

## Overview

This template provides a complete CI/CD pipeline for NestJS applications, following the same pattern as Next.js but optimized for backend services. It works with any Node.js + Express.js application with minimal modifications.

## Template Compatibility

### ✅ Works With

- **NestJS** applications (primary target)
- **Express.js** applications
- **Fastify** applications
- **Koa.js** applications
- Any **Node.js backend** with build step

### 🔧 Minimal Changes Needed

- Build command (`nest build` → `npm run build`)
- Health check endpoint (`/health` → `/api/health`)
- Output directory (`dist/` → `build/`)
- Port configuration (configurable)

## Template Structure

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: nestjs-build-deploy-workflow
  title: NestJS Build & Deploy Workflow
  description: Argo Workflow template for building NestJS/Node.js backend apps and deploying to AWS ECR + Kubernetes
  tags:
    - argo-workflows
    - nestjs
    - nodejs
    - express
    - backend
    - api
    - docker
    - kubernetes
    - aws-ecr
    - cicd
spec:
  owner: platform-team
  type: workflow
  parameters:
    - title: Application Details
      required:
        - name
        - owner
        - description
        - sourceRepo
      properties:
        name:
          title: Application Name
          type: string
          description: Name of the NestJS/Node.js application
          pattern: '^([a-z0-9\-])+$'
          ui:autofocus: true
        description:
          title: Description
          type: string
          description: Brief description of the API/service
        owner:
          title: Owner
          type: string
          description: Owner of the application
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: Group
        sourceRepo:
          title: Source Repository
          type: string
          description: Git repository URL for the Node.js application
          ui:placeholder: 'https://github.com/org/nestjs-api.git'

    - title: Build Configuration
      properties:
        nodeVersion:
          title: Node.js Version
          type: string
          default: '18'
          enum:
            - '16'
            - '18'
            - '20'
          description: Node.js version for building the application
        buildCommand:
          title: Build Command
          type: string
          default: 'npm run build'
          enum:
            - 'npm run build'
            - 'nest build'
            - 'yarn build'
            - 'pnpm build'
          description: Command to build the application
        outputDir:
          title: Build Output Directory
          type: string
          default: 'dist'
          enum:
            - 'dist'
            - 'build'
            - 'lib'
          description: Directory containing build artifacts
        packageManager:
          title: Package Manager
          type: string
          default: 'npm'
          enum:
            - 'npm'
            - 'yarn'
            - 'pnpm'
          description: Package manager to use for dependencies
        serverPort:
          title: Server Port
          type: number
          default: 3000
          description: Port on which the server will run

    - title: Health Check Configuration
      properties:
        healthCheckPath:
          title: Health Check Path
          type: string
          default: '/health'
          enum:
            - '/health'
            - '/api/health'
            - '/healthz'
            - '/status'
          description: Path for Kubernetes health checks
        enableSwagger:
          title: Enable Swagger Documentation
          type: boolean
          default: true
          description: Include Swagger API documentation endpoint
        swaggerPath:
          title: Swagger Documentation Path
          type: string
          default: '/api'
          description: Path for Swagger API documentation

    - title: AWS ECR Configuration
      required:
        - ecrRepository
        - awsRegion
      properties:
        ecrRepository:
          title: ECR Repository Name
          type: string
          description: AWS ECR repository name for Docker images
          ui:placeholder: 'my-org/nestjs-api'
        awsRegion:
          title: AWS Region
          type: string
          default: 'us-east-1'
          enum:
            - 'us-east-1'
            - 'us-west-2'
            - 'eu-west-1'
            - 'ap-southeast-1'
          description: AWS region for ECR repository
        ecrRegistryId:
          title: ECR Registry ID (AWS Account ID)
          type: string
          description: AWS Account ID for ECR registry
          ui:placeholder: '123456789012'

    - title: Deployment Configuration
      properties:
        namespace:
          title: Kubernetes Namespace
          type: string
          default: 'default'
          description: Kubernetes namespace for deployment
        replicas:
          title: Replica Count
          type: number
          default: 2
          description: Number of replicas for Kubernetes deployment
        enableIngress:
          title: Enable Ingress
          type: boolean
          default: true
          description: Create Kubernetes ingress for external access
        ingressPath:
          title: Ingress Path
          type: string
          default: '/api'
          description: Base path for API ingress
        resourcesRequestsCpu:
          title: CPU Requests
          type: string
          default: '100m'
          description: CPU resource requests
        resourcesRequestsMemory:
          title: Memory Requests
          type: string
          default: '256Mi'
          description: Memory resource requests
        resourcesLimitsCpu:
          title: CPU Limits
          type: string
          default: '500m'
          description: CPU resource limits
        resourcesLimitsMemory:
          title: Memory Limits
          type: string
          default: '512Mi'
          description: Memory resource limits
```

## Key Differences from Next.js Template

### Build Process

```yaml
# NestJS Build (vs Next.js)
- name: build-nestjs
  container:
    image: node:{{inputs.parameters.node-version}}-alpine
    command: [sh, -c]
    args:
      - |
        cd /workspace/source
        echo "Installing dependencies..."
        npm ci --only=production=false

        echo "Building NestJS application..."
        {{inputs.parameters.build-command}}  # nest build or npm run build

        echo "Build completed successfully"
        ls -la {{inputs.parameters.output-dir}}/  # dist/ instead of .next/

        # Copy built application and dependencies
        mkdir -p /workspace/built-app
        cp -r {{inputs.parameters.output-dir}} /workspace/built-app/
        cp -r node_modules /workspace/built-app/
        cp package*.json /workspace/built-app/
        cp nest-cli.json /workspace/built-app/ || true
```

### Dockerfile Template

```dockerfile
ARG NODE_VERSION={{nodeVersion}}
FROM node:${NODE_VERSION}-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
{{#if (eq packageManager "yarn")}}
COPY yarn.lock ./
RUN yarn --frozen-lockfile --production
{{else if (eq packageManager "pnpm")}}
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --production
{{else}}
RUN npm ci --only=production
{{/if}}

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs {{outputDir}} ./{outputDir}}
COPY --chown=nestjs:nodejs package*.json ./

USER nestjs

EXPOSE {{serverPort}}

ENV PORT={{serverPort}}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:{{serverPort}}{{healthCheckPath}}', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "{{outputDir}}/main.js"]
```

### Health Check Configuration

```yaml
# Kubernetes Deployment Health Checks
livenessProbe:
  httpGet:
    path: { { healthCheckPath } } # /health for NestJS, /api/health for custom
    port: { { serverPort } }
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: { { healthCheckPath } }
    port: { { serverPort } }
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Universal Node.js Application Support

### Express.js Application

```yaml
# Override parameters for Express.js
buildCommand: 'npm run build'
outputDir: 'build'
healthCheckPath: '/api/health'
startCommand: 'node build/index.js'
```

### Fastify Application

```yaml
# Override parameters for Fastify
buildCommand: 'npm run build'
outputDir: 'dist'
healthCheckPath: '/health'
startCommand: 'node dist/server.js'
```

### Custom Node.js API

```yaml
# Override parameters for custom Node.js
buildCommand: 'npm run compile'
outputDir: 'lib'
healthCheckPath: '/status'
startCommand: 'node lib/app.js'
```

## Advanced Features

### Environment-Specific Configuration

```yaml
# ConfigMap for application configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{appName}}-config
data:
  NODE_ENV: "production"
  PORT: "{{serverPort}}"
  {{#if enableSwagger}}
  SWAGGER_ENABLED: "true"
  SWAGGER_PATH: "{{swaggerPath}}"
  {{/if}}
  HEALTH_CHECK_PATH: "{{healthCheckPath}}"
```

### Database Integration

```yaml
# Database connection configuration
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{appName}}-secrets
      key: database-url
- name: REDIS_URL
  valueFrom:
    secretKeyRef:
      name: {{appName}}-secrets
      key: redis-url
```

### Service Discovery

```yaml
# Service definition for API discovery
apiVersion: v1
kind: Service
metadata:
  name: {{appName}}-service
  labels:
    app: {{appName}}
    tier: backend
  annotations:
    {{#if enableSwagger}}
    swagger.io/path: "{{swaggerPath}}"
    {{/if}}
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: {{serverPort}}
    protocol: TCP
    name: http
  selector:
    app: {{appName}}
```

## Monitoring Integration

### Prometheus Metrics

```yaml
# Service monitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{appName}}-metrics
spec:
  selector:
    matchLabels:
      app: {{appName}}
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### Logging Configuration

```yaml
# Fluent Bit sidecar for log collection
- name: fluent-bit
  image: fluent/fluent-bit:latest
  volumeMounts:
    - name: logs
      mountPath: /var/log
  env:
    - name: FLUENT_ELASTICSEARCH_HOST
      value: 'elasticsearch.logging.svc.cluster.local'
```

## Expected Outcomes

### ✅ **Universal Compatibility**

- Works with NestJS, Express.js, Fastify, and custom Node.js applications
- Minimal configuration changes required between frameworks
- Standardized deployment patterns across all Node.js backends

### ✅ **Production Ready**

- Multi-stage Docker builds optimized for production
- Security best practices with non-root containers
- Health checks and monitoring integration
- Resource management and scaling support

### ✅ **Developer Experience**

- Self-service template with comprehensive configuration options
- Auto-generated Swagger documentation integration
- Standardized health check patterns
- Flexible build and deployment customization

### ✅ **Platform Integration**

- AWS ECR container registry integration
- Kubernetes-native deployment patterns
- ArgoCD GitOps synchronization
- Service mesh and ingress support

## Next Steps

1. **Template Creation**: Implement the complete workflow template
2. **Framework Testing**: Validate with NestJS, Express.js, and Fastify applications
3. **Documentation**: Create framework-specific setup guides
4. **Team Onboarding**: Train developers on template usage patterns

---

**Compatibility**: NestJS, Express.js, Fastify, Custom Node.js  
**Dependencies**: AWS ECR, Kubernetes, ArgoCD  
**Effort**: 2-3 days (leveraging Next.js template patterns)  
**Owner**: Platform Team
