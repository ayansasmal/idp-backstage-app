# Unleash Feature Flags Plugin

A Backstage plugin that integrates with Unleash OSS to provide feature flag management with tenant.environment.app scoping.

## Features

- **Multi-tenant Feature Flag Management**: Organize feature flags by tenant, environment, and application
- **Complete CRUD Operations**: Create, read, update, and delete feature flags
- **Environment-specific Toggles**: Enable/disable flags per environment
- **Strategy Management**: Configure feature flag strategies and constraints
- **Metrics and Analytics**: View feature flag usage metrics
- **Auto Project Creation**: Automatically creates Unleash projects based on tenant.environment.app context
- **REST API**: Comprehensive REST API for integration with frontend applications

## Installation

1. Add the plugin to your Backstage backend:

```bash
cd packages/backend
yarn add @internal/backstage-plugin-unleash-feature-flags
```

2. Add the plugin to your backend in `packages/backend/src/index.ts`:

```typescript
import unleashFeatureFlagsPlugin from '@internal/backstage-plugin-unleash-feature-flags';

const backend = createBackend();
backend.add(unleashFeatureFlagsPlugin);
```

## Configuration

Add the following configuration to your `app-config.yaml`:

```yaml
unleash:
  baseUrl: ${UNLEASH_BASE_URL} # e.g., http://localhost:4242
  adminApiKey: ${UNLEASH_ADMIN_API_KEY} # Admin API token for Unleash
  clientApiKey: ${UNLEASH_CLIENT_API_KEY} # Optional: Client API token
  defaultProject: ${UNLEASH_DEFAULT_PROJECT} # Optional: Default project name
```

### Environment Variables

```bash
# Required
UNLEASH_BASE_URL=http://localhost:4242
UNLEASH_ADMIN_API_KEY=your-admin-api-key

# Optional
UNLEASH_CLIENT_API_KEY=your-client-api-key
UNLEASH_DEFAULT_PROJECT=default
```

## API Endpoints

All endpoints require `tenant`, `environment`, and `app` query parameters to establish the context.

### Health Check

- `GET /api/unleash-feature-flags/health`

### Projects and Environments

- `GET /api/unleash-feature-flags/projects` - List all projects
- `GET /api/unleash-feature-flags/environments` - List all environments

### Feature Flags

- `GET /api/unleash-feature-flags/feature-flags?tenant=acme&environment=prod&app=web` - List feature flags
- `GET /api/unleash-feature-flags/feature-flags/:flagName?tenant=acme&environment=prod&app=web` - Get specific flag
- `POST /api/unleash-feature-flags/feature-flags?tenant=acme&environment=prod&app=web` - Create feature flag
- `PUT /api/unleash-feature-flags/feature-flags/:flagName?tenant=acme&environment=prod&app=web` - Update feature flag
- `DELETE /api/unleash-feature-flags/feature-flags/:flagName?tenant=acme&environment=prod&app=web` - Delete feature flag

### Feature Flag Operations

- `POST /api/unleash-feature-flags/feature-flags/:flagName/toggle?tenant=acme&environment=prod&app=web` - Toggle flag
- `GET /api/unleash-feature-flags/feature-flags/:flagName/strategies?tenant=acme&environment=prod&app=web&environment=staging` - Get strategies

### Metrics

- `GET /api/unleash-feature-flags/metrics?tenant=acme&environment=prod&app=web` - Get usage metrics

## Multi-tenant Architecture

The plugin implements a hierarchical naming convention:

### Project Naming

Projects are named: `{tenant}-{environment}-{app}`

- Example: `acme-prod-web`, `acme-staging-api`

### Feature Flag Naming

Feature flags are scoped: `{tenant}.{environment}.{app}.{flagName}`

- Example: `acme.prod.web.new-checkout-flow`

### Environment Naming

Environments are prefixed: `{tenant}-{environment}`

- Example: `acme-prod`, `acme-staging`

## Usage Examples

### Creating a Feature Flag

```bash
curl -X POST "/api/unleash-feature-flags/feature-flags?tenant=acme&environment=prod&app=web" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "new-checkout-flow",
    "displayName": "New Checkout Flow",
    "description": "Enable the new checkout experience",
    "type": "release",
    "impressionData": true
  }'
```

### Toggling a Feature Flag

```bash
curl -X POST "/api/unleash-feature-flags/feature-flags/new-checkout-flow/toggle?tenant=acme&environment=prod&app=web" \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "prod",
    "enabled": true
  }'
```

### Getting Metrics

```bash
curl "/api/unleash-feature-flags/metrics?tenant=acme&environment=prod&app=web"
```

Response:

```json
{
  "metrics": {
    "total": 15,
    "enabled": 8,
    "disabled": 7,
    "stale": 2,
    "byType": {
      "release": 10,
      "experiment": 3,
      "operational": 2
    }
  }
}
```

## Integration with Backstage RBAC

The plugin integrates with the existing RBAC system to control access to feature flags based on user permissions and tenant context.

## Development

### Local Development

1. Start Unleash locally:

```bash
docker run -p 4242:4242 -e UNLEASH_DEFAULT_ADMIN_USERNAME=admin -e UNLEASH_DEFAULT_ADMIN_PASSWORD=unleash4all unleashorg/unleash-server
```

2. Configure the plugin with local Unleash instance:

```yaml
unleash:
  baseUrl: http://localhost:4242
  adminApiKey: '*:*.unleash-insecure-admin-api-token'
```

### Testing

```bash
yarn test
```

### Building

```bash
yarn build
```

## Error Handling

The plugin provides comprehensive error handling:

- **400 Bad Request**: Missing required parameters or invalid input
- **404 Not Found**: Feature flag or environment not found
- **409 Conflict**: Feature flag already exists
- **500 Internal Server Error**: Unleash API errors or internal failures

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure proper error handling and logging

## License

This plugin is part of the internal Backstage platform and follows the same licensing terms.
