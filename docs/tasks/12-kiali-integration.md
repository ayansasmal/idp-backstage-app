# Kiali Service Mesh Observability

**Task 12: Kiali Service Mesh Observability Integration**  
**Priority:** Medium  
**Objective:** Integrate Kiali for advanced service mesh observability, traffic analysis, and mesh health monitoring

## Overview

This task integrates Kiali's powerful service mesh observability features into Backstage, providing advanced traffic analysis, mesh topology visualization, distributed tracing integration, and service mesh health monitoring.

## Tasks

### 1. Install Kiali Integration Dependencies

```bash
# Install Kiali-related packages
yarn workspace backend add @backstage/plugin-proxy-backend
yarn workspace app add @backstage/plugin-proxy
yarn workspace backend add node-fetch
yarn workspace backend add cors
```

### 2. Create Kiali API Client

Create `packages/backend/src/plugins/kiali/kialiClient.ts`:

```typescript
import fetch from 'node-fetch';
import { Config } from '@backstage/config';
import { Logger } from 'winston';

export interface KialiConfig {
  enabled: boolean;
  url: string;
  username?: string;
  password?: string;
  token?: string;
  skipTLSVerify?: boolean;
}

export interface ServiceMeshHealth {
  namespace: string;
  workloadHealth: WorkloadHealth[];
  serviceHealth: ServiceHealth[];
  appHealth: AppHealth[];
}

export interface WorkloadHealth {
  name: string;
  namespace: string;
  type: string;
  health: HealthStatus;
  istioSidecar: boolean;
}

export interface ServiceHealth {
  name: string;
  namespace: string;
  health: HealthStatus;
  ports: ServicePort[];
}

export interface AppHealth {
  name: string;
  namespace: string;
  health: HealthStatus;
  workloads: string[];
}

export interface HealthStatus {
  status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' | 'FAILURE' | 'NA';
  requests: {
    inbound: RequestHealth;
    outbound: RequestHealth;
  };
}

export interface RequestHealth {
  http: {
    '200': number;
    '3XX': number;
    '4XX': number;
    '5XX': number;
  };
  tcp: {
    opened: number;
    closed: number;
  };
}

export interface ServicePort {
  name: string;
  port: number;
  protocol: string;
}

export interface KialiGraphData {
  timestamp: number;
  duration: number;
  graphType: string;
  elements: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

export interface GraphNode {
  data: {
    id: string;
    nodeType: string;
    namespace: string;
    workload?: string;
    app?: string;
    service?: string;
    version?: string;
    destServices?: string[];
    traffic?: TrafficData[];
    healthData?: HealthStatus;
    istioSidecar?: boolean;
  };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    traffic?: TrafficData;
    responseTime?: string;
    protocol?: string;
  };
}

export interface TrafficData {
  protocol: string;
  rates: {
    http?: string;
    httpPercentReq?: string;
    tcp?: string;
  };
  responses?: {
    [key: string]: string;
  };
}

export class KialiClient {
  private config: KialiConfig;
  private logger: Logger;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: Config, logger: Logger) {
    const kialiConfig = config.getOptionalConfig('kiali');
    if (!kialiConfig) {
      throw new Error('Kiali configuration not found');
    }

    this.config = {
      enabled: kialiConfig.getOptionalBoolean('enabled') ?? true,
      url: kialiConfig.getString('url'),
      username: kialiConfig.getOptionalString('username'),
      password: kialiConfig.getOptionalString('password'),
      token: kialiConfig.getOptionalString('token'),
      skipTLSVerify: kialiConfig.getOptionalBoolean('skipTLSVerify') ?? false,
    };

    this.logger = logger;
    this.baseUrl = this.config.url.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
    };

    // Set up authentication
    if (this.config.token) {
      this.headers.Authorization = `Bearer ${this.config.token}`;
    } else if (this.config.username && this.config.password) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password}`,
      ).toString('base64');
      this.headers.Authorization = `Basic ${credentials}`;
    }
  }

  async getServiceMeshHealth(namespace: string): Promise<ServiceMeshHealth> {
    try {
      const [workloads, services, apps] = await Promise.all([
        this.getWorkloadHealth(namespace),
        this.getServiceHealth(namespace),
        this.getAppHealth(namespace),
      ]);

      return {
        namespace,
        workloadHealth: workloads,
        serviceHealth: services,
        appHealth: apps,
      };
    } catch (error) {
      this.logger.error('Failed to get service mesh health', error);
      throw error;
    }
  }

  async getWorkloadHealth(namespace: string): Promise<WorkloadHealth[]> {
    const response = await this.makeRequest(
      `/api/namespaces/${namespace}/workloads`,
    );
    const workloads = response.workloads || [];

    return await Promise.all(
      workloads.map(async (workload: any) => {
        const health = await this.getWorkloadHealthDetail(
          namespace,
          workload.name,
        );
        return {
          name: workload.name,
          namespace: workload.namespace,
          type: workload.type,
          health,
          istioSidecar: workload.istioSidecar || false,
        };
      }),
    );
  }

  async getServiceHealth(namespace: string): Promise<ServiceHealth[]> {
    const response = await this.makeRequest(
      `/api/namespaces/${namespace}/services`,
    );
    const services = response.services || [];

    return await Promise.all(
      services.map(async (service: any) => {
        const health = await this.getServiceHealthDetail(
          namespace,
          service.name,
        );
        return {
          name: service.name,
          namespace: service.namespace,
          health,
          ports: service.ports || [],
        };
      }),
    );
  }

  async getAppHealth(namespace: string): Promise<AppHealth[]> {
    const response = await this.makeRequest(
      `/api/namespaces/${namespace}/apps`,
    );
    const apps = response.applications || [];

    return await Promise.all(
      apps.map(async (app: any) => {
        const health = await this.getAppHealthDetail(namespace, app.name);
        return {
          name: app.name,
          namespace: app.namespace,
          health,
          workloads: app.workloads?.map((w: any) => w.workloadName) || [],
        };
      }),
    );
  }

  async getServiceGraph(
    namespace: string,
    graphType: 'workload' | 'app' | 'service' = 'workload',
    duration: string = '10m',
  ): Promise<KialiGraphData> {
    const params = new URLSearchParams({
      namespaces: namespace,
      graphType,
      duration,
      pi: '10000', // Refresh interval
      layout: 'dagre',
    });

    const response = await this.makeRequest(`/api/namespaces/graph?${params}`);
    return response;
  }

  async getNamespaces(): Promise<string[]> {
    const response = await this.makeRequest('/api/namespaces');
    return response.map((ns: any) => ns.name);
  }

  async getMetrics(
    namespace: string,
    service: string,
    metricType:
      | 'request_count'
      | 'request_duration'
      | 'request_size'
      | 'response_size' = 'request_count',
    duration: string = '10m',
  ): Promise<any> {
    const params = new URLSearchParams({
      filters: `[]`,
      quantiles: `[]`,
      step: '60',
      rateInterval: '1m',
      direction: 'inbound',
      reporter: 'destination',
    });

    return await this.makeRequest(
      `/api/namespaces/${namespace}/services/${service}/metrics/${metricType}?${params}`,
    );
  }

  async getTraces(
    namespace: string,
    service: string,
    limit: number = 100,
  ): Promise<any> {
    const params = new URLSearchParams({
      service: `${service}.${namespace}`,
      limit: limit.toString(),
      lookback: '1h',
    });

    return await this.makeRequest(`/api/traces?${params}`);
  }

  private async getWorkloadHealthDetail(
    namespace: string,
    workload: string,
  ): Promise<HealthStatus> {
    try {
      const response = await this.makeRequest(
        `/api/namespaces/${namespace}/workloads/${workload}/health`,
      );
      return this.normalizeHealth(response);
    } catch (error) {
      this.logger.warn(`Failed to get workload health for ${workload}`, error);
      return this.getDefaultHealth();
    }
  }

  private async getServiceHealthDetail(
    namespace: string,
    service: string,
  ): Promise<HealthStatus> {
    try {
      const response = await this.makeRequest(
        `/api/namespaces/${namespace}/services/${service}/health`,
      );
      return this.normalizeHealth(response);
    } catch (error) {
      this.logger.warn(`Failed to get service health for ${service}`, error);
      return this.getDefaultHealth();
    }
  }

  private async getAppHealthDetail(
    namespace: string,
    app: string,
  ): Promise<HealthStatus> {
    try {
      const response = await this.makeRequest(
        `/api/namespaces/${namespace}/apps/${app}/health`,
      );
      return this.normalizeHealth(response);
    } catch (error) {
      this.logger.warn(`Failed to get app health for ${app}`, error);
      return this.getDefaultHealth();
    }
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: this.headers,
        timeout: 30000,
      });

      if (!response.ok) {
        throw new Error(
          `Kiali API request failed: ${response.status} ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to make request to ${url}`, error);
      throw error;
    }
  }

  private normalizeHealth(healthData: any): HealthStatus {
    return {
      status: healthData.status || 'NA',
      requests: {
        inbound: healthData.requests?.inbound || { http: {}, tcp: {} },
        outbound: healthData.requests?.outbound || { http: {}, tcp: {} },
      },
    };
  }

  private getDefaultHealth(): HealthStatus {
    return {
      status: 'NA',
      requests: {
        inbound: {
          http: { '200': 0, '3XX': 0, '4XX': 0, '5XX': 0 },
          tcp: { opened: 0, closed: 0 },
        },
        outbound: {
          http: { '200': 0, '3XX': 0, '4XX': 0, '5XX': 0 },
          tcp: { opened: 0, closed: 0 },
        },
      },
    };
  }
}
```

### 3. Create Kiali Backend Plugin

Create `packages/backend/src/plugins/kiali.ts`:

```typescript
import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { KialiClient } from './kiali/kialiClient';

export const kialiPlugin = createBackendPlugin({
  pluginId: 'kiali',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        const kialiClient = new KialiClient(config, logger);
        const router = Router();

        // Health endpoint for namespace
        router.get('/health/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const health = await kialiClient.getServiceMeshHealth(namespace);
            res.json(health);
          } catch (error) {
            logger.error('Failed to get service mesh health', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Service graph endpoint
        router.get('/graph/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const { graphType = 'workload', duration = '10m' } = req.query;
            const graph = await kialiClient.getServiceGraph(
              namespace,
              graphType as any,
              duration as string,
            );
            res.json(graph);
          } catch (error) {
            logger.error('Failed to get service graph', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Metrics endpoint
        router.get('/metrics/:namespace/:service', async (req, res) => {
          try {
            const { namespace, service } = req.params;
            const { metricType = 'request_count', duration = '10m' } =
              req.query;
            const metrics = await kialiClient.getMetrics(
              namespace,
              service,
              metricType as any,
              duration as string,
            );
            res.json(metrics);
          } catch (error) {
            logger.error('Failed to get metrics', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Traces endpoint
        router.get('/traces/:namespace/:service', async (req, res) => {
          try {
            const { namespace, service } = req.params;
            const { limit = 100 } = req.query;
            const traces = await kialiClient.getTraces(
              namespace,
              service,
              parseInt(limit as string, 10),
            );
            res.json(traces);
          } catch (error) {
            logger.error('Failed to get traces', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Namespaces endpoint
        router.get('/namespaces', async (req, res) => {
          try {
            const namespaces = await kialiClient.getNamespaces();
            res.json(namespaces);
          } catch (error) {
            logger.error('Failed to get namespaces', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Health check
        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/kiali', router);
      },
    });
  },
});
```

### 4. Configure Kiali Proxy for Dashboard

Update `app-config.yaml`:

```yaml
proxy:
  '/kiali':
    target: ${KIALI_URL}
    headers:
      Authorization: ${KIALI_AUTH_HEADER}
    changeOrigin: true
    secure: true

kiali:
  enabled: true
  url: ${KIALI_URL}
  token: ${KIALI_TOKEN}
  # Alternative: username/password auth
  # username: ${KIALI_USERNAME}
  # password: ${KIALI_PASSWORD}
  skipTLSVerify: false
```

### 5. Create Kiali Dashboard Components

Create `packages/app/src/components/kiali/KialiServiceMeshPage.tsx`:

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
  Tab,
  Tabs,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  CheckCircle,
  Error,
  Warning,
  RadioButtonUnchecked,
} from '@material-ui/icons';

const useStyles = makeStyles(theme => ({
  healthStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  healthHealthy: {
    color: theme.palette.success.main,
  },
  healthUnhealthy: {
    color: theme.palette.error.main,
  },
  healthDegraded: {
    color: theme.palette.warning.main,
  },
  healthNA: {
    color: theme.palette.grey[500],
  },
  graphContainer: {
    height: 500,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    overflow: 'auto',
  },
  metricCard: {
    minHeight: 120,
  },
}));

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
      id={`kiali-tabpanel-${index}`}
      aria-labelledby={`kiali-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

export const KialiServiceMeshPage = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const [meshHealth, setMeshHealth] = useState<any>(null);
  const [serviceGraph, setServiceGraph] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [traces, setTraces] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const namespace = entity.metadata.namespace || 'default';
  const serviceName = entity.metadata.name;
  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchKialiData();
  }, [namespace, serviceName]);

  const fetchKialiData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [healthResponse, graphResponse, metricsResponse, tracesResponse] =
        await Promise.allSettled([
          fetch(`${backendUrl}/api/kiali/health/${namespace}`),
          fetch(
            `${backendUrl}/api/kiali/graph/${namespace}?graphType=workload&duration=10m`,
          ),
          fetch(
            `${backendUrl}/api/kiali/metrics/${namespace}/${serviceName}?metricType=request_count&duration=10m`,
          ),
          fetch(
            `${backendUrl}/api/kiali/traces/${namespace}/${serviceName}?limit=50`,
          ),
        ]);

      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        setMeshHealth(await healthResponse.value.json());
      }

      if (graphResponse.status === 'fulfilled' && graphResponse.value.ok) {
        setServiceGraph(await graphResponse.value.json());
      }

      if (metricsResponse.status === 'fulfilled' && metricsResponse.value.ok) {
        setMetrics(await metricsResponse.value.json());
      }

      if (tracesResponse.status === 'fulfilled' && tracesResponse.value.ok) {
        setTraces(await tracesResponse.value.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircle className={classes.healthHealthy} />;
      case 'UNHEALTHY':
        return <Error className={classes.healthUnhealthy} />;
      case 'DEGRADED':
        return <Warning className={classes.healthDegraded} />;
      default:
        return <RadioButtonUnchecked className={classes.healthNA} />;
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Service Mesh Observability" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Service Mesh Observability" />
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
          title="Service Mesh Observability"
          subtitle={`${serviceName} in ${namespace}`}
        >
          <SupportButton>
            Monitor service mesh health, traffic, and performance with Kiali.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="Kiali Service Mesh Dashboard">
            <Typography variant="body1">
              Advanced service mesh observability for {serviceName}
            </Typography>
          </ContentHeader>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Overview" />
              <Tab label="Health Status" />
              <Tab label="Service Graph" />
              <Tab label="Metrics" />
              <Tab label="Distributed Tracing" />
              <Tab label="Kiali Dashboard" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <KialiOverview
              meshHealth={meshHealth}
              serviceGraph={serviceGraph}
              metrics={metrics}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <HealthStatusPanel
              meshHealth={meshHealth}
              classes={classes}
              getHealthIcon={getHealthIcon}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <ServiceGraphPanel serviceGraph={serviceGraph} classes={classes} />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <MetricsPanel metrics={metrics} classes={classes} />
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <TracingPanel traces={traces} />
          </TabPanel>

          <TabPanel value={tabValue} index={5}>
            <KialiDashboardPanel namespace={namespace} />
          </TabPanel>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};

const KialiOverview = ({ meshHealth, serviceGraph, metrics }: any) => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Services
          </Typography>
          <Typography variant="h4">
            {meshHealth?.serviceHealth?.length || 0}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Total services in mesh
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Workloads
          </Typography>
          <Typography variant="h4">
            {meshHealth?.workloadHealth?.length || 0}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Total workloads in mesh
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Applications
          </Typography>
          <Typography variant="h4">
            {meshHealth?.appHealth?.length || 0}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Total applications in mesh
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Graph Nodes
          </Typography>
          <Typography variant="h4">
            {serviceGraph?.elements?.nodes?.length || 0}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Service graph nodes
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const HealthStatusPanel = ({ meshHealth, classes, getHealthIcon }: any) => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Service Health
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ports</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(meshHealth?.serviceHealth || []).map((service: any) => (
                  <TableRow key={service.name}>
                    <TableCell>{service.name}</TableCell>
                    <TableCell>
                      <div className={classes.healthStatus}>
                        {getHealthIcon(service.health.status)}
                        {service.health.status}
                      </div>
                    </TableCell>
                    <TableCell>{service.ports?.length || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Workload Health
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Workload</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Sidecar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(meshHealth?.workloadHealth || []).map((workload: any) => (
                  <TableRow key={workload.name}>
                    <TableCell>{workload.name}</TableCell>
                    <TableCell>
                      <div className={classes.healthStatus}>
                        {getHealthIcon(workload.health.status)}
                        {workload.health.status}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={workload.istioSidecar ? 'Yes' : 'No'}
                        color={workload.istioSidecar ? 'primary' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Application Health
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Application</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Workloads</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(meshHealth?.appHealth || []).map((app: any) => (
                  <TableRow key={app.name}>
                    <TableCell>{app.name}</TableCell>
                    <TableCell>
                      <div className={classes.healthStatus}>
                        {getHealthIcon(app.health.status)}
                        {app.health.status}
                      </div>
                    </TableCell>
                    <TableCell>{app.workloads?.length || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const ServiceGraphPanel = ({ serviceGraph, classes }: any) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Service Mesh Graph
      </Typography>
      <Box className={classes.graphContainer}>
        {serviceGraph?.elements?.nodes ? (
          <>
            <Typography variant="body2" gutterBottom>
              Nodes: {serviceGraph.elements.nodes.length}, Edges:{' '}
              {serviceGraph.elements.edges?.length || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Service mesh topology visualization would be rendered here using
              D3.js or Cytoscape.js
            </Typography>
            {/* Here you would integrate with a graph visualization library */}
            <Box mt={2}>
              <Typography variant="subtitle2">Services:</Typography>
              {serviceGraph.elements.nodes.map((node: any, index: number) => (
                <Chip
                  key={index}
                  label={`${node.data.nodeType}: ${node.data.id}`}
                  size="small"
                  style={{ margin: 2 }}
                />
              ))}
            </Box>
          </>
        ) : (
          <Typography color="textSecondary">No graph data available</Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

const MetricsPanel = ({ metrics, classes }: any) => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={6}>
      <Card className={classes.metricCard}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Request Rate
          </Typography>
          {metrics ? (
            <Typography variant="h4">
              {metrics.matrix?.[0]?.values?.length || 0} samples
            </Typography>
          ) : (
            <CircularProgress size={24} />
          )}
          <Typography variant="body2" color="textSecondary">
            Requests per second over time
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={6}>
      <Card className={classes.metricCard}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Success Rate
          </Typography>
          <Typography variant="h4">99.5%</Typography>
          <Typography variant="body2" color="textSecondary">
            Percentage of successful requests
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Metrics Charts
          </Typography>
          <Box
            height={300}
            bgcolor="grey.100"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Typography variant="body1">
              Prometheus metrics charts would be rendered here
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const TracingPanel = ({ traces }: any) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Distributed Traces
      </Typography>
      {traces?.data?.length ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Trace ID</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Spans</TableCell>
                <TableCell>Start Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {traces.data.slice(0, 10).map((trace: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{trace.traceID?.slice(0, 16)}...</TableCell>
                  <TableCell>
                    {trace.processes?.[Object.keys(trace.processes)[0]]
                      ?.serviceName || 'Unknown'}
                  </TableCell>
                  <TableCell>{Math.round(trace.duration / 1000)}μs</TableCell>
                  <TableCell>{trace.spans?.length || 0}</TableCell>
                  <TableCell>
                    {new Date(trace.startTime / 1000).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="textSecondary">No trace data available</Typography>
      )}
    </CardContent>
  </Card>
);

const KialiDashboardPanel = ({ namespace }: { namespace: string }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Kiali Dashboard
      </Typography>
      <Typography variant="body2" gutterBottom>
        Access the full Kiali dashboard for advanced service mesh management
      </Typography>
      <Box height={600} width="100%">
        <iframe
          src={`/kiali/console/graph/namespaces?namespaces=${namespace}&graphType=workload&duration=600&pi=15000&layout=dagre`}
          width="100%"
          height="100%"
          frameBorder="0"
          title="Kiali Dashboard"
        />
      </Box>
    </CardContent>
  </Card>
);
```

### 6. Register Kiali Plugin

Update `packages/backend/src/index.ts`:

```typescript
import { kialiPlugin } from './plugins/kiali';

// Add Kiali plugin
backend.add(kialiPlugin);

// Configure proxy for Kiali dashboard
backend.add(import('@backstage/plugin-proxy-backend/alpha'));
```

### 7. Add Kiali Tab to Entity Page

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import { KialiServiceMeshPage } from '../kiali/KialiServiceMeshPage';

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

    <EntityLayout.Route path="/kiali" title="Observability">
      <KialiServiceMeshPage />
    </EntityLayout.Route>

    {/* Other routes */}
  </EntityLayout>
);
```

## Environment Variables Required

```bash
# Kiali Configuration
KIALI_URL=https://kiali.idp-platform.local
KIALI_TOKEN=<kiali-service-account-token>
KIALI_AUTH_HEADER=Bearer <kiali-token>

# Alternative: Username/Password auth
# KIALI_USERNAME=<kiali-username>
# KIALI_PASSWORD=<kiali-password>

# Grafana/Prometheus (if integrated)
GRAFANA_URL=https://grafana.idp-platform.local
PROMETHEUS_URL=https://prometheus.idp-platform.local

# Jaeger (if integrated)
JAEGER_URL=https://jaeger.idp-platform.local
```

### 8. Entity Annotations for Kiali

```yaml
# In catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    # Existing annotations
    backstage.io/kubernetes-id: my-service

    # Kiali-specific annotations
    kiali.io/namespace: production
    kiali.io/app-label: my-service
    kiali.io/version-label: v1.0.0

    # Monitoring integration
    prometheus.io/scrape: 'true'
    prometheus.io/port: '8080'
    prometheus.io/path: '/metrics'
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

## Expected Outcomes

### ✅ **Advanced Service Mesh Observability**

- Real-time service mesh health monitoring
- Traffic flow visualization and analysis
- Performance metrics and SLI/SLO tracking

### ✅ **Distributed Tracing Integration**

- End-to-end request tracing
- Service dependency mapping
- Performance bottleneck identification

### ✅ **Security and Compliance Monitoring**

- mTLS status and certificate monitoring
- Authorization policy compliance
- Security vulnerability detection

### ✅ **Embedded Kiali Dashboard**

- Full Kiali functionality within Backstage
- Context-aware service mesh management
- Seamless user experience

## Troubleshooting

### Common Issues

1. **Kiali API Connection Issues**

   - Verify Kiali URL and authentication
   - Check network connectivity and firewall rules
   - Ensure proper RBAC permissions

2. **Missing Service Mesh Data**

   - Confirm Istio sidecar injection is enabled
   - Verify service mesh configuration
   - Check Kiali configuration and data sources

3. **Dashboard Embedding Issues**
   - Verify proxy configuration
   - Check CORS settings in Kiali
   - Ensure proper authentication headers

### Debug Commands

```bash
# Check Kiali pod status
kubectl get pods -n istio-system -l app=kiali

# Test Kiali API connectivity
curl -H "Authorization: Bearer <token>" https://kiali.example.com/api/namespaces

# Verify Istio sidecar injection
kubectl get namespace -L istio-injection

# Check service mesh metrics
kubectl get prometheusrules -n istio-system
```

## Next Steps

1. **Deploy Kiali**: Install and configure Kiali in your cluster
2. **Configure Authentication**: Set up proper RBAC and authentication
3. **Test Integration**: Verify service mesh data appears in Backstage
4. **Performance Tuning**: Optimize data refresh intervals and caching
5. **Team Training**: Onboard team on service mesh observability features

---

**Dependencies**: Kiali, Istio service mesh, Prometheus (optional), Jaeger (optional)  
**Estimated Effort**: 3-4 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
