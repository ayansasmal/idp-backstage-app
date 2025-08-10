# Software Templates and Scaffolding

**Task 13: Software Templates for React, Next.js, and NestJS Applications**  
**Priority:** High  
**Objective:** Create comprehensive software templates for modern application development with integrated CI/CD, monitoring, and platform services

## Overview

This task implements comprehensive software templates that enable developers to scaffold new React 18 + Tailwind CSS applications, Next.js applications, and NestJS backend services with fully integrated CI/CD pipelines, monitoring, security scanning, and platform service configurations.

## Tasks

### 1. Install Template Dependencies

```bash
# Install template-related packages
yarn workspace backend add @backstage/plugin-scaffolder-backend
yarn workspace backend add @backstage/plugin-scaffolder-node
yarn workspace app add @backstage/plugin-scaffolder
yarn workspace app add @backstage/plugin-scaffolder-react

# Install additional template utilities
yarn workspace backend add @backstage/integration
yarn workspace backend add fs-extra
yarn workspace backend add @types/fs-extra
```

### 2. Create React + Tailwind CSS Template

Create `templates/react-app/template.yaml`:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: react-tailwind-app
  title: React 18 + Tailwind CSS Application
  description: Create a new React 18 application with Tailwind CSS, TypeScript, and modern development tools
  tags:
    - react
    - typescript
    - tailwind
    - frontend
spec:
  owner: platform-team
  type: service
  parameters:
    - title: Application Information
      required:
        - name
        - description
        - owner
      properties:
        name:
          title: Name
          type: string
          description: Unique name for the application
          pattern: '^[a-zA-Z0-9-]+$'
          ui:autofocus: true
          ui:help: 'Use lowercase letters, numbers, and hyphens only'
        description:
          title: Description
          type: string
          description: Help others understand what this application is for
        owner:
          title: Owner
          type: string
          description: Owner of the component
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: [Group, User]

    - title: Repository Information
      required:
        - repoUrl
      properties:
        repoUrl:
          title: Repository Location
          type: string
          ui:field: RepoUrlPicker
          ui:options:
            allowedHosts:
              - github.com
              - gitlab.com

    - title: Application Configuration
      properties:
        port:
          title: Development Port
          type: number
          default: 3000
          description: Port for local development server
        enablePWA:
          title: Enable PWA Features
          type: boolean
          default: false
          description: Add Progressive Web App capabilities
        enableTesting:
          title: Enable Testing Setup
          type: boolean
          default: true
          description: Include Jest, React Testing Library, and Cypress
        enableStorybook:
          title: Enable Storybook
          type: boolean
          default: false
          description: Add Storybook for component development

    - title: Platform Integration
      properties:
        enableMonitoring:
          title: Enable Monitoring
          type: boolean
          default: true
          description: Add Prometheus metrics and health checks
        enableArgoCD:
          title: Enable ArgoCD Deployment
          type: boolean
          default: true
          description: Create ArgoCD application manifests
        k8sNamespace:
          title: Kubernetes Namespace
          type: string
          default: default
          description: Target namespace for deployment

  steps:
    - id: fetch-base
      name: Fetch Base Template
      action: fetch:template
      input:
        url: ./content
        values:
          name: ${{ parameters.name }}
          description: ${{ parameters.description }}
          owner: ${{ parameters.owner }}
          port: ${{ parameters.port }}
          enablePWA: ${{ parameters.enablePWA }}
          enableTesting: ${{ parameters.enableTesting }}
          enableStorybook: ${{ parameters.enableStorybook }}
          enableMonitoring: ${{ parameters.enableMonitoring }}
          enableArgoCD: ${{ parameters.enableArgoCD }}
          k8sNamespace: ${{ parameters.k8sNamespace }}
          destination: ${{ parameters.repoUrl | parseRepoUrl }}

    - id: publish
      name: Publish to Repository
      action: publish:github
      input:
        allowedHosts: ['github.com']
        description: This is ${{ parameters.name }}
        repoUrl: ${{ parameters.repoUrl }}
        defaultBranch: main
        gitCommitMessage: 'Initial commit for ${{ parameters.name }}'
        gitAuthorName: 'Backstage Scaffolder'
        gitAuthorEmail: 'scaffolder@backstage.io'

    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: '/catalog-info.yaml'

    - id: create-argocd-app
      name: Create ArgoCD Application
      if: ${{ parameters.enableArgoCD }}
      action: argocd:create-app
      input:
        appName: ${{ parameters.name }}
        repoUrl: ${{ steps.publish.output.remoteUrl }}
        namespace: ${{ parameters.k8sNamespace }}
        path: k8s/

  output:
    links:
      - title: Repository
        url: ${{ steps.publish.output.remoteUrl }}
      - title: Open in catalog
        icon: catalog
        entityRef: ${{ steps.register.output.entityRef }}
      - title: ArgoCD Application
        url: https://argocd.idp-platform.local/applications/${{ parameters.name }}
        if: ${{ parameters.enableArgoCD }}
```

### 3. React Template Content Structure

Create `templates/react-app/content/` directory with the following files:

#### `templates/react-app/content/package.json`:

```json
{
  "name": "${{ values.name }}",
  "version": "0.1.0",
  "description": "${{ values.description }}",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "axios": "^1.3.0",
    {% if values.enablePWA %}
    "workbox-webpack-plugin": "^6.5.0",
    {% endif %}
    {% if values.enableMonitoring %}
    "prom-client": "^14.2.0",
    "express": "^4.18.0",
    "@types/express": "^4.17.0",
    {% endif %}
    "web-vitals": "^3.1.0"
  },
  "devDependencies": {
    "react-scripts": "5.0.1",
    "tailwindcss": "^3.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@tailwindcss/forms": "^0.5.0",
    "@tailwindcss/typography": "^0.5.0",
    "eslint": "^8.34.0",
    "@typescript-eslint/eslint-plugin": "^5.52.0",
    "@typescript-eslint/parser": "^5.52.0",
    "prettier": "^2.8.0",
    "prettier-plugin-tailwindcss": "^0.2.0",
    {% if values.enableTesting %}
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^5.16.0",
    "@testing-library/user-event": "^14.4.0",
    "cypress": "^12.5.0",
    "@cypress/react": "^7.0.0",
    {% endif %}
    {% if values.enableStorybook %}
    "@storybook/react": "^6.5.0",
    "@storybook/addon-essentials": "^6.5.0",
    "@storybook/addon-interactions": "^6.5.0",
    "@storybook/testing-library": "^0.0.13",
    {% endif %}
    "husky": "^8.0.0",
    "lint-staged": "^13.1.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "lint": "eslint src --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint src --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write src/**/*.{js,jsx,ts,tsx,json,css,md}",
    {% if values.enableTesting %}
    "test:coverage": "react-scripts test --coverage --watchAll=false",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    {% endif %}
    {% if values.enableStorybook %}
    "storybook": "start-storybook -p 6006",
    "build-storybook": "build-storybook",
    {% endif %}
    {% if values.enableMonitoring %}
    "metrics": "node src/metrics/server.js",
    {% endif %}
    "prepare": "husky install"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  {% if values.enableTesting %}
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{js,jsx,ts,tsx}",
      "!src/**/*.d.ts",
      "!src/index.tsx",
      "!src/reportWebVitals.ts"
    ]
  },
  {% endif %}
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx,json,css,md}": [
      "prettier --write",
      "eslint --fix"
    ]
  }
}
```

#### `templates/react-app/content/src/App.tsx`:

```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import Home from './pages/Home';
import About from './pages/About';
{% if values.enableMonitoring %}
import HealthCheck from './components/HealthCheck';
{% endif %}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            {% if values.enableMonitoring %}
            <Route path="/health" element={<HealthCheck />} />
            {% endif %}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
```

#### `templates/react-app/content/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
```

### 4. Create Next.js Template

Create `templates/nextjs-app/template.yaml`:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: nextjs-tailwind-app
  title: Next.js + Tailwind CSS Application
  description: Create a new Next.js application with Tailwind CSS, TypeScript, and modern development tools
  tags:
    - nextjs
    - react
    - typescript
    - tailwind
    - fullstack
spec:
  owner: platform-team
  type: service
  parameters:
    - title: Application Information
      required:
        - name
        - description
        - owner
      properties:
        name:
          title: Name
          type: string
          description: Unique name for the application
          pattern: '^[a-zA-Z0-9-]+$'
        description:
          title: Description
          type: string
          description: Help others understand what this application is for
        owner:
          title: Owner
          type: string
          ui:field: OwnerPicker

    - title: Repository Information
      required:
        - repoUrl
      properties:
        repoUrl:
          title: Repository Location
          type: string
          ui:field: RepoUrlPicker

    - title: Next.js Configuration
      properties:
        appRouter:
          title: Use App Router
          type: boolean
          default: true
          description: Use the new Next.js 13+ App Router
        enableAPI:
          title: Enable API Routes
          type: boolean
          default: true
          description: Include API routes and middleware
        enableAuth:
          title: Enable Authentication
          type: boolean
          default: false
          description: Add NextAuth.js integration
        enableDatabase:
          title: Enable Database
          type: boolean
          default: false
          description: Add Prisma ORM setup

    - title: Platform Integration
      properties:
        enableMonitoring:
          title: Enable Monitoring
          type: boolean
          default: true
        enableArgoCD:
          title: Enable ArgoCD Deployment
          type: boolean
          default: true
        k8sNamespace:
          title: Kubernetes Namespace
          type: string
          default: default

  steps:
    - id: fetch-base
      name: Fetch Base Template
      action: fetch:template
      input:
        url: ./content
        values:
          name: ${{ parameters.name }}
          description: ${{ parameters.description }}
          owner: ${{ parameters.owner }}
          appRouter: ${{ parameters.appRouter }}
          enableAPI: ${{ parameters.enableAPI }}
          enableAuth: ${{ parameters.enableAuth }}
          enableDatabase: ${{ parameters.enableDatabase }}
          enableMonitoring: ${{ parameters.enableMonitoring }}
          enableArgoCD: ${{ parameters.enableArgoCD }}
          k8sNamespace: ${{ parameters.k8sNamespace }}

    - id: publish
      name: Publish to Repository
      action: publish:github
      input:
        allowedHosts: ['github.com']
        description: This is ${{ parameters.name }}
        repoUrl: ${{ parameters.repoUrl }}

    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: '/catalog-info.yaml'

  output:
    links:
      - title: Repository
        url: ${{ steps.publish.output.remoteUrl }}
      - title: Open in catalog
        icon: catalog
        entityRef: ${{ steps.register.output.entityRef }}
```

### 5. Create NestJS Backend Template

Create `templates/nestjs-app/template.yaml`:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: nestjs-app
  title: NestJS Backend Application
  description: Create a new NestJS backend application with TypeScript, authentication, and database integration
  tags:
    - nestjs
    - nodejs
    - typescript
    - backend
    - api
spec:
  owner: platform-team
  type: service
  parameters:
    - title: Application Information
      required:
        - name
        - description
        - owner
      properties:
        name:
          title: Name
          type: string
          description: Unique name for the application
          pattern: '^[a-zA-Z0-9-]+$'
        description:
          title: Description
          type: string
          description: Help others understand what this API is for
        owner:
          title: Owner
          type: string
          ui:field: OwnerPicker

    - title: Repository Information
      required:
        - repoUrl
      properties:
        repoUrl:
          title: Repository Location
          type: string
          ui:field: RepoUrlPicker

    - title: NestJS Configuration
      properties:
        port:
          title: Application Port
          type: number
          default: 3000
          description: Port for the NestJS application
        enableAuth:
          title: Enable Authentication
          type: boolean
          default: true
          description: Add JWT authentication with Passport
        enableSwagger:
          title: Enable OpenAPI/Swagger
          type: boolean
          default: true
          description: Add Swagger documentation
        enableDatabase:
          title: Enable Database
          type: boolean
          default: true
          description: Add TypeORM with PostgreSQL
        enableRedis:
          title: Enable Redis Cache
          type: boolean
          default: false
          description: Add Redis caching support
        enableGraphQL:
          title: Enable GraphQL
          type: boolean
          default: false
          description: Add GraphQL API support

    - title: Platform Integration
      properties:
        enableMonitoring:
          title: Enable Monitoring
          type: boolean
          default: true
          description: Add Prometheus metrics and health checks
        enableArgoCD:
          title: Enable ArgoCD Deployment
          type: boolean
          default: true
        k8sNamespace:
          title: Kubernetes Namespace
          type: string
          default: default

  steps:
    - id: fetch-base
      name: Fetch Base Template
      action: fetch:template
      input:
        url: ./content
        values:
          name: ${{ parameters.name }}
          description: ${{ parameters.description }}
          owner: ${{ parameters.owner }}
          port: ${{ parameters.port }}
          enableAuth: ${{ parameters.enableAuth }}
          enableSwagger: ${{ parameters.enableSwagger }}
          enableDatabase: ${{ parameters.enableDatabase }}
          enableRedis: ${{ parameters.enableRedis }}
          enableGraphQL: ${{ parameters.enableGraphQL }}
          enableMonitoring: ${{ parameters.enableMonitoring }}
          enableArgoCD: ${{ parameters.enableArgoCD }}
          k8sNamespace: ${{ parameters.k8sNamespace }}

    - id: publish
      name: Publish to Repository
      action: publish:github
      input:
        allowedHosts: ['github.com']
        description: This is ${{ parameters.name }}
        repoUrl: ${{ parameters.repoUrl }}

    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: '/catalog-info.yaml'

  output:
    links:
      - title: Repository
        url: ${{ steps.publish.output.remoteUrl }}
      - title: Open in catalog
        icon: catalog
        entityRef: ${{ steps.register.output.entityRef }}
```

### 6. NestJS Template Content

#### `templates/nestjs-app/content/package.json`:

```json
{
  "name": "${{ values.name }}",
  "version": "0.0.1",
  "description": "${{ values.description }}",
  "author": "${{ values.owner }}",
  "private": true,
  "license": "MIT",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    {% if values.enableDatabase %}
    "typeorm": "npm run build && npx typeorm -d dist/database/data-source.js",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert",
    {% endif %}
    "prepare": "husky install"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/throttler": "^4.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    {% if values.enableAuth %}
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.0",
    "passport-local": "^1.0.0",
    "bcrypt": "^5.1.0",
    {% endif %}
    {% if values.enableSwagger %}
    "@nestjs/swagger": "^7.0.0",
    {% endif %}
    {% if values.enableDatabase %}
    "@nestjs/typeorm": "^10.0.0",
    "typeorm": "^0.3.0",
    "pg": "^8.8.0",
    {% endif %}
    {% if values.enableRedis %}
    "@nestjs/cache-manager": "^2.0.0",
    "cache-manager": "^5.0.0",
    "cache-manager-redis-store": "^3.0.0",
    {% endif %}
    {% if values.enableGraphQL %}
    "@nestjs/graphql": "^12.0.0",
    "@nestjs/apollo": "^12.0.0",
    "apollo-server-express": "^3.12.0",
    "graphql": "^16.6.0",
    {% endif %}
    {% if values.enableMonitoring %}
    "@nestjs/terminus": "^10.0.0",
    "prom-client": "^14.2.0",
    {% endif %}
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.3.0",
    "@types/supertest": "^2.0.12",
    {% if values.enableAuth %}
    "@types/bcrypt": "^5.0.0",
    "@types/passport-jwt": "^3.0.8",
    "@types/passport-local": "^1.0.35",
    {% endif %}
    {% if values.enableDatabase %}
    "@types/pg": "^8.6.6",
    {% endif %}
    "@typescript-eslint/eslint-plugin": "^5.59.0",
    "@typescript-eslint/parser": "^5.59.0",
    "eslint": "^8.42.0",
    "eslint-config-prettier": "^8.8.0",
    "eslint-plugin-prettier": "^4.2.1",
    "jest": "^29.5.0",
    "prettier": "^2.8.8",
    "source-map-support": "^0.5.21",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3",
    "husky": "^8.0.0",
    "lint-staged": "^13.2.0"
  }
}
```

#### `templates/nestjs-app/content/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
{% if values.enableSwagger %}
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
{% endif %}
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Enable CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  {% if values.enableSwagger %}
  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('${{ values.name }}')
    .setDescription('${{ values.description }}')
    .setVersion('1.0')
    {% if values.enableAuth %}
    .addBearerAuth()
    {% endif %}
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  {% endif %}

  const port = process.env.PORT || ${{ values.port }};
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
  {% if values.enableSwagger %}
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  {% endif %}
}

bootstrap();
```

### 7. Create Universal Kubernetes Manifests

Create shared Kubernetes manifests in each template:

#### `templates/*/content/k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${{ values.name }}
  namespace: ${{ values.k8sNamespace }}
  labels:
    app: ${{ values.name }}
    version: "1.0.0"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${{ values.name }}
  template:
    metadata:
      labels:
        app: ${{ values.name }}
        version: "1.0.0"
      annotations:
        {% if values.enableMonitoring %}
        prometheus.io/scrape: "true"
        prometheus.io/port: "{% if values.port %}${{ values.port }}{% else %}3000{% endif %}"
        prometheus.io/path: "/metrics"
        {% endif %}
    spec:
      containers:
        - name: ${{ values.name }}
          image: ${AWS_ECR_REGISTRY}/${{ values.name }}:latest
          ports:
            - containerPort: {% if values.port %}${{ values.port }}{% else %}3000{% endif %}
              name: http
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "{% if values.port %}${{ values.port }}{% else %}3000{% endif %}"
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
      imagePullSecrets:
        - name: ecr-secret
---
apiVersion: v1
kind: Service
metadata:
  name: ${{ values.name }}
  namespace: ${{ values.k8sNamespace }}
  labels:
    app: ${{ values.name }}
spec:
  selector:
    app: ${{ values.name }}
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  type: ClusterIP
```

### 8. Register Template Actions in Backend

Update `packages/backend/src/index.ts`:

```typescript
import { createBackend } from '@backstage/backend-defaults';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createBackendModule } from '@backstage/backend-plugin-api';

// Create custom ArgoCD action
const argocdModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'argocd-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolder, config }) {
        scaffolder.addActions(
          // Custom ArgoCD application creation action
          createArgoCDApplicationAction({ config }),
        );
      },
    });
  },
});

const backend = createBackend();
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(argocdModule);
backend.start();
```

### 9. Configure Templates in app-config.yaml

```yaml
catalog:
  locations:
    - type: file
      target: ./templates/react-app/template.yaml
    - type: file
      target: ./templates/nextjs-app/template.yaml
    - type: file
      target: ./templates/nestjs-app/template.yaml

scaffolder:
  defaultAuthor:
    name: 'Backstage Scaffolder'
    email: 'scaffolder@backstage.io'
  defaultCommitMessage: 'Initial commit from Backstage'

integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}
```

### 10. Catalog Info Template

Each template includes a `catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${{ values.name }}
  description: ${{ values.description }}
  annotations:
    github.com/project-slug: ${{ values.destination.owner }}/${{ values.destination.repo }}
    {% if values.enableArgoCD %}
    argocd/app-name: ${{ values.name }}
    {% endif %}
    {% if values.enableMonitoring %}
    prometheus.io/alert: ${{ values.name }}
    grafana/dashboard-selector: "app=${{ values.name }}"
    {% endif %}
    backstage.io/kubernetes-id: ${{ values.name }}
    backstage.io/techdocs-ref: dir:.
  tags:
    {% if values.name contains 'react' %}
    - react
    - frontend
    {% elif values.name contains 'nextjs' %}
    - nextjs
    - fullstack
    {% elif values.name contains 'nestjs' %}
    - nestjs
    - backend
    - api
    {% endif %}
    - typescript
    - platform
  links:
    - url: https://github.com/${{ values.destination.owner }}/${{ values.destination.repo }}
      title: GitHub Repository
      icon: github
    {% if values.enableArgoCD %}
    - url: https://argocd.idp-platform.local/applications/${{ values.name }}
      title: ArgoCD Application
      icon: dashboard
    {% endif %}
spec:
  type: {% if values.name contains 'api' or values.name contains 'nestjs' %}service{% else %}website{% endif %}
  lifecycle: experimental
  owner: ${{ values.owner }}
  system: idp-platform
  {% if values.enableArgoCD %}
  dependsOn:
    - resource:default/idp-platform-cluster
  {% endif %}
```

## Environment Variables Required

```bash
# GitHub Integration
GITHUB_TOKEN=<github-personal-access-token>

# ArgoCD Integration
ARGOCD_URL=https://argocd.idp-platform.local
ARGOCD_TOKEN=<argocd-auth-token>

# AWS ECR Registry
AWS_ECR_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com

# Application URLs
APP_BASE_URL=https://backstage.idp-platform.local
```

## Expected Outcomes

### ✅ **Modern Application Templates**

- React 18 + Tailwind CSS with modern tooling
- Next.js with App Router and TypeScript
- NestJS with comprehensive backend features

### ✅ **Integrated CI/CD Pipelines**

- Automated Argo Workflows for each template
- Docker containerization with AWS ECR
- ArgoCD deployment automation

### ✅ **Platform Service Integration**

- Kubernetes manifests with proper annotations
- Monitoring and observability setup
- Security scanning and compliance

### ✅ **Developer Experience**

- Interactive template parameters
- Automated repository creation
- Catalog registration and discovery

## Troubleshooting

### Common Issues

1. **Template Validation Errors**

   - Check YAML syntax and indentation
   - Verify parameter types and constraints
   - Ensure required fields are provided

2. **Repository Creation Failures**

   - Verify GitHub token permissions
   - Check repository naming conflicts
   - Ensure organization access rights

3. **ArgoCD Integration Issues**
   - Verify ArgoCD API connectivity
   - Check namespace and RBAC permissions
   - Ensure repository access from ArgoCD

### Debug Commands

```bash
# Test template locally
yarn backstage-cli repo build --all

# Validate template syntax
backstage-cli template:validate templates/react-app/template.yaml

# Check scaffolder logs
kubectl logs -n backstage deployment/backstage-backend | grep scaffolder
```

## Next Steps

1. **Deploy Templates**: Add templates to Backstage catalog
2. **Test Scaffolding**: Create applications using each template
3. **Validate CI/CD**: Ensure pipelines work correctly
4. **Team Training**: Onboard developers on template usage
5. **Template Evolution**: Gather feedback and iterate on templates

---

**Dependencies**: GitHub integration, ArgoCD, AWS ECR  
**Estimated Effort**: 5-6 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
