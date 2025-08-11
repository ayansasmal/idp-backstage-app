# unleash-feature-flags-backend

Welcome to the Unleash Feature Flags backend plugin!

This plugin provides a decoupled backend API for managing feature flags through Unleash OSS. It supports both production mode (with real Unleash integration) and development mode (with mock data).

## Features

- **CRUD Operations**: Create, read, update, and delete feature flags
- **Unleash Integration**: Full integration with Unleash OSS for production use
- **Development Mode**: Mock data for local development
- **Tenant/Environment Scoping**: Support for multi-tenant, multi-environment deployments
- **Feature Flag Evaluation**: Real-time feature flag evaluation with context
- **Health Monitoring**: Health check endpoint for service monitoring

## Setup

### Installation

The plugin is already included in your Backstage app as an internal plugin.

### Configuration

Add the following configuration to your `app-config.yaml`:

```yaml
# Optional Unleash configuration for production
unleash:
  url: http://localhost:4242/api  # Unleash client API URL
  adminUrl: http://localhost:4242/api/admin  # Unleash admin API URL
  apiToken: <your-unleash-api-token>  # API token for admin operations
  instanceId: idp-backstage  # Unique instance identifier
```

### Environment Variables

You can also configure the plugin using environment variables:

```bash
UNLEASH_URL=http://localhost:4242/api
UNLEASH_ADMIN_URL=http://localhost:4242/api/admin
UNLEASH_API_TOKEN=<your-unleash-api-token>
UNLEASH_INSTANCE_ID=idp-backstage
```

## API Endpoints

### Feature Flags Management

- `GET /api/unleash-feature-flags` - List all feature flags with optional filtering
- `POST /api/unleash-feature-flags` - Create a new feature flag
- `GET /api/unleash-feature-flags/:flagName` - Get feature flag details
- `PATCH /api/unleash-feature-flags/:flagName/toggle` - Toggle feature flag state
- `DELETE /api/unleash-feature-flags/:flagName` - Delete (archive) feature flag

### Feature Flag Evaluation

- `POST /api/unleash-feature-flags/evaluate/:flagName` - Evaluate a feature flag for a specific user context

### Health Monitoring

- `GET /api/unleash-feature-flags/health/status` - Get service health status

## Usage Examples

### Creating a Feature Flag

```bash
curl -X POST http://localhost:7007/api/unleash-feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "tenant": "my-company",
    "environment": "development",
    "application": "web-app", 
    "flagName": "new-checkout-flow",
    "description": "Enable the new checkout flow"
  }'
```

### Evaluating a Feature Flag

```bash
curl -X POST http://localhost:7007/api/unleash-feature-flags/evaluate/my-company.development.web-app.new-checkout-flow \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "environment": "development",
    "properties": {
      "role": "premium_user"
    }
  }'
```

### Getting Feature Flags

```bash
# Get all flags
curl http://localhost:7007/api/unleash-feature-flags

# Filter by environment
curl "http://localhost:7007/api/unleash-feature-flags?environment=development"

# Filter by tenant
curl "http://localhost:7007/api/unleash-feature-flags?tenant=my-company"
```

## Development vs Production Modes

### Development Mode
- Used when no `UNLEASH_API_TOKEN` is configured
- Uses in-memory mock data for testing
- Includes sample feature flags for demonstration

### Production Mode  
- Used when `UNLEASH_API_TOKEN` is configured
- Connects to real Unleash OSS instance
- Supports all Unleash features including strategies, environments, and projects

## Integration with IDP Platform

When deployed on the IDP platform, this plugin automatically integrates with:

- **Unleash OSS**: Deployed as part of the platform infrastructure
- **Service Mesh**: Secured communication through Istio
- **Monitoring**: Metrics and logging through platform observability stack
- **Authentication**: JWT validation for secure access

## Error Handling

The plugin includes comprehensive error handling:

- Input validation for all endpoints
- Graceful fallback to mock data when Unleash is unavailable
- Proper HTTP status codes and error messages
- Detailed logging for troubleshooting

## Naming Convention

Feature flags follow the naming convention:
`{tenant}.{environment}.{application}.{flagName}`

Examples:
- `idp-platform.development.backstage.new-ui-theme`
- `acme-corp.production.api.enhanced-auth`
- `my-company.staging.frontend.beta-features`