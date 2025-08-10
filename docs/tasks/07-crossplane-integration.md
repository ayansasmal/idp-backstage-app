# Crossplane Integration - Infrastructure-as-Code Visibility and Management

**Task 07: Crossplane Integration**  
**Priority:** High  
**Objective:** Integrate Crossplane for infrastructure-as-code (IaC) resource visibility, management, and lifecycle automation in Backstage

## Overview

This task enables platform teams to manage cloud infrastructure resources declaratively using Crossplane, with full visibility and lifecycle controls surfaced in Backstage.

## Tasks

### 1. Install Crossplane Integration Dependencies

```bash
# Install required packages
yarn workspace backend add @backstage/plugin-kubernetes-backend
yarn workspace app add @backstage/plugin-kubernetes
yarn workspace backend add @crossplane/plugin-backend
```

### 2. Create Crossplane Provider

Create `packages/backend/src/plugins/crossplane/crossplaneProvider.ts`:

```typescript
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import fetch from 'node-fetch';

export interface CrossplaneConfig {
  apiUrl: string;
  token: string;
  skipTLSVerify?: boolean;
}

export interface CrossplaneResource {
  kind: string;
  name: string;
  namespace: string;
  status: string;
  age: string;
  spec: any;
  conditions: any[];
  owner: string;
}

export class CrossplaneProvider {
  private config: CrossplaneConfig;
  private logger: Logger;

  constructor(config: Config, logger: Logger) {
    const crossplaneConfig = config.getOptionalConfig('crossplane');
    if (!crossplaneConfig) {
      throw new Error('Crossplane configuration not found');
    }
    this.config = {
      apiUrl: crossplaneConfig.getString('apiUrl'),
      token: crossplaneConfig.getString('token'),
      skipTLSVerify:
        crossplaneConfig.getOptionalBoolean('skipTLSVerify') ?? false,
    };
    this.logger = logger;
  }

  async listResources(namespace: string): Promise<CrossplaneResource[]> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/apis/apiextensions.crossplane.io/v1/namespaces/${namespace}/compositeresources`,
        { headers: { Authorization: `Bearer ${this.config.token}` } },
      );
      if (!response.ok) throw new Error('Failed to fetch Crossplane resources');
      const data = await response.json();
      return data.items.map((item: any) => ({
        kind: item.kind,
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        status: item.status?.conditions?.[0]?.type || 'Unknown',
        age: item.metadata.creationTimestamp,
        spec: item.spec,
        conditions: item.status?.conditions || [],
        owner: item.metadata.ownerReferences?.[0]?.name || 'Unknown',
      }));
    } catch (error) {
      this.logger.error('Failed to list Crossplane resources', error);
      return [];
    }
  }
}
```

### 3. Create Crossplane Backend Plugin

Create `packages/backend/src/plugins/crossplane.ts`:

```typescript
import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { CrossplaneProvider } from './crossplane/crossplaneProvider';

export const crossplanePlugin = createBackendPlugin({
  pluginId: 'crossplane',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        auth: coreServices.auth,
      },
      async init({ httpRouter, logger, config, auth }) {
        const crossplaneProvider = new CrossplaneProvider(config, logger);
        const router = Router();

        router.get('/resources/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const resources = await crossplaneProvider.listResources(namespace);
            res.json(resources);
          } catch (error) {
            logger.error('Failed to get Crossplane resources', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/crossplane', router);
      },
    });
  },
});
```

### 4. Create Crossplane Frontend Component

Create `packages/app/src/components/crossplane/CrossplanePage.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  Page,
  Header,
  Content,
  ContentHeader,
  Progress,
  ErrorBoundary,
  SupportButton,
} from '@backstage/core-components';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@material-ui/core';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';

export const CrossplanePage = () => {
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const namespace = entity.metadata.namespace || 'default';
  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchResources();
  }, [namespace]);

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${backendUrl}/api/crossplane/resources/${namespace}`,
      );
      if (response.ok) {
        setResources(await response.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Crossplane Resources" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Crossplane Resources" />
        <Content>
          <Typography color="error">Error: {error}</Typography>
        </Content>
      </Page>
    );
  }

  return (
    <ErrorBoundary>
      <Page themeId="tool">
        <Header
          title="Crossplane Resources"
          subtitle={`Namespace: ${namespace}`}
        >
          <SupportButton>
            Manage cloud infrastructure resources with Crossplane.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="Infrastructure Resources">
            <Typography variant="body1">
              View and manage Crossplane resources declaratively
            </Typography>
          </ContentHeader>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kind</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resources.map((resource: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{resource.kind}</TableCell>
                    <TableCell>{resource.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={resource.status}
                        color={
                          resource.status === 'Ready' ? 'primary' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{resource.owner}</TableCell>
                    <TableCell>
                      {new Date(resource.age).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};
```

### 5. Register Crossplane Plugin

Update `packages/backend/src/index.ts`:

```typescript
import { crossplanePlugin } from './plugins/crossplane';

// Add Crossplane plugin
backend.add(crossplanePlugin);
```

### 6. Add Crossplane Tab to Entity Page

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import { CrossplanePage } from '../crossplane/CrossplanePage';

// In the service entity case
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {/* Existing overview content */}
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/crossplane" title="Crossplane">
      <CrossplanePage />
    </EntityLayout.Route>

    {/* Other existing routes */}
  </EntityLayout>
);
```

### 7. Configure Crossplane in app-config.yaml

```yaml
crossplane:
  apiUrl: ${CROSSPLANE_API_URL}
  token: ${CROSSPLANE_TOKEN}
  skipTLSVerify: false
```

## Environment Variables Required

```bash
# Crossplane Configuration
CROSSPLANE_API_URL=https://crossplane.idp-platform.local
CROSSPLANE_TOKEN=<crossplane-service-account-token>
```

### 8. Entity Annotations for Crossplane

```yaml
# In catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    backstage.io/kubernetes-id: my-service
    crossplane.io/resource: my-service-resource
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

## Expected Outcomes

### ✅ **Declarative Infrastructure Management**

- Full visibility into Crossplane-managed resources
- Lifecycle controls for cloud infrastructure
- Automated reconciliation and drift detection

### ✅ **Platform Resource Catalog**

- Service catalog integration for infrastructure resources
- Owner and status tracking
- Resource age and condition visibility

## Troubleshooting

### Common Issues

1. **API Authentication Issues**

   - Verify service account token permissions
   - Check API endpoint configuration
   - Ensure RBAC permissions for Crossplane resources

2. **Resource Status Issues**
   - Check resource conditions and events
   - Ensure proper resource spec configuration
   - Review Crossplane controller logs

### Debug Commands

```bash
# List Crossplane resources
kubectl get compositeresources -A

# Check resource status
kubectl describe compositeresource <name> -n <namespace>

# View Crossplane controller logs
kubectl logs -n crossplane-system -l app=crossplane
```

## Next Steps

1. **Deploy Crossplane**: Ensure Crossplane is installed and configured
2. **Configure RBAC**: Set up proper permissions for service account
3. **Test Integration**: Verify resources appear in Backstage
4. **Team Training**: Onboard team on declarative infrastructure management

---

**Dependencies**: Crossplane, Kubernetes RBAC  
**Estimated Effort**: 3-4 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
