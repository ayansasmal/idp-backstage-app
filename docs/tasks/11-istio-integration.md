# Istio Service Mesh Integration

**Task 11: Istio Service Mesh Integration and Visualization**  
**Priority:** High  
**Objective:** Integrate Istio service mesh with Backstage for traffic management, security, and observability

## Overview

This task integrates Istio service mesh capabilities into Backstage, providing visualization of service mesh topology, traffic management, security policies, and observability features.

## Tasks

### 1. Install Istio Plugin Dependencies

```bash
# Install Istio-related packages
yarn workspace backend add @backstage/plugin-kubernetes-backend
yarn workspace backend add @backstage/plugin-kubernetes-node
yarn workspace app add @backstage/plugin-kubernetes
yarn workspace app add @backstage/plugin-kubernetes-react

# Install additional dependencies for Istio integration
yarn workspace backend add @kubernetes/client-node
yarn workspace backend add yaml
yarn workspace backend add lodash
```

### 2. Create Istio Data Provider

Create `packages/backend/src/plugins/istio/istioProvider.ts`:

```typescript
import { KubernetesRequestAuth } from '@backstage/plugin-kubernetes-node';
import { KubernetesApi } from '@kubernetes/client-node';
import { Config } from '@backstage/config';
import { Logger } from 'winston';

export interface IstioConfig {
  enabled: boolean;
  clusters: {
    name: string;
    url: string;
    authProvider: string;
  }[];
}

export interface ServiceMeshInfo {
  virtualServices: any[];
  destinationRules: any[];
  gateways: any[];
  serviceEntries: any[];
  workloadEntries: any[];
  sidecars: any[];
  authorizationPolicies: any[];
  peerAuthentications: any[];
  requestAuthentications: any[];
  telemetryV2: any[];
}

export class IstioProvider {
  private config: IstioConfig;
  private logger: Logger;
  private kubernetesApi: KubernetesApi;

  constructor(config: Config, logger: Logger, kubernetesApi: KubernetesApi) {
    this.config = config.getOptionalConfig('istio') as IstioConfig;
    this.logger = logger;
    this.kubernetesApi = kubernetesApi;
  }

  async getServiceMeshInfo(
    namespace: string,
    auth: KubernetesRequestAuth,
  ): Promise<ServiceMeshInfo> {
    const meshInfo: ServiceMeshInfo = {
      virtualServices: [],
      destinationRules: [],
      gateways: [],
      serviceEntries: [],
      workloadEntries: [],
      sidecars: [],
      authorizationPolicies: [],
      peerAuthentications: [],
      requestAuthentications: [],
      telemetryV2: [],
    };

    try {
      // Fetch Istio CRDs
      meshInfo.virtualServices = await this.getIstioResources(
        'networking.istio.io/v1beta1',
        'virtualservices',
        namespace,
        auth,
      );

      meshInfo.destinationRules = await this.getIstioResources(
        'networking.istio.io/v1beta1',
        'destinationrules',
        namespace,
        auth,
      );

      meshInfo.gateways = await this.getIstioResources(
        'networking.istio.io/v1beta1',
        'gateways',
        namespace,
        auth,
      );

      meshInfo.serviceEntries = await this.getIstioResources(
        'networking.istio.io/v1beta1',
        'serviceentries',
        namespace,
        auth,
      );

      meshInfo.authorizationPolicies = await this.getIstioResources(
        'security.istio.io/v1beta1',
        'authorizationpolicies',
        namespace,
        auth,
      );

      meshInfo.peerAuthentications = await this.getIstioResources(
        'security.istio.io/v1beta1',
        'peerauthentications',
        namespace,
        auth,
      );

      meshInfo.requestAuthentications = await this.getIstioResources(
        'security.istio.io/v1beta1',
        'requestauthentications',
        namespace,
        auth,
      );
    } catch (error) {
      this.logger.error('Failed to fetch Istio resources', error);
    }

    return meshInfo;
  }

  private async getIstioResources(
    apiVersion: string,
    kind: string,
    namespace: string,
    auth: KubernetesRequestAuth,
  ): Promise<any[]> {
    try {
      const response = await this.kubernetesApi.listNamespacedCustomObject(
        apiVersion.split('/')[0],
        apiVersion.split('/')[1],
        namespace,
        kind,
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.warn(
        `Failed to fetch ${kind} in namespace ${namespace}`,
        error,
      );
      return [];
    }
  }

  async getServiceMeshTopology(namespace: string, auth: KubernetesRequestAuth) {
    const services = await this.getServices(namespace, auth);
    const virtualServices = await this.getIstioResources(
      'networking.istio.io/v1beta1',
      'virtualservices',
      namespace,
      auth,
    );
    const destinationRules = await this.getIstioResources(
      'networking.istio.io/v1beta1',
      'destinationrules',
      namespace,
      auth,
    );

    return this.buildTopologyGraph(services, virtualServices, destinationRules);
  }

  private async getServices(namespace: string, auth: KubernetesRequestAuth) {
    try {
      const response = await this.kubernetesApi.listNamespacedService(
        namespace,
      );
      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to fetch services', error);
      return [];
    }
  }

  private buildTopologyGraph(
    services: any[],
    virtualServices: any[],
    destinationRules: any[],
  ) {
    const nodes = services.map(service => ({
      id: service.metadata.name,
      label: service.metadata.name,
      type: 'service',
      namespace: service.metadata.namespace,
      ports: service.spec.ports,
      annotations: service.metadata.annotations,
    }));

    const edges: any[] = [];

    // Build edges from virtual services
    virtualServices.forEach(vs => {
      const routes = vs.spec.http || [];
      routes.forEach((route: any) => {
        route.route?.forEach((destination: any) => {
          edges.push({
            from: vs.metadata.name,
            to: destination.destination.host,
            type: 'http-route',
            weight: destination.weight || 100,
            match: route.match,
          });
        });
      });
    });

    return { nodes, edges };
  }
}
```

### 3. Create Istio Kubernetes Cluster Provider

Create `packages/backend/src/plugins/istio/istioClusterProvider.ts`:

```typescript
import {
  ClusterDetails,
  KubernetesClustersSupplier,
} from '@backstage/plugin-kubernetes-node';
import { Config } from '@backstage/config';

export class IstioClusterProvider implements KubernetesClustersSupplier {
  constructor(private readonly config: Config) {}

  async getClusters(): Promise<ClusterDetails[]> {
    const istioConfig = this.config.getOptionalConfig('istio');
    if (!istioConfig) {
      return [];
    }

    const clusters = istioConfig.getOptionalConfigArray('clusters') || [];

    return clusters.map(cluster => ({
      name: cluster.getString('name'),
      url: cluster.getString('url'),
      authProvider: cluster.getString('authProvider'),
      skipTLSVerify: cluster.getOptionalBoolean('skipTLSVerify') || false,
      skipMetricsLookup:
        cluster.getOptionalBoolean('skipMetricsLookup') || false,
      dashboardUrl: cluster.getOptionalString('dashboardUrl'),
      dashboardApp: cluster.getOptionalString('dashboardApp'),
      customResources: [
        // Istio Networking CRDs
        {
          group: 'networking.istio.io',
          apiVersion: 'v1beta1',
          plural: 'virtualservices',
        },
        {
          group: 'networking.istio.io',
          apiVersion: 'v1beta1',
          plural: 'destinationrules',
        },
        {
          group: 'networking.istio.io',
          apiVersion: 'v1beta1',
          plural: 'gateways',
        },
        {
          group: 'networking.istio.io',
          apiVersion: 'v1beta1',
          plural: 'serviceentries',
        },
        {
          group: 'networking.istio.io',
          apiVersion: 'v1beta1',
          plural: 'workloadentries',
        },
        {
          group: 'networking.istio.io',
          apiVersion: 'v1beta1',
          plural: 'sidecars',
        },
        // Istio Security CRDs
        {
          group: 'security.istio.io',
          apiVersion: 'v1beta1',
          plural: 'authorizationpolicies',
        },
        {
          group: 'security.istio.io',
          apiVersion: 'v1beta1',
          plural: 'peerauthentications',
        },
        {
          group: 'security.istio.io',
          apiVersion: 'v1beta1',
          plural: 'requestauthentications',
        },
        // Istio Telemetry CRDs
        {
          group: 'telemetry.istio.io',
          apiVersion: 'v1alpha1',
          plural: 'telemetries',
        },
      ],
    }));
  }
}
```

### 4. Create Istio Backend Plugin

Create `packages/backend/src/plugins/istio.ts`:

```typescript
import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { IstioProvider } from './istio/istioProvider';
import { IstioClusterProvider } from './istio/istioClusterProvider';

export const istioPlugin = createBackendPlugin({
  pluginId: 'istio',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        auth: coreServices.auth,
      },
      async init({ httpRouter, logger, config, auth }) {
        const istioProvider = new IstioProvider(config, logger, kubernetesApi);
        const router = Router();

        // Endpoint to get service mesh info for a namespace
        router.get('/mesh/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const authHeader = req.headers.authorization;

            if (!authHeader) {
              return res.status(401).json({ error: 'Unauthorized' });
            }

            const meshInfo = await istioProvider.getServiceMeshInfo(namespace, {
              token: authHeader.replace('Bearer ', ''),
            });

            res.json(meshInfo);
          } catch (error) {
            logger.error('Failed to get mesh info', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Endpoint to get service mesh topology
        router.get('/topology/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const authHeader = req.headers.authorization;

            if (!authHeader) {
              return res.status(401).json({ error: 'Unauthorized' });
            }

            const topology = await istioProvider.getServiceMeshTopology(
              namespace,
              { token: authHeader.replace('Bearer ', '') },
            );

            res.json(topology);
          } catch (error) {
            logger.error('Failed to get topology', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Health check endpoint
        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/istio', router);
      },
    });
  },
});
```

### 5. Register Istio Plugin in Backend

Update `packages/backend/src/index.ts`:

```typescript
import { istioPlugin } from './plugins/istio';
import { IstioClusterProvider } from './plugins/istio/istioClusterProvider';

// Add Istio plugin
backend.add(istioPlugin);

// Configure Kubernetes plugin with Istio cluster provider
backend.add(
  createBackendModule({
    pluginId: 'kubernetes',
    moduleId: 'istio-clusters',
    register(reg) {
      reg.registerInit({
        deps: {
          kubernetes: kubernetesExtensionPoint,
          config: coreServices.rootConfig,
        },
        async init({ kubernetes, config }) {
          kubernetes.addClusterSupplier(new IstioClusterProvider(config));
        },
      });
    },
  })(),
);
```

### 6. Create Frontend Istio Components

Create `packages/app/src/components/istio/IstioServiceMeshPage.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  Page,
  Header,
  Content,
  ContentHeader,
  SupportButton,
  Progress,
  ErrorBoundary,
} from '@backstage/core-components';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Tab,
  Tabs,
  Box,
  Chip,
} from '@material-ui/core';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`istio-tabpanel-${index}`}
      aria-labelledby={`istio-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

export const IstioServiceMeshPage = () => {
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const [meshInfo, setMeshInfo] = useState<any>(null);
  const [topology, setTopology] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const namespace = entity.metadata.namespace || 'default';
  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchMeshData();
  }, [namespace]);

  const fetchMeshData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch mesh info
      const meshResponse = await fetch(
        `${backendUrl}/api/istio/mesh/${namespace}`,
      );
      if (!meshResponse.ok) {
        throw new Error('Failed to fetch mesh info');
      }
      const meshData = await meshResponse.json();
      setMeshInfo(meshData);

      // Fetch topology
      const topologyResponse = await fetch(
        `${backendUrl}/api/istio/topology/${namespace}`,
      );
      if (!topologyResponse.ok) {
        throw new Error('Failed to fetch topology');
      }
      const topologyData = await topologyResponse.json();
      setTopology(topologyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Istio Service Mesh" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Istio Service Mesh" />
        <Content>
          <Typography color="error">Error: {error}</Typography>
        </Content>
      </Page>
    );
  }

  return (
    <ErrorBoundary>
      <Page themeId="tool">
        <Header title="Istio Service Mesh" subtitle={`Namespace: ${namespace}`}>
          <SupportButton>
            Manage your service mesh configuration and observability.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="Service Mesh Overview">
            <Typography variant="body1">
              Monitor and manage Istio service mesh resources for{' '}
              {entity.metadata.name}
            </Typography>
          </ContentHeader>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Overview" />
              <Tab label="Virtual Services" />
              <Tab label="Destination Rules" />
              <Tab label="Gateways" />
              <Tab label="Security Policies" />
              <Tab label="Topology" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Networking Resources
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          Virtual Services
                        </Typography>
                        <Typography variant="h4">
                          {meshInfo?.virtualServices?.length || 0}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          Destination Rules
                        </Typography>
                        <Typography variant="h4">
                          {meshInfo?.destinationRules?.length || 0}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">Gateways</Typography>
                        <Typography variant="h4">
                          {meshInfo?.gateways?.length || 0}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">Service Entries</Typography>
                        <Typography variant="h4">
                          {meshInfo?.serviceEntries?.length || 0}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Security Resources
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          Authorization Policies
                        </Typography>
                        <Typography variant="h4">
                          {meshInfo?.authorizationPolicies?.length || 0}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          Peer Authentications
                        </Typography>
                        <Typography variant="h4">
                          {meshInfo?.peerAuthentications?.length || 0}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          Request Authentications
                        </Typography>
                        <Typography variant="h4">
                          {meshInfo?.requestAuthentications?.length || 0}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <VirtualServicesTable
              virtualServices={meshInfo?.virtualServices || []}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <DestinationRulesTable
              destinationRules={meshInfo?.destinationRules || []}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <GatewaysTable gateways={meshInfo?.gateways || []} />
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <SecurityPoliciesTable
              authorizationPolicies={meshInfo?.authorizationPolicies || []}
              peerAuthentications={meshInfo?.peerAuthentications || []}
              requestAuthentications={meshInfo?.requestAuthentications || []}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={5}>
            <ServiceMeshTopology topology={topology} />
          </TabPanel>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};

// Additional components for tables and topology visualization
const VirtualServicesTable = ({
  virtualServices,
}: {
  virtualServices: any[];
}) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Virtual Services
      </Typography>
      {virtualServices.map((vs, index) => (
        <Box key={index} mb={2}>
          <Typography variant="subtitle1">{vs.metadata.name}</Typography>
          <Box>
            {vs.spec.hosts?.map((host: string, hostIndex: number) => (
              <Chip
                key={hostIndex}
                label={host}
                size="small"
                style={{ margin: 2 }}
              />
            ))}
          </Box>
        </Box>
      ))}
    </CardContent>
  </Card>
);

const DestinationRulesTable = ({
  destinationRules,
}: {
  destinationRules: any[];
}) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Destination Rules
      </Typography>
      {destinationRules.map((dr, index) => (
        <Box key={index} mb={2}>
          <Typography variant="subtitle1">{dr.metadata.name}</Typography>
          <Typography variant="body2">Host: {dr.spec.host}</Typography>
          {dr.spec.trafficPolicy && (
            <Typography variant="body2">
              Load Balancer:{' '}
              {dr.spec.trafficPolicy.loadBalancer?.simple || 'Default'}
            </Typography>
          )}
        </Box>
      ))}
    </CardContent>
  </Card>
);

const GatewaysTable = ({ gateways }: { gateways: any[] }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Gateways
      </Typography>
      {gateways.map((gw, index) => (
        <Box key={index} mb={2}>
          <Typography variant="subtitle1">{gw.metadata.name}</Typography>
          {gw.spec.servers?.map((server: any, serverIndex: number) => (
            <Typography key={serverIndex} variant="body2">
              Port: {server.port.number} ({server.port.protocol})
              {server.hosts?.map((host: string) => ` - ${host}`)}
            </Typography>
          ))}
        </Box>
      ))}
    </CardContent>
  </Card>
);

const SecurityPoliciesTable = ({
  authorizationPolicies,
  peerAuthentications,
  requestAuthentications,
}: {
  authorizationPolicies: any[];
  peerAuthentications: any[];
  requestAuthentications: any[];
}) => (
  <Grid container spacing={2}>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Authorization Policies
          </Typography>
          {authorizationPolicies.map((policy, index) => (
            <Box key={index} mb={1}>
              <Typography variant="subtitle2">
                {policy.metadata.name}
              </Typography>
              <Typography variant="body2">
                Selector:{' '}
                {policy.spec.selector ? 'App-specific' : 'Namespace-wide'}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Peer Authentications
          </Typography>
          {peerAuthentications.map((auth, index) => (
            <Box key={index} mb={1}>
              <Typography variant="subtitle2">{auth.metadata.name}</Typography>
              <Typography variant="body2">
                Mode: {auth.spec.mtls?.mode || 'Default'}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Request Authentications
          </Typography>
          {requestAuthentications.map((auth, index) => (
            <Box key={index} mb={1}>
              <Typography variant="subtitle2">{auth.metadata.name}</Typography>
              <Typography variant="body2">
                JWT Rules: {auth.spec.jwtRules?.length || 0}
              </Typography>
            </Box>
          ))}
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const ServiceMeshTopology = ({ topology }: { topology: any }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Service Mesh Topology
      </Typography>
      <Typography variant="body2">
        Services: {topology?.nodes?.length || 0}
      </Typography>
      <Typography variant="body2">
        Connections: {topology?.edges?.length || 0}
      </Typography>
      {/* Add D3.js or other visualization library here */}
      <Box
        height={400}
        bgcolor="grey.100"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography variant="body1">
          Topology visualization would be rendered here
        </Typography>
      </Box>
    </CardContent>
  </Card>
);
```

### 7. Add Istio Tab to Entity Page

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import { IstioServiceMeshPage } from '../istio/IstioServiceMeshPage';

// In the service entity case
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {/* Existing overview content */}
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/kubernetes" title="Kubernetes">
      <EntityKubernetesContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/istio" title="Service Mesh">
      <IstioServiceMeshPage />
    </EntityLayout.Route>

    {/* Other routes */}
  </EntityLayout>
);
```

### 8. Configure Istio in app-config.yaml

```yaml
istio:
  enabled: true
  clusters:
    - name: production
      url: ${K8S_CLUSTER_URL}
      authProvider: serviceAccount
      serviceAccountToken: ${K8S_SERVICE_ACCOUNT_TOKEN}
      dashboardUrl: ${KIALI_DASHBOARD_URL}
      dashboardApp: kiali
      skipTLSVerify: false
      skipMetricsLookup: false
    - name: staging
      url: ${K8S_STAGING_CLUSTER_URL}
      authProvider: serviceAccount
      serviceAccountToken: ${K8S_STAGING_SERVICE_ACCOUNT_TOKEN}

kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: ${K8S_CLUSTER_URL}
          name: production
          authProvider: 'serviceAccount'
          serviceAccountToken: ${K8S_SERVICE_ACCOUNT_TOKEN}
          dashboardUrl: ${K8S_DASHBOARD_URL}
          customResources:
            # Istio CRDs will be added by IstioClusterProvider
            - group: 'networking.istio.io'
              apiVersion: 'v1beta1'
              plural: 'virtualservices'
            - group: 'networking.istio.io'
              apiVersion: 'v1beta1'
              plural: 'destinationrules'
```

## Environment Variables Required

```bash
# Kubernetes cluster configuration
K8S_CLUSTER_URL=https://kubernetes.default.svc
K8S_SERVICE_ACCOUNT_TOKEN=<service-account-token>
K8S_DASHBOARD_URL=https://k8s-dashboard.idp-platform.local

# Staging cluster (optional)
K8S_STAGING_CLUSTER_URL=https://staging-kubernetes.default.svc
K8S_STAGING_SERVICE_ACCOUNT_TOKEN=<staging-service-account-token>

# Kiali dashboard URL
KIALI_DASHBOARD_URL=https://kiali.idp-platform.local
```

### 9. Add Istio Entity Annotations

Create entity annotation support for Istio resources:

```yaml
# In catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    # Existing annotations
    backstage.io/kubernetes-id: my-service

    # Istio-specific annotations
    istio.io/virtual-service: my-service-vs
    istio.io/destination-rule: my-service-dr
    istio.io/gateway: my-service-gateway
    istio.io/service-entry: external-service

    # Security policy annotations
    istio.io/authorization-policy: my-service-authz
    istio.io/peer-authentication: my-service-peer-auth
    istio.io/request-authentication: my-service-req-auth
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

## Expected Outcomes

### ✅ **Service Mesh Visibility**

- Real-time visualization of Istio service mesh resources
- Traffic flow and routing visualization
- Service dependency mapping

### ✅ **Security Policy Management**

- Authorization policies visualization
- mTLS configuration status
- Security policy compliance checking

### ✅ **Traffic Management**

- Virtual service configuration display
- Destination rule settings
- Gateway and ingress management

### ✅ **Observability Integration**

- Service mesh metrics and monitoring
- Integration with Kiali dashboard
- Traffic analytics and insights

## Security Considerations

### Service Mesh Security

```yaml
# Authorization Policy Example
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: backstage-service-authz
  namespace: backstage
spec:
  selector:
    matchLabels:
      app: backstage
  rules:
    - from:
        - source:
            principals: ['cluster.local/ns/backstage/sa/backstage']
    - to:
        - operation:
            methods: ['GET', 'POST']
```

### mTLS Configuration

```yaml
# Peer Authentication Example
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: backstage-peer-auth
  namespace: backstage
spec:
  selector:
    matchLabels:
      app: backstage
  mtls:
    mode: STRICT
```

## Troubleshooting

### Common Issues

1. **Istio CRDs Not Found**

   - Verify Istio is installed in the cluster
   - Check CRD definitions are available
   - Ensure RBAC permissions for CRD access

2. **Service Mesh Data Not Loading**

   - Verify Kubernetes service account has proper permissions
   - Check cluster connectivity and authentication
   - Review Istio namespace and resource names

3. **Topology Visualization Issues**
   - Ensure all required Istio resources are present
   - Check service mesh injection is enabled
   - Verify service annotations are correct

### Debug Commands

```bash
# Check Istio installation
kubectl get pods -n istio-system

# Verify CRDs are available
kubectl get crd | grep istio

# Check service mesh injection
kubectl get namespace -L istio-injection

# List Istio resources
kubectl get virtualservices,destinationrules,gateways -A
```

## Next Steps

1. **Deploy Istio**: Ensure Istio is properly installed and configured
2. **Configure RBAC**: Set up proper permissions for Istio resource access
3. **Test Integration**: Verify service mesh resources are visible in Backstage
4. **Add Metrics**: Integrate with Prometheus and Grafana for enhanced observability
5. **Team Training**: Onboard team on service mesh management through Backstage

---

**Dependencies**: Istio service mesh, Kubernetes RBAC, Kiali (optional)  
**Estimated Effort**: 4-5 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
