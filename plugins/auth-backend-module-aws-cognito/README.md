# AWS Cognito Authentication Provider Plugin

A Backstage authentication provider plugin for AWS Cognito integration with OIDC support.

## Features

- **OIDC Authentication**: Full OpenID Connect support with AWS Cognito
- **JWT Validation**: Secure token verification using aws-jwt-verify
- **User Profile Mapping**: Automatic user profile extraction from Cognito claims
- **Group Support**: Cognito user groups integration for authorization
- **Hosted UI**: Support for Cognito hosted authentication UI
- **Token Management**: Automatic token refresh and validation

## Installation

```bash
# Install the plugin
yarn add @internal/plugin-auth-backend-module-aws-cognito

# Install peer dependencies
yarn add aws-jwt-verify
```

## Configuration

Add the following to your `app-config.yaml`:

```yaml
auth:
  providers:
    awsCognito:
      # AWS Cognito User Pool configuration
      userPoolId: us-east-1_XXXXXXXXX
      clientId: your-cognito-app-client-id
      clientSecret: your-cognito-app-client-secret
      region: us-east-1
      domain: your-cognito-domain.auth.us-east-1.amazoncognito.com

      # Optional: Custom claims mapping
      claimsMapping:
        displayName: name
        email: email
        username: cognito:username
        groups: cognito:groups
```

## Backend Integration

Add the authentication provider to your backend:

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';
import { authModuleAwsCognitoProvider } from '@internal/plugin-auth-backend-module-aws-cognito';

const backend = createBackend();

// Register the AWS Cognito auth provider
backend.add(authModuleAwsCognitoProvider);

backend.start();
```

## Frontend Integration

Configure the frontend to use AWS Cognito authentication:

```typescript
// packages/app/src/apis.ts
import { createApiFactory, githubAuthApiRef } from '@backstage/core-plugin-api';

export const apis = [
  createApiFactory({
    api: githubAuthApiRef,
    deps: {},
    factory: () => {
      // Configure for AWS Cognito
      return new OAuth2Api({
        discoveryApi,
        oauthRequestApi,
        environment: 'development',
        provider: {
          id: 'aws-cognito',
          title: 'AWS Cognito',
          icon: () => null,
        },
      });
    },
  }),
];
```

## AWS Cognito Setup

### 1. Create User Pool

```bash
# Using AWS CLI
aws cognito-idp create-user-pool \
  --pool-name "backstage-users" \
  --policies PasswordPolicy='{MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=true}' \
  --auto-verified-attributes email \
  --username-attributes email
```

### 2. Create App Client

```bash
# Create app client with OAuth flow
aws cognito-idp create-user-pool-client \
  --user-pool-id us-east-1_XXXXXXXXX \
  --client-name "backstage-client" \
  --generate-secret \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:3000/api/auth/aws-cognito/handler/frame" \
  --logout-urls "http://localhost:3000" \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client
```

### 3. Configure Domain

```bash
# Create custom domain for hosted UI
aws cognito-idp create-user-pool-domain \
  --domain your-backstage-auth \
  --user-pool-id us-east-1_XXXXXXXXX
```

## User Mapping

The plugin supports multiple strategies for mapping Cognito users to Backstage entities:

### Email-based Mapping

Users are matched by email annotation:

```yaml
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: john.doe
  annotations:
    backstage.io/managed-by-location: 'cognito:john.doe@company.com'
spec:
  profile:
    displayName: John Doe
    email: john.doe@company.com
```

### Username-based Mapping

Users are matched by entity name:

```yaml
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: john.doe # Matches cognito:username
spec:
  profile:
    displayName: John Doe
    email: john.doe@company.com
```

## Security Considerations

1. **Token Validation**: All JWT tokens are cryptographically verified
2. **HTTPS Required**: Use HTTPS in production environments
3. **Secret Management**: Store client secrets securely using environment variables
4. **Token Expiry**: Implement proper token refresh mechanisms
5. **CORS Configuration**: Configure appropriate CORS policies

## Troubleshooting

### Common Issues

1. **Invalid JWT signature**: Verify User Pool ID and region configuration
2. **Authentication failed**: Check client ID and client secret
3. **Redirect URI mismatch**: Ensure callback URLs match exactly
4. **User not found**: Verify user entity creation in catalog

### Debug Mode

Enable debug logging:

```yaml
backend:
  logger:
    level: debug
    filter:
      'plugin.auth.aws-cognito': debug
```

## Development

```bash
# Install dependencies
yarn install

# Build the plugin
yarn build

# Run tests
yarn test

# Type checking
yarn tsc
```

## License

Copyright © 2024 Your Organization. All rights reserved.
