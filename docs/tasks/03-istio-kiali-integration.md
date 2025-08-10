# Istio and Kiali Service Mesh Integration

**Task 03: Istio and Kiali Service Mesh Integration**  
**Priority:** High  
**Objective:** Integrate Istio service mesh with Kiali observability for comprehensive service mesh topology and traffic monitoring

## Overview

This task provides a unified integration of both Istio service mesh and Kiali observability platform, offering complete service mesh management, traffic analysis, security policy monitoring, and advanced observability features through Backstage.

## Tasks

### 1. Install Service Mesh Integration Dependencies

```bash
# Install service mesh related packages
yarn workspace backend add @backstage/plugin-kubernetes-backend
yarn workspace app add @backstage/plugin-kubernetes
yarn workspace backend add @kubernetes/client-node
yarn workspace backend add node-fetch
yarn workspace backend add yaml
yarn workspace backend add lodash
```

### 2. Create Unified Service Mesh Provider

Create `packages/backend/src/plugins/serviceMesh/serviceMeshProvider.ts`:

```typescript
import { KubernetesRequestAuth } from '@backstage/plugin-kubernetes-node';
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import fetch from 'node-fetch';

export interface ServiceMeshConfig {
  istio: {
    enabled: boolean;
    clusters: Array<{
      name: string;
      url: string;
      authProvider: string;
    }>;
  };
  kiali: {
    enabled: boolean;
    url: string;
    username?: string;
    password?: string;
    token?: string;
    skipTLSVerify?: boolean;
  };
}

export interface ServiceMeshTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  namespaces: string[];
  summary: {
    services: number;
    workloads: number;
    applications: number;
    edges: number;
  };
}

export interface TopologyNode {
  id: string;
  nodeType: 'service' | 'workload' | 'app' | 'unknown';
  namespace: string;
  name: string;
  version?: string;
  labels?: Record<string, string>;
  health?: HealthStatus;
  traffic?: TrafficMetrics;
  istioSidecar?: boolean;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  traffic?: TrafficMetrics;
  protocol?: string;
  responseTime?: number;
  security?: SecurityInfo;
}

export interface HealthStatus {
  status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' | 'FAILURE' | 'NA';
  requests: {
    inbound: RequestMetrics;
    outbound: RequestMetrics;
  };
}

export interface RequestMetrics {
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

export interface TrafficMetrics {
  protocol: string;
  rates: {
    http?: string;
    httpPercentReq?: string;
    tcp?: string;
  };
  responses?: Record<string, string>;
}

export interface SecurityInfo {
  mtls: {
    enabled: boolean;
    status: 'STRICT' | 'PERMISSIVE' | 'DISABLED';
  };
  authorizationPolicies: string[];
}

export interface IstioResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: any;
  status?: any;
}

export class ServiceMeshProvider {
  private config: ServiceMeshConfig;
  private logger: Logger;
  private kubernetesApi: any;
  private kialiClient: any;

  constructor(config: Config, logger: Logger, kubernetesApi: any) {
    const meshConfig = config.getOptionalConfig('serviceMesh');
    if (!meshConfig) {
      throw new Error('Service mesh configuration not found');
    }

    this.config = {
      istio: {
        enabled: meshConfig.getOptionalBoolean('istio.enabled') ?? true,
        clusters:
          meshConfig.getOptionalConfigArray('istio.clusters')?.map(cluster => ({
            name: cluster.getString('name'),
            url: cluster.getString('url'),
            authProvider: cluster.getString('authProvider'),
          })) || [],
      },
      kiali: {
        enabled: meshConfig.getOptionalBoolean('kiali.enabled') ?? true,
        url: meshConfig.getString('kiali.url'),
        username: meshConfig.getOptionalString('kiali.username'),
        password: meshConfig.getOptionalString('kiali.password'),
        token: meshConfig.getOptionalString('kiali.token'),
        skipTLSVerify:
          meshConfig.getOptionalBoolean('kiali.skipTLSVerify') ?? false,
      },
    };

    this.logger = logger;
    this.kubernetesApi = kubernetesApi;
    this.setupKialiClient();
  }

  private setupKialiClient() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.kiali.token) {
      headers.Authorization = `Bearer ${this.config.kiali.token}`;
    } else if (this.config.kiali.username && this.config.kiali.password) {
      const credentials = Buffer.from(
        `${this.config.kiali.username}:${this.config.kiali.password}`,
      ).toString('base64');
      headers.Authorization = `Basic ${credentials}`;
    }

    this.kialiClient = {
      baseURL: this.config.kiali.url.replace(/\/$/, ''),
      headers,
    };
  }

  async getServiceMeshTopology(
    namespace: string,
    graphType: 'workload' | 'app' | 'service' = 'workload',
    duration: string = '10m',
  ): Promise<ServiceMeshTopology> {
    try {
      // Get topology from Kiali
      const kialiTopology = await this.getKialiTopology(
        namespace,
        graphType,
        duration,
      );

      // Get Istio resources
      const istioResources = await this.getIstioResources(namespace);

      // Merge data and create unified topology
      const topology = this.mergeTopologyData(kialiTopology, istioResources);

      return topology;
    } catch (error) {
      this.logger.error('Failed to get service mesh topology', error);
      throw error;
    }
  }

  private async getKialiTopology(
    namespace: string,
    graphType: string,
    duration: string,
  ): Promise<any> {
    try {
      const params = new URLSearchParams({
        namespaces: namespace,
        graphType,
        duration,
        pi: '10000',
        layout: 'dagre',
      });

      const response = await fetch(
        `${this.kialiClient.baseURL}/api/namespaces/graph?${params}`,
        { headers: this.kialiClient.headers },
      );

      if (!response.ok) {
        throw new Error(`Kiali API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.warn(
        'Failed to get Kiali topology, falling back to Kubernetes data',
        error,
      );
      return { elements: { nodes: [], edges: [] } };
    }
  }

  async getIstioResources(namespace: string): Promise<{
    virtualServices: IstioResource[];
    destinationRules: IstioResource[];
    gateways: IstioResource[];
    serviceEntries: IstioResource[];
    authorizationPolicies: IstioResource[];
    peerAuthentications: IstioResource[];
    requestAuthentications: IstioResource[];
  }> {
    const resources = {
      virtualServices: [],
      destinationRules: [],
      gateways: [],
      serviceEntries: [],
      authorizationPolicies: [],
      peerAuthentications: [],
      requestAuthentications: [],
    };

    try {
      const [
        virtualServices,
        destinationRules,
        gateways,
        serviceEntries,
        authorizationPolicies,
        peerAuthentications,
        requestAuthentications,
      ] = await Promise.allSettled([
        this.getIstioResourcesByType(
          'networking.istio.io',
          'v1beta1',
          'virtualservices',
          namespace,
        ),
        this.getIstioResourcesByType(
          'networking.istio.io',
          'v1beta1',
          'destinationrules',
          namespace,
        ),
        this.getIstioResourcesByType(
          'networking.istio.io',
          'v1beta1',
          'gateways',
          namespace,
        ),
        this.getIstioResourcesByType(
          'networking.istio.io',
          'v1beta1',
          'serviceentries',
          namespace,
        ),
        this.getIstioResourcesByType(
          'security.istio.io',
          'v1beta1',
          'authorizationpolicies',
          namespace,
        ),
        this.getIstioResourcesByType(
          'security.istio.io',
          'v1beta1',
          'peerauthentications',
          namespace,
        ),
        this.getIstioResourcesByType(
          'security.istio.io',
          'v1beta1',
          'requestauthentications',
          namespace,
        ),
      ]);

      if (virtualServices.status === 'fulfilled')
        resources.virtualServices = virtualServices.value;
      if (destinationRules.status === 'fulfilled')
        resources.destinationRules = destinationRules.value;
      if (gateways.status === 'fulfilled') resources.gateways = gateways.value;
      if (serviceEntries.status === 'fulfilled')
        resources.serviceEntries = serviceEntries.value;
      if (authorizationPolicies.status === 'fulfilled')
        resources.authorizationPolicies = authorizationPolicies.value;
      if (peerAuthentications.status === 'fulfilled')
        resources.peerAuthentications = peerAuthentications.value;
      if (requestAuthentications.status === 'fulfilled')
        resources.requestAuthentications = requestAuthentications.value;
    } catch (error) {
      this.logger.error('Failed to get Istio resources', error);
    }

    return resources;
  }

  private async getIstioResourcesByType(
    group: string,
    version: string,
    plural: string,
    namespace: string,
  ): Promise<IstioResource[]> {
    try {
      const response = await this.kubernetesApi.listNamespacedCustomObject(
        group,
        version,
        namespace,
        plural,
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.warn(
        `Failed to fetch ${plural} in namespace ${namespace}`,
        error,
      );
      return [];
    }
  }

  private mergeTopologyData(
    kialiData: any,
    istioResources: any,
  ): ServiceMeshTopology {
    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];
    const namespaces = new Set<string>();

    // Process Kiali nodes
    if (kialiData.elements?.nodes) {
      kialiData.elements.nodes.forEach((node: any) => {
        namespaces.add(node.data.namespace);
        nodes.push({
          id: node.data.id,
          nodeType: node.data.nodeType,
          namespace: node.data.namespace,
          name:
            node.data.workload ||
            node.data.app ||
            node.data.service ||
            node.data.id,
          version: node.data.version,
          labels: node.data.labels,
          health: this.normalizeHealth(node.data.healthData),
          traffic: node.data.traffic,
          istioSidecar: node.data.istioSidecar,
        });
      });
    }

    // Process Kiali edges
    if (kialiData.elements?.edges) {
      kialiData.elements.edges.forEach((edge: any) => {
        edges.push({
          id: edge.data.id,
          source: edge.data.source,
          target: edge.data.target,
          traffic: edge.data.traffic,
          protocol: edge.data.protocol,
          responseTime: edge.data.responseTime,
          security: this.extractSecurityInfo(edge.data),
        });
      });
    }

    // Add security information from Istio resources
    this.enrichWithSecurityPolicies(nodes, edges, istioResources);

    return {
      nodes,
      edges,
      namespaces: Array.from(namespaces),
      summary: {
        services: nodes.filter(n => n.nodeType === 'service').length,
        workloads: nodes.filter(n => n.nodeType === 'workload').length,
        applications: nodes.filter(n => n.nodeType === 'app').length,
        edges: edges.length,
      },
    };
  }

  private normalizeHealth(healthData: any): HealthStatus {
    if (!healthData) {
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

    return {
      status: healthData.status || 'NA',
      requests: {
        inbound: healthData.requests?.inbound || { http: {}, tcp: {} },
        outbound: healthData.requests?.outbound || { http: {}, tcp: {} },
      },
    };
  }

  private extractSecurityInfo(edgeData: any): SecurityInfo {
    return {
      mtls: {
        enabled: edgeData.isMTLS || false,
        status: edgeData.isMTLS ? 'STRICT' : 'DISABLED',
      },
      authorizationPolicies: [],
    };
  }

  private enrichWithSecurityPolicies(
    nodes: TopologyNode[],
    edges: TopologyEdge[],
    istioResources: any,
  ) {
    // Enrich nodes and edges with authorization policies and authentication settings
    istioResources.authorizationPolicies?.forEach((policy: any) => {
      const targetNodes = nodes.filter(node =>
        this.policyAppliesToNode(policy, node),
      );

      targetNodes.forEach(node => {
        if (!node.labels) node.labels = {};
        node.labels['security.istio.io/authz-policy'] = policy.metadata.name;
      });
    });

    istioResources.peerAuthentications?.forEach((auth: any) => {
      const targetNodes = nodes.filter(node =>
        this.policyAppliesToNode(auth, node),
      );

      targetNodes.forEach(node => {
        if (!node.labels) node.labels = {};
        node.labels['security.istio.io/peer-auth'] =
          auth.spec.mtls?.mode || 'STRICT';
      });
    });
  }

  private policyAppliesToNode(policy: any, node: TopologyNode): boolean {
    // Check if policy applies to the node based on selector and namespace
    if (policy.metadata.namespace !== node.namespace) {
      return false;
    }

    if (!policy.spec.selector) {
      // Applies to all workloads in namespace
      return true;
    }

    // Check label selector
    const selector = policy.spec.selector.matchLabels;
    if (selector && node.labels) {
      return Object.entries(selector).every(
        ([key, value]) => node.labels![key] === value,
      );
    }

    return false;
  }

  async getServiceMeshHealth(namespace: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.kialiClient.baseURL}/api/namespaces/${namespace}/health`,
        { headers: this.kialiClient.headers },
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      this.logger.error('Failed to get service mesh health from Kiali', error);
    }

    return null;
  }

  async getServiceMeshMetrics(
    namespace: string,
    service: string,
    metricType: string = 'request_count',
    duration: string = '10m',
  ): Promise<any> {
    try {
      const params = new URLSearchParams({
        filters: '[]',
        quantiles: '[]',
        step: '60',
        rateInterval: '1m',
        direction: 'inbound',
        reporter: 'destination',
      });

      const response = await fetch(
        `${this.kialiClient.baseURL}/api/namespaces/${namespace}/services/${service}/metrics/${metricType}?${params}`,
        { headers: this.kialiClient.headers },
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      this.logger.error('Failed to get service mesh metrics', error);
    }

    return null;
  }

  async getDistributedTraces(
    namespace: string,
    service: string,
    limit: number = 100,
  ): Promise<any> {
    try {
      const params = new URLSearchParams({
        service: `${service}.${namespace}`,
        limit: limit.toString(),
        lookback: '1h',
      });

      const response = await fetch(
        `${this.kialiClient.baseURL}/api/traces?${params}`,
        { headers: this.kialiClient.headers },
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      this.logger.error('Failed to get distributed traces', error);
    }

    return null;
  }

  async validateIstioConfiguration(namespace: string): Promise<{
    valid: boolean;
    issues: Array<{
      severity: 'error' | 'warning' | 'info';
      message: string;
      resource?: string;
    }>;
  }> {
    const issues: Array<{
      severity: 'error' | 'warning' | 'info';
      message: string;
      resource?: string;
    }> = [];

    try {
      const istioResources = await this.getIstioResources(namespace);

      // Check for common configuration issues

      // 1. Virtual Services without matching Destination Rules
      istioResources.virtualServices.forEach(vs => {
        const hosts =
          vs.spec.http
            ?.flatMap((rule: any) =>
              rule.route?.map((route: any) => route.destination?.host),
            )
            .filter(Boolean) || [];

        hosts.forEach(host => {
          const hasDestinationRule = istioResources.destinationRules.some(
            dr => dr.spec.host === host,
          );

          if (!hasDestinationRule) {
            issues.push({
              severity: 'warning',
              message: `Virtual Service ${vs.metadata.name} references host ${host} without a corresponding Destination Rule`,
              resource: `VirtualService/${vs.metadata.name}`,
            });
          }
        });
      });

      // 2. Destination Rules with subset definitions but no version labels
      istioResources.destinationRules.forEach(dr => {
        if (dr.spec.subsets?.length > 0) {
          dr.spec.subsets.forEach((subset: any) => {
            if (!subset.labels?.version) {
              issues.push({
                severity: 'warning',
                message: `Destination Rule ${dr.metadata.name} subset ${subset.name} should have version labels`,
                resource: `DestinationRule/${dr.metadata.name}`,
              });
            }
          });
        }
      });

      // 3. Missing sidecar injection
      const pods = await this.getPodsInNamespace(namespace);
      pods.forEach(pod => {
        const hasIstioSidecar = pod.spec.containers?.some(
          (container: any) => container.name === 'istio-proxy',
        );

        if (!hasIstioSidecar && pod.metadata.labels?.['app']) {
          issues.push({
            severity: 'info',
            message: `Pod ${pod.metadata.name} does not have Istio sidecar injection`,
            resource: `Pod/${pod.metadata.name}`,
          });
        }
      });
    } catch (error) {
      issues.push({
        severity: 'error',
        message: `Failed to validate Istio configuration: ${error.message}`,
      });
    }

    return {
      valid: !issues.some(issue => issue.severity === 'error'),
      issues,
    };
  }

  private async getPodsInNamespace(namespace: string): Promise<any[]> {
    try {
      const response = await this.kubernetesApi.listNamespacedPod(namespace);
      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get pods', error);
      return [];
    }
  }
}
```

### 3. Create Service Mesh Backend Plugin

Create `packages/backend/src/plugins/serviceMesh.ts`:

```typescript
import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { ServiceMeshProvider } from './serviceMesh/serviceMeshProvider';

export const serviceMeshPlugin = createBackendPlugin({
  pluginId: 'service-mesh',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        auth: coreServices.auth,
      },
      async init({ httpRouter, logger, config, auth }) {
        const serviceMeshProvider = new ServiceMeshProvider(
          config,
          logger,
          kubernetesApi,
        );
        const router = Router();

        // Get service mesh topology
        router.get('/topology/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const { graphType = 'workload', duration = '10m' } = req.query;

            const topology = await serviceMeshProvider.getServiceMeshTopology(
              namespace,
              graphType as any,
              duration as string,
            );

            res.json(topology);
          } catch (error) {
            logger.error('Failed to get service mesh topology', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get Istio resources
        router.get('/istio/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const istioResources = await serviceMeshProvider.getIstioResources(
              namespace,
            );
            res.json(istioResources);
          } catch (error) {
            logger.error('Failed to get Istio resources', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get service mesh health
        router.get('/health/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const health = await serviceMeshProvider.getServiceMeshHealth(
              namespace,
            );
            res.json(health);
          } catch (error) {
            logger.error('Failed to get service mesh health', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get service mesh metrics
        router.get('/metrics/:namespace/:service', async (req, res) => {
          try {
            const { namespace, service } = req.params;
            const { metricType = 'request_count', duration = '10m' } =
              req.query;

            const metrics = await serviceMeshProvider.getServiceMeshMetrics(
              namespace,
              service,
              metricType as string,
              duration as string,
            );

            res.json(metrics);
          } catch (error) {
            logger.error('Failed to get service mesh metrics', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get distributed traces
        router.get('/traces/:namespace/:service', async (req, res) => {
          try {
            const { namespace, service } = req.params;
            const { limit = 100 } = req.query;

            const traces = await serviceMeshProvider.getDistributedTraces(
              namespace,
              service,
              parseInt(limit as string, 10),
            );

            res.json(traces);
          } catch (error) {
            logger.error('Failed to get distributed traces', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Validate Istio configuration
        router.get('/validate/:namespace', async (req, res) => {
          try {
            const { namespace } = req.params;
            const validation =
              await serviceMeshProvider.validateIstioConfiguration(namespace);
            res.json(validation);
          } catch (error) {
            logger.error('Failed to validate Istio configuration', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Health check
        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/service-mesh', router);
      },
    });
  },
});
```

### 4. Create Unified Service Mesh Dashboard

Create `packages/app/src/components/serviceMesh/ServiceMeshPage.tsx`:

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
  StatusOK,
  StatusError,
  StatusWarning,
  StatusPending,
} from '@backstage/core-components';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Tab,
  Tabs,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Timeline,
  Security,
  Traffic,
  Visibility,
  ExpandMore,
  CheckCircle,
  Error,
  Warning,
  Info,
} from '@material-ui/icons';

const useStyles = makeStyles(theme => ({
  topologyContainer: {
    height: 500,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    overflow: 'hidden',
    position: 'relative',
  },
  metricCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  healthStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  validationIssue: {
    marginBottom: theme.spacing(1),
  },
  issueIcon: {
    marginRight: theme.spacing(1),
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
      id={`servicemesh-tabpanel-${index}`}
      aria-labelledby={`servicemesh-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

export const ServiceMeshPage = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const [topology, setTopology] = useState<any>(null);
  const [istioResources, setIstioResources] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [traces, setTraces] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const namespace = entity.metadata.namespace || 'default';
  const serviceName = entity.metadata.name;
  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchServiceMeshData();
  }, [namespace, serviceName]);

  const fetchServiceMeshData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        topologyResponse,
        istioResponse,
        healthResponse,
        metricsResponse,
        tracesResponse,
        validationResponse,
      ] = await Promise.allSettled([
        fetch(
          `${backendUrl}/api/service-mesh/topology/${namespace}?graphType=workload&duration=10m`,
        ),
        fetch(`${backendUrl}/api/service-mesh/istio/${namespace}`),
        fetch(`${backendUrl}/api/service-mesh/health/${namespace}`),
        fetch(
          `${backendUrl}/api/service-mesh/metrics/${namespace}/${serviceName}?metricType=request_count&duration=10m`,
        ),
        fetch(
          `${backendUrl}/api/service-mesh/traces/${namespace}/${serviceName}?limit=50`,
        ),
        fetch(`${backendUrl}/api/service-mesh/validate/${namespace}`),
      ]);

      if (
        topologyResponse.status === 'fulfilled' &&
        topologyResponse.value.ok
      ) {
        setTopology(await topologyResponse.value.json());
      }

      if (istioResponse.status === 'fulfilled' && istioResponse.value.ok) {
        setIstioResources(await istioResponse.value.json());
      }

      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        setHealth(await healthResponse.value.json());
      }

      if (metricsResponse.status === 'fulfilled' && metricsResponse.value.ok) {
        setMetrics(await metricsResponse.value.json());
      }

      if (tracesResponse.status === 'fulfilled' && tracesResponse.value.ok) {
        setTraces(await tracesResponse.value.json());
      }

      if (
        validationResponse.status === 'fulfilled' &&
        validationResponse.value.ok
      ) {
        setValidation(await validationResponse.value.json());
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
        return <StatusOK />;
      case 'UNHEALTHY':
      case 'FAILURE':
        return <StatusError />;
      case 'DEGRADED':
        return <StatusWarning />;
      default:
        return <StatusPending />;
    }
  };

  const getValidationIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <Error color="error" className={classes.issueIcon} />;
      case 'warning':
        return <Warning color="secondary" className={classes.issueIcon} />;
      default:
        return <Info color="primary" className={classes.issueIcon} />;
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Service Mesh" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Service Mesh" />
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
          title="Service Mesh"
          subtitle={`${serviceName} in ${namespace}`}
        >
          <SupportButton>
            Monitor and manage Istio service mesh with Kiali observability.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="Service Mesh Dashboard">
            <Typography variant="body1">
              Comprehensive service mesh observability with Istio and Kiali
            </Typography>
          </ContentHeader>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Overview" />
              <Tab label="Topology" />
              <Tab label="Istio Resources" />
              <Tab label="Health & Metrics" />
              <Tab label="Distributed Tracing" />
              <Tab label="Configuration Validation" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <ServiceMeshOverview
              topology={topology}
              istioResources={istioResources}
              health={health}
              validation={validation}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <ServiceMeshTopology topology={topology} classes={classes} />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <IstioResourcesPanel istioResources={istioResources} />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <HealthAndMetricsPanel
              health={health}
              metrics={metrics}
              getHealthIcon={getHealthIcon}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <DistributedTracingPanel traces={traces} />
          </TabPanel>

          <TabPanel value={tabValue} index={5}>
            <ConfigurationValidationPanel
              validation={validation}
              getValidationIcon={getValidationIcon}
              classes={classes}
            />
          </TabPanel>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};

const ServiceMeshOverview = ({
  topology,
  istioResources,
  health,
  validation,
}: any) => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={3}>
      <Card>
        <CardContent>
          <Timeline color="primary" style={{ fontSize: 40, marginBottom: 8 }} />
          <Typography variant="h6" gutterBottom>
            Services
          </Typography>
          <Typography variant="h4">
            {topology?.summary?.services || 0}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Services in mesh
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card>
        <CardContent>
          <Traffic color="primary" style={{ fontSize: 40, marginBottom: 8 }} />
          <Typography variant="h6" gutterBottom>
            Workloads
          </Typography>
          <Typography variant="h4">
            {topology?.summary?.workloads || 0}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Workloads in mesh
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card>
        <CardContent>
          <Security color="primary" style={{ fontSize: 40, marginBottom: 8 }} />
          <Typography variant="h6" gutterBottom>
            Security Policies
          </Typography>
          <Typography variant="h4">
            {(istioResources?.authorizationPolicies?.length || 0) +
              (istioResources?.peerAuthentications?.length || 0)}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Active security policies
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card>
        <CardContent>
          <Visibility
            color="primary"
            style={{ fontSize: 40, marginBottom: 8 }}
          />
          <Typography variant="h6" gutterBottom>
            Configuration
          </Typography>
          <Typography
            variant="h4"
            color={validation?.valid ? 'primary' : 'error'}
          >
            {validation?.valid ? 'Valid' : 'Issues'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {validation?.issues?.length || 0} issues found
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const ServiceMeshTopology = ({ topology, classes }: any) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Service Mesh Topology
      </Typography>
      <Box className={classes.topologyContainer}>
        {topology?.nodes?.length ? (
          <>
            <Typography variant="body2" gutterBottom>
              Nodes: {topology.nodes.length}, Edges:{' '}
              {topology.edges?.length || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Interactive service mesh topology visualization would be rendered
              here using D3.js or Cytoscape.js
            </Typography>
            {/* Topology visualization would be implemented here */}
            <Box mt={2}>
              <Typography variant="subtitle2">Services:</Typography>
              {topology.nodes.slice(0, 10).map((node: any, index: number) => (
                <Chip
                  key={index}
                  label={`${node.nodeType}: ${node.name}`}
                  size="small"
                  style={{ margin: 2 }}
                  color={node.istioSidecar ? 'primary' : 'default'}
                />
              ))}
            </Box>
          </>
        ) : (
          <Typography color="textSecondary">
            No topology data available
          </Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

const IstioResourcesPanel = ({ istioResources }: any) => (
  <Grid container spacing={2}>
    {Object.entries(istioResources || {}).map(
      ([resourceType, resources]: [string, any]) => (
        <Grid item xs={12} md={6} key={resourceType}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">
                {resourceType
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())}{' '}
                ({(resources as any[]).length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {(resources as any[]).map((resource: any, index: number) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={resource.metadata.name}
                      secondary={`Created: ${new Date(
                        resource.metadata.creationTimestamp,
                      ).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>
      ),
    )}
  </Grid>
);

const HealthAndMetricsPanel = ({
  health,
  metrics,
  getHealthIcon,
  classes,
}: any) => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={6}>
      <Card className={classes.metricCard}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Service Health
          </Typography>
          {health ? (
            <Box>
              {Object.entries(health).map(
                ([serviceName, serviceHealth]: [string, any]) => (
                  <Box
                    key={serviceName}
                    className={classes.healthStatus}
                    mb={1}
                  >
                    {getHealthIcon(serviceHealth.status)}
                    <Typography variant="body1">{serviceName}</Typography>
                    <Chip
                      size="small"
                      label={serviceHealth.status}
                      color={
                        serviceHealth.status === 'HEALTHY'
                          ? 'primary'
                          : 'default'
                      }
                    />
                  </Box>
                ),
              )}
            </Box>
          ) : (
            <Typography color="textSecondary">
              No health data available
            </Typography>
          )}
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={6}>
      <Card className={classes.metricCard}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Traffic Metrics
          </Typography>
          {metrics ? (
            <Box>
              <Typography variant="body2">
                Request Rate: {metrics.requestRate || 'N/A'}
              </Typography>
              <Typography variant="body2">
                Success Rate: {metrics.successRate || 'N/A'}
              </Typography>
              <Typography variant="body2">
                Response Time: {metrics.responseTime || 'N/A'}
              </Typography>
            </Box>
          ) : (
            <Typography color="textSecondary">
              No metrics data available
            </Typography>
          )}
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const DistributedTracingPanel = ({ traces }: any) => (
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

const ConfigurationValidationPanel = ({
  validation,
  getValidationIcon,
  classes,
}: any) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Configuration Validation
        {validation?.valid ? (
          <Chip
            label="Valid"
            color="primary"
            size="small"
            style={{ marginLeft: 8 }}
          />
        ) : (
          <Chip
            label="Issues Found"
            color="secondary"
            size="small"
            style={{ marginLeft: 8 }}
          />
        )}
      </Typography>

      {validation?.issues?.length ? (
        <List>
          {validation.issues.map((issue: any, index: number) => (
            <ListItem key={index} className={classes.validationIssue}>
              <ListItemIcon>{getValidationIcon(issue.severity)}</ListItemIcon>
              <ListItemText
                primary={issue.message}
                secondary={issue.resource}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography color="textSecondary">
          {validation
            ? 'No configuration issues found'
            : 'Validation data not available'}
        </Typography>
      )}
    </CardContent>
  </Card>
);
```

### 5. Register Service Mesh Plugin

Update `packages/backend/src/index.ts`:

```typescript
import { serviceMeshPlugin } from './plugins/serviceMesh';

// Add Service Mesh plugin
backend.add(serviceMeshPlugin);
```

### 6. Add Service Mesh Tab to Entity Page

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import { ServiceMeshPage } from '../serviceMesh/ServiceMeshPage';

// In the service entity case
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {/* Existing overview content */}
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/service-mesh" title="Service Mesh">
      <ServiceMeshPage />
    </EntityLayout.Route>

    {/* Other existing routes */}
  </EntityLayout>
);
```

### 7. Configure Service Mesh in app-config.yaml

```yaml
serviceMesh:
  istio:
    enabled: true
    clusters:
      - name: production
        url: ${K8S_CLUSTER_URL}
        authProvider: serviceAccount
        serviceAccountToken: ${K8S_SERVICE_ACCOUNT_TOKEN}

  kiali:
    enabled: true
    url: ${KIALI_URL}
    token: ${KIALI_TOKEN}
    # Alternative: username/password auth
    # username: ${KIALI_USERNAME}
    # password: ${KIALI_PASSWORD}
    skipTLSVerify: false

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
          customResources:
            # Istio CRDs
            - group: 'networking.istio.io'
              apiVersion: 'v1beta1'
              plural: 'virtualservices'
            - group: 'networking.istio.io'
              apiVersion: 'v1beta1'
              plural: 'destinationrules'
            - group: 'networking.istio.io'
              apiVersion: 'v1beta1'
              plural: 'gateways'
            - group: 'networking.istio.io'
              apiVersion: 'v1beta1'
              plural: 'serviceentries'
            - group: 'security.istio.io'
              apiVersion: 'v1beta1'
              plural: 'authorizationpolicies'
            - group: 'security.istio.io'
              apiVersion: 'v1beta1'
              plural: 'peerauthentications'
            - group: 'security.istio.io'
              apiVersion: 'v1beta1'
              plural: 'requestauthentications'
```

## Environment Variables Required

```bash
# Kubernetes Configuration
K8S_CLUSTER_URL=https://kubernetes.default.svc
K8S_SERVICE_ACCOUNT_TOKEN=<service-account-token>

# Kiali Configuration
KIALI_URL=https://kiali.idp-platform.local
KIALI_TOKEN=<kiali-service-account-token>

# Alternative: Username/Password auth
# KIALI_USERNAME=<kiali-username>
# KIALI_PASSWORD=<kiali-password>
```

### 8. Entity Annotations for Service Mesh

```yaml
# In catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    # Existing annotations
    backstage.io/kubernetes-id: my-service

    # Service mesh annotations
    istio.io/virtual-service: my-service-vs
    istio.io/destination-rule: my-service-dr
    istio.io/gateway: my-service-gateway

    # Kiali annotations
    kiali.io/namespace: production
    kiali.io/app-label: my-service

    # Security annotations
    istio.io/authorization-policy: my-service-authz
    istio.io/peer-authentication: my-service-peer-auth
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

## Expected Outcomes

### ✅ **Unified Service Mesh Management**

- Complete Istio resource visibility and management
- Real-time Kiali observability integration
- Service mesh topology visualization

### ✅ **Advanced Traffic Analysis**

- Request flow visualization
- Performance metrics and SLI tracking
- Distributed tracing integration

### ✅ **Security and Compliance**

- mTLS configuration monitoring
- Authorization policy validation
- Security configuration recommendations

### ✅ **Configuration Validation**

- Automated Istio configuration checking
- Best practices enforcement
- Issue detection and remediation guidance

## Troubleshooting

### Common Issues

1. **Kiali API Connection Issues**

   - Verify Kiali URL and authentication
   - Check network connectivity
   - Ensure RBAC permissions

2. **Missing Istio Resources**

   - Confirm Istio is installed and CRDs available
   - Verify sidecar injection is enabled
   - Check namespace and resource permissions

3. **Topology Visualization Issues**
   - Ensure services have proper Istio annotations
   - Verify traffic is flowing between services
   - Check Kiali configuration and data sources

### Debug Commands

```bash
# Check Istio installation
kubectl get pods -n istio-system

# Verify Kiali connectivity
kubectl get pods -n istio-system -l app=kiali

# Check sidecar injection
kubectl get namespace -L istio-injection

# List Istio resources
kubectl get virtualservices,destinationrules,gateways -A

# Test Kiali API
curl -H "Authorization: Bearer <token>" https://kiali.example.com/api/namespaces
```

## Next Steps

1. **Deploy Istio and Kiali**: Ensure both are properly installed and configured
2. **Configure Authentication**: Set up proper RBAC and API access
3. **Enable Sidecar Injection**: Configure automatic sidecar injection for applications
4. **Test Integration**: Verify service mesh data appears correctly in Backstage
5. **Team Training**: Onboard team on service mesh observability features

---

**Dependencies**: Istio service mesh, Kiali, Kubernetes RBAC  
**Estimated Effort**: 6-7 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
