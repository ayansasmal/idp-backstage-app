# IDP Backstage Application

This is a comprehensive Backstage developer portal application designed for the Integrated Developer Platform (IDP). Built on the Backstage.io framework, this application serves as a unified interface for developer productivity, service discovery, and platform self-service capabilities.

## What is This Application?

This Backstage app is a **developer portal** that centralizes all aspects of software development and operations in one place. It's designed to improve developer experience by providing:

- 🗂️ **Service Catalog**: Centralized registry and discovery of all services, components, APIs, and resources
- 🏗️ **Software Templates**: Self-service scaffolding for new projects and services
- ☸️ **Kubernetes Integration**: Live visibility into cluster resources and workloads
- 📚 **Technical Documentation**: Integrated docs-as-code with TechDocs
- 🔍 **Search & Discovery**: Unified search across all platform resources
- 👥 **Organization Management**: Team structures, ownership, and responsibility mapping
- 🔐 **Authentication & Permissions**: Secure access control and user management

## Core Features & Capabilities

### 🏛️ **Service Catalog**

- **Component Registry**: Track all services, libraries, websites, and infrastructure
- **API Discovery**: Explore and document REST, GraphQL, and gRPC APIs with mandatory OpenAPI/Swagger documentation
- **API Documentation**: Every backend service automatically exposes comprehensive Swagger documentation
- **Dependency Mapping**: Visualize service relationships and dependencies
- **Ownership Tracking**: Clear ownership and contact information for all components

### 🛠️ **Software Templates (Scaffolder)**

- **Frontend Templates**: React 18+ with Vite for modern, fast development experience
- **Backend Templates**: NestJS with mandatory OpenAPI/Swagger documentation
- **API-First Development**: All backend services must expose comprehensive Swagger documentation
- **Standardization**: Enforce organizational standards and best practices across all projects
- **GitHub Integration**: Automatic repository creation and initial commits
- **Custom Workflows**: Template-driven development workflows with built-in quality gates

### ☸️ **Kubernetes Integration**

- **Cluster Visibility**: Real-time view of Kubernetes resources
- **Workload Monitoring**: Track deployments, pods, and services
- **Multi-cluster Support**: Manage resources across different environments

### 📖 **Documentation Platform (TechDocs)**

- **Docs-as-Code**: Documentation stored alongside source code
- **Automated Publishing**: Automatic doc generation and deployment
- **Searchable Content**: Full-text search across all documentation

### 🔍 **Unified Search**

- **Global Search**: Find components, APIs, docs, and more in one place
- **Intelligent Indexing**: Search across catalogs, documentation, and code

## Architecture & Technology Stack

### **Frontend (React/TypeScript)**

- **Framework**: React 18 with TypeScript
- **Build Tool**: Backstage CLI with custom webpack configuration
- **UI Components**: Backstage Design System and Material-UI
- **Routing**: React Router for SPA navigation
- **State Management**: React hooks and context

### **Backend (Node.js/TypeScript)**

- **Runtime**: Node.js 20/22 with TypeScript
- **Framework**: Backstage backend system with plugin architecture
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: AWS Cognito OIDC provider with multi-factor authentication support
- **API**: RESTful APIs with OpenAPI documentation

### **Key Plugins & Integrations**

- **Catalog Backend**: Service and component management
- **Scaffolder**: Template processing and project generation
- **TechDocs**: Documentation site generation
- **Kubernetes**: Cluster and workload integration
- **Search**: Full-text search across platform resources
- **Permissions**: Role-based access control
- **GitHub Integration**: Repository and workflow integration

### **Development & Deployment**

- **Package Manager**: Yarn workspaces for monorepo management
- **Build System**: TypeScript compilation with Backstage CLI
- **Testing**: Jest for unit tests, Playwright for E2E tests
- **Containerization**: Docker with multi-stage builds
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode

## Project Structure

```
idp-backstage-app/
├── packages/
│   ├── app/                    # Frontend React application
│   │   ├── src/
│   │   │   ├── App.tsx        # Main app component and routing
│   │   │   ├── apis.ts        # API client configurations
│   │   │   └── components/    # Custom UI components
│   │   └── public/            # Static assets and icons
│   └── backend/               # Backend Node.js application
│       └── src/
│           └── index.ts       # Backend plugin configuration
├── plugins/                   # Custom Backstage plugins
├── examples/
│   ├── entities.yaml         # Sample catalog entities
│   ├── org.yaml             # Organization structure
│   └── templates/           # Software templates
├── app-config.yaml          # Main configuration
├── app-config.*.yaml        # Environment-specific configs
├── catalog-info.yaml        # App's own catalog entry
└── package.json             # Workspace root configuration
```

### **Key Directories Explained**

- **`packages/app/`**: Frontend application built with React and TypeScript
- **`packages/backend/`**: Backend services handling APIs, authentication, and integrations
- **`plugins/`**: Custom Backstage plugins for extended functionality
- **`examples/`**: Sample entities, templates, and organization structures
- **Configuration files**: Environment-specific settings for different deployment contexts

## Navigation & User Experience

The application provides an intuitive navigation structure:

### **Main Navigation**

- **🏠 Home** → **Catalog**: Browse all registered components and services
- **🏗️ Create**: Access software templates for new project creation
- **📚 Docs**: Explore technical documentation and guides
- **🔍 Search**: Global search across all platform resources
- **📊 APIs**: Discover and explore available APIs
- **📋 Catalog Import**: Register new components and services
- **📈 Catalog Graph**: Visualize component relationships and dependencies
- **⚙️ Settings**: User preferences and configuration

### **Component Detail Pages**

Each component in the catalog provides:

- **Overview**: Basic information, ownership, and metadata
- **API**: Associated APIs and documentation
- **Dependencies**: Upstream and downstream relationships
- **Docs**: Integrated technical documentation
- **Kubernetes**: Live cluster resource information (if applicable)

## Getting Started

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

## Configuration

### **Application Configuration**

The app uses a layered configuration approach:

- **`app-config.yaml`**: Base configuration for all environments
- **`app-config.local.yaml`**: Local development overrides
- **`app-config.production.yaml`**: Production-specific settings
- **`app-config.idp.yaml`**: IDP platform integration settings

### **Key Configuration Sections**

```yaml
app:
  title: 'Your Developer Portal'
  baseUrl: 'https://your-domain.com'

backend:
  baseUrl: 'https://api.your-domain.com'
  database:
    client: pg # PostgreSQL for production
    connection:
      host: ${POSTGRES_HOST}
      port: ${POSTGRES_PORT}
      user: ${POSTGRES_USER}
      password: ${POSTGRES_PASSWORD}

auth:
  providers:
    awsCognito:
      development:
        clientId: ${AWS_COGNITO_CLIENT_ID}
        clientSecret: ${AWS_COGNITO_CLIENT_SECRET}
        region: ${AWS_REGION}
        userPoolId: ${AWS_COGNITO_USER_POOL_ID}

catalog:
  locations:
    # Register your entities
    - type: file
      target: ./examples/entities.yaml

integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}

scaffolder:
  defaultAuthor:
    name: 'IDP Platform'
    email: 'platform@yourcompany.com'
  defaultBranch: main
```

### **Environment Variables**

Required environment variables for full functionality:

- `GITHUB_TOKEN`: GitHub Personal Access Token for repository integration
- `POSTGRES_*`: Database connection parameters (production)
- `BACKEND_SECRET`: Shared secret for backend authentication
- `AWS_COGNITO_CLIENT_ID`: AWS Cognito App Client ID for OIDC authentication
- `AWS_COGNITO_CLIENT_SECRET`: AWS Cognito App Client Secret
- `AWS_COGNITO_USER_POOL_ID`: AWS Cognito User Pool ID
- `AWS_REGION`: AWS region where Cognito is deployed

## Development Workflow

### **Adding New Components to Catalog**

1. Create or update `catalog-info.yaml` in your repository
2. Register the component via the **Catalog Import** page
3. Or add the location to `app-config.yaml`:
   ```yaml
   catalog:
     locations:
       - type: url
         target: https://github.com/your-org/your-repo/blob/main/catalog-info.yaml
   ```

### **Creating Software Templates**

The platform includes production-ready templates for common use cases:

- **Frontend**: `examples/templates/react-vite-frontend/` - React + Vite application template
- **Backend**: `examples/templates/nestjs-backend/` - NestJS API service template

To create a new custom template:

1. Create a new template directory in `examples/templates/your-template-name/`
2. Define the template structure in `template.yaml` (see existing templates for reference)
3. Add template content in the `content/` directory with proper templating syntax
4. Register the template in the catalog by adding it to your `app-config.yaml`:
   ```yaml
   catalog:
     locations:
       - type: file
         target: ./examples/templates/your-template-name/template.yaml
   ```

Each template should follow these standards:

- **Comprehensive `template.yaml`**: Clear parameters, validation, and steps
- **Complete `content/` directory**: All necessary files with proper templating
- **Documentation**: README.md explaining the generated project
- **Catalog integration**: `catalog-info.yaml` for automatic registration

### **Custom Plugin Development**

1. Create new plugins in the `plugins/` directory
2. Follow Backstage plugin development guidelines
3. Register plugins in the frontend (`App.tsx`) or backend (`index.ts`)

## Available Templates

The IDP platform provides the following production-ready templates:

### 🖥️ **Frontend Templates**

#### **React + Vite Frontend** (`react-vite-frontend`)

- **Technology**: React 18+ with TypeScript and Vite
- **Features**: Fast HMR, modern tooling, comprehensive testing setup
- **Includes**: React Router, Axios, Zustand, Vitest, ESLint, Prettier
- **Use Cases**: Web applications, admin dashboards, customer portals
- **Standards**: Strict TypeScript, component-driven architecture

### ⚙️ **Backend Templates**

#### **NestJS API Service** (`nestjs-backend`)

- **Technology**: NestJS with TypeScript and comprehensive OpenAPI documentation
- **Features**: Mandatory Swagger docs, AWS Cognito auth, PostgreSQL support
- **Includes**: Health checks, validation, security middleware, Docker support
- **Use Cases**: REST APIs, microservices, backend services
- **Standards**: 100% API documentation coverage, enterprise-grade architecture

### 🔧 **Template Features**

All templates include:

- ✅ **Comprehensive Documentation**: README with setup and usage instructions
- ✅ **Backstage Integration**: Automatic catalog registration
- ✅ **Quality Gates**: Linting, formatting, and testing configured
- ✅ **Security**: Best practices and security middleware
- ✅ **Docker Ready**: Production-ready containerization
- ✅ **GitHub Integration**: Automatic repository creation and setup

### 📋 **Template Selection Guide**

| Project Type            | Template              | Best For                      |
| ----------------------- | --------------------- | ----------------------------- |
| Customer-facing web app | `react-vite-frontend` | User interfaces, dashboards   |
| Admin portal            | `react-vite-frontend` | Internal tools, management UI |
| REST API service        | `nestjs-backend`      | Business logic, data APIs     |
| Microservice            | `nestjs-backend`      | Distributed architecture      |
| API Gateway             | `nestjs-backend`      | Request routing, aggregation  |

## Template Architecture & Standards

### **Frontend Template Standards**

The platform provides **React + Vite** templates with the following characteristics:

- **React 18+**: Latest React features including concurrent rendering and automatic batching
- **Vite Build Tool**: Fast development server with HMR and optimized production builds
- **TypeScript**: Strict TypeScript configuration for type safety
- **Modern Tooling**: ESLint, Prettier, and Vitest for code quality and testing
- **Component Architecture**: Modular component structure with proper separation of concerns
- **State Management**: Context API for simple state, with Redux Toolkit for complex scenarios
- **Styling**: CSS Modules or Styled Components for component-level styling
- **Testing**: Comprehensive test suite with React Testing Library and Vitest

### **Backend Template Standards**

The platform mandates **NestJS** for all backend services with strict API documentation requirements:

#### **🚀 NestJS Framework Benefits**

- **Decorator-based Architecture**: Clean, maintainable code structure
- **Built-in OpenAPI Support**: Automatic Swagger documentation generation
- **Dependency Injection**: Professional-grade IoC container
- **Modular Design**: Scalable application architecture
- **TypeScript-first**: Full TypeScript support out of the box

#### **📋 Mandatory API Documentation**

All backend services **MUST** include:

```typescript
// Mandatory decorators for every endpoint
@ApiTags('users')
@Controller('users')
export class UsersController {
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User found', type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':id')
  findOne(@Param('id') id: string): Promise<UserDto> {
    // Implementation
  }
}
```

#### **📖 Swagger Documentation Requirements**

Every API endpoint must provide:

- **Operation Summary**: Clear description of what the endpoint does
- **Parameter Documentation**: All path, query, and body parameters documented
- **Response Models**: DTOs with complete property documentation
- **Error Responses**: All possible error codes and their meanings
- **Authentication Requirements**: Security schemes clearly documented
- **Examples**: Request/response examples for complex operations

#### **🎯 Quality Gates**

Templates include automatic validation:

- **Swagger Completeness Check**: CI/CD pipeline validates 100% API documentation coverage
- **DTO Validation**: All request/response models must use class-validator decorators
- **Security Headers**: Automatic security middleware configuration
- **Health Checks**: Built-in health check endpoints with proper documentation

### **Template Structure**

```
Frontend Template (React + Vite):
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/              # Route-based page components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API service layer
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── __tests__/          # Test files
├── vite.config.ts          # Vite configuration
├── vitest.config.ts        # Test configuration
└── catalog-info.yaml       # Backstage catalog registration

Backend Template (NestJS):
├── src/
│   ├── modules/            # Feature modules
│   │   ├── users/
│   │   │   ├── dto/        # Data Transfer Objects
│   │   │   ├── entities/   # Database entities
│   │   │   ├── controllers/# REST controllers
│   │   │   └── services/   # Business logic
│   ├── common/             # Shared utilities
│   ├── config/             # Configuration files
│   └── main.ts             # Application bootstrap
├── test/                   # E2E tests
├── swagger-config.ts       # OpenAPI configuration
└── catalog-info.yaml       # Backstage catalog registration
```

## Integration with IDP Platform

This Backstage application is designed to integrate seamlessly with the broader IDP platform:

### **Platform Integration Points**

- **Container Registry**: Built images pushed to platform's ECR/registry
- **GitOps Deployment**: ArgoCD handles automated deployments
- **Service Mesh**: Integration with platform's service mesh configuration
- **Monitoring**: Connects to platform monitoring and observability stack
- **Security**: Integrates with platform security policies and scanning

### **Deployment Pipeline**

1. **Source**: Code changes pushed to this repository
2. **Build**: IDP platform builds the application using `yarn build:all`
3. **Package**: Docker image created and pushed to container registry
4. **Deploy**: ArgoCD syncs and deploys to Kubernetes cluster
5. **Monitor**: Platform monitoring tracks application health and performance

## Extensibility & Customization

### **Adding New Features**

- **Plugins**: Extend functionality with custom or community Backstage plugins
- **Integrations**: Connect to additional tools and services (Jira, Slack, etc.)
- **Templates**: Create organization-specific scaffolding templates
- **Themes**: Customize the UI with your organization's branding

### **Community Plugins**

Popular plugins you can add:

- **Cost Insights**: Cloud cost tracking and optimization
- **Security**: Vulnerability scanning and compliance
- **Analytics**: Usage metrics and developer productivity insights
- **Notifications**: Slack, email, and webhook integrations

## Troubleshooting & Support

### **Common Issues**

- **Build Failures**: Check Node.js version (requires 20 or 22)
- **Plugin Errors**: Verify plugin compatibility with current Backstage version
- **Database Issues**: Ensure PostgreSQL is properly configured for production

### **Useful Commands**

```bash
# Check application health
yarn backstage-cli repo lint --since HEAD~1

# Update dependencies
yarn backstage-cli versions:bump

# Generate new plugin
yarn backstage-cli new --scope internal

# Database migrations
yarn workspace backend backstage-cli package build
```

### **Resources**

- [Backstage Documentation](https://backstage.io/docs)
- [Plugin Marketplace](https://backstage.io/plugins)
- [Community Discord](https://discord.gg/MUpMjP2)

---

This Backstage application serves as the central hub for your development platform, providing developers with a unified interface to discover, create, and manage software components while maintaining organizational standards and best practices.
