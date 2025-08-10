# IDP Backstage Application

A production-ready Backstage developer portal application for the Integrated Developer Platform (IDP). This application provides service catalogs, software templates, and streamlined authentication with guest access and optional GitHub OAuth.

## Quick Start

```bash
# Install dependencies
yarn install

# Start development server (uses local config with guest + GitHub auth)
yarn start

# Start with production config
yarn start --config app-config.yaml

# Start with local development config (default)
yarn start --config app-config.local.yaml
```

## Authentication Setup

### Current Configuration: Guest + GitHub OAuth

**Primary Authentication:** Guest access - immediate login with full functionality
- No registration required
- Full access to all features
- Uses `user:default/guest` entity

**Optional Authentication:** GitHub OAuth for personalized experience  
- Set `GITHUB_CLIENT_SECRET` environment variable
- Users can authenticate with their GitHub accounts
- Creates user entities automatically if they don't exist

### User Management

User entities are defined in `examples/org.yaml`:
- `guest` - Default user for guest authentication
- `ayansasmal` - GitHub user with developer permissions
- Groups: `guests`, `developers`

## Configuration Files

- **`app-config.yaml`** - Production configuration with PostgreSQL and full platform integration
- **`app-config.local.yaml`** - Local development with SQLite and simplified setup

## Available Commands

### Development
```bash
yarn start                    # Start dev servers (frontend + backend)
yarn build:backend          # Build backend only
yarn build:all              # Build all packages
yarn build-image            # Build Docker image
```

### Testing & Quality
```bash
yarn test                   # Run tests since last commit
yarn test:all              # Run all tests with coverage
yarn test:e2e              # Run Playwright E2E tests
yarn lint                  # Lint since origin/master
yarn lint:all              # Lint all files
yarn prettier:check       # Check code formatting
yarn tsc                   # Type check
yarn tsc:full             # Full type check
```

### Utilities
```bash
yarn clean                 # Clean build artifacts
yarn new                  # Create new Backstage packages/plugins
yarn fix                  # Auto-fix linting issues
```

## Key Features

### Service Catalog
- Local entity definitions in `examples/entities.yaml`
- Organizational structure in `examples/org.yaml`  
- Software templates for scaffolding new applications

### Software Templates
- Template definitions in `examples/template/`
- Integrated with Backstage scaffolder for self-service app creation

### Simplified Permissions
- RBAC disabled for unrestricted access
- All users (including guests) have full functionality
- No complex role management required

## Environment Variables

### Optional Configuration
```bash
# GitHub Integration (for repository discovery)
GITHUB_TOKEN=<github-personal-access-token>

# GitHub OAuth (for personalized authentication)
GITHUB_CLIENT_SECRET=<github-oauth-client-secret>

# Database (production only)
POSTGRES_HOST=<postgres-host>
POSTGRES_USER=<postgres-user>  
POSTGRES_PASSWORD=<postgres-password>
POSTGRES_DB=<postgres-database>
```

## Integration with IDP Platform

This Backstage application is designed to integrate with the broader [IDP Platform](https://github.com/ayansasmal/idp-platform):

- **Container Registry**: Built as `idp/backstage-app:latest`
- **GitOps Deployment**: Deployed via ArgoCD from platform automation
- **Service Mesh**: Configured for Istio integration  
- **Observability**: Structured for Prometheus/Grafana monitoring

## Development Notes

- Uses Yarn workspaces for monorepo management
- TypeScript throughout for type safety
- Material-UI for consistent design system
- SQLite for local development, PostgreSQL for production
- Playwright for E2E testing

## Getting Started

1. **Clone and Install**:
   ```bash
   git clone <this-repo>
   cd idp-backstage-app
   yarn install
   ```

2. **Start Development**:
   ```bash
   yarn start
   ```

3. **Access Application**:
   - Open http://localhost:3000
   - Click "Enter" for guest access (immediate, full functionality)
   - Or sign in with GitHub for personalized experience

4. **Explore Features**:
   - Browse service catalog
   - Use software templates to create new applications
   - Manage organizational entities

## Documentation

- See `CLAUDE.md` for detailed development guidance
- Check `docs/` directory for task-specific documentation
- Review `examples/` for entity and template examples