# Argo Workflows CI/CD Integration

**Task 02: Argo Workflows CI/CD Integration**  
**Priority:** High  
**Objective:** Integrate Argo Workflows for CI/CD pipeline visibility, workflow management, and automated deployments

## Overview

This task integrates Argo Workflows with Backstage to provide comprehensive CI/CD pipeline visibility, workflow execution monitoring, and automated deployment capabilities for all applications in the platform.

## Tasks

### 1. Install Argo Workflows Plugin Dependencies

```bash
# Install Argo Workflows related packages
yarn workspace backend add @backstage/plugin-kubernetes-backend
yarn workspace app add @backstage/plugin-kubernetes
yarn workspace backend add @kubernetes/client-node
yarn workspace backend add yaml
yarn workspace backend add axios
```

### 2. Create Argo Workflows Provider

Create `packages/backend/src/plugins/argoWorkflows/argoWorkflowsProvider.ts`:

```typescript
import { KubernetesRequestAuth } from '@backstage/plugin-kubernetes-node';
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import axios from 'axios';

export interface ArgoWorkflowsConfig {
  enabled: boolean;
  url: string;
  token?: string;
  username?: string;
  password?: string;
  namespace?: string;
}

export interface Workflow {
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    entrypoint: string;
    templates: WorkflowTemplate[];
    arguments?: {
      parameters?: Array<{
        name: string;
        value?: string;
      }>;
    };
  };
  status: {
    phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Error';
    startedAt?: string;
    finishedAt?: string;
    progress?: string;
    message?: string;
    nodes?: Record<string, WorkflowNode>;
  };
}

export interface WorkflowTemplate {
  name: string;
  container?: {
    image: string;
    command?: string[];
    args?: string[];
    env?: Array<{
      name: string;
      value: string;
    }>;
  };
  dag?: {
    tasks: Array<{
      name: string;
      template: string;
      dependencies?: string[];
    }>;
  };
  steps?: Array<
    Array<{
      name: string;
      template: string;
    }>
  >;
}

export interface WorkflowNode {
  id: string;
  name: string;
  displayName: string;
  type: string;
  templateName: string;
  phase: string;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  children?: string[];
  inputs?: {
    parameters?: Array<{
      name: string;
      value: string;
    }>;
  };
  outputs?: {
    parameters?: Array<{
      name: string;
      value: string;
    }>;
  };
}

export interface WorkflowTemplate {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: {
    entrypoint: string;
    templates: WorkflowTemplate[];
    arguments?: {
      parameters?: Array<{
        name: string;
        value?: string;
      }>;
    };
  };
}

export class ArgoWorkflowsProvider {
  private config: ArgoWorkflowsConfig;
  private logger: Logger;
  private kubernetesApi: any;
  private httpClient: any;

  constructor(config: Config, logger: Logger, kubernetesApi: any) {
    const workflowsConfig = config.getOptionalConfig('argoWorkflows');
    if (!workflowsConfig) {
      throw new Error('Argo Workflows configuration not found');
    }

    this.config = {
      enabled: workflowsConfig.getOptionalBoolean('enabled') ?? true,
      url: workflowsConfig.getString('url'),
      token: workflowsConfig.getOptionalString('token'),
      username: workflowsConfig.getOptionalString('username'),
      password: workflowsConfig.getOptionalString('password'),
      namespace: workflowsConfig.getOptionalString('namespace') ?? 'argo',
    };

    this.logger = logger;
    this.kubernetesApi = kubernetesApi;
    this.setupHttpClient();
  }

  private setupHttpClient() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }

    this.httpClient = axios.create({
      baseURL: this.config.url,
      headers,
      timeout: 30000,
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(async (config: any) => {
      if (this.config.username && this.config.password && !this.config.token) {
        // Implement basic auth or token exchange if needed
        const credentials = Buffer.from(
          `${this.config.username}:${this.config.password}`,
        ).toString('base64');
        config.headers.Authorization = `Basic ${credentials}`;
      }
      return config;
    });
  }

  async getWorkflows(namespace?: string): Promise<Workflow[]> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      // Use Kubernetes API to get workflows
      const response = await this.kubernetesApi.listNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        targetNamespace,
        'workflows',
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get workflows', error);
      throw error;
    }
  }

  async getWorkflowTemplates(namespace?: string): Promise<WorkflowTemplate[]> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      const response = await this.kubernetesApi.listNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        targetNamespace,
        'workflowtemplates',
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get workflow templates', error);
      return [];
    }
  }

  async getClusterWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    try {
      const response = await this.kubernetesApi.listClusterCustomObject(
        'argoproj.io',
        'v1alpha1',
        'clusterworkflowtemplates',
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get cluster workflow templates', error);
      return [];
    }
  }

  async getWorkflow(
    name: string,
    namespace?: string,
  ): Promise<Workflow | null> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      const response = await this.kubernetesApi.getNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        targetNamespace,
        'workflows',
        name,
      );

      return response.body as Workflow;
    } catch (error) {
      this.logger.error(`Failed to get workflow ${name}`, error);
      return null;
    }
  }

  async createWorkflow(workflow: any, namespace?: string): Promise<Workflow> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      const response = await this.kubernetesApi.createNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        targetNamespace,
        'workflows',
        workflow,
      );

      return response.body as Workflow;
    } catch (error) {
      this.logger.error('Failed to create workflow', error);
      throw error;
    }
  }

  async deleteWorkflow(name: string, namespace?: string): Promise<void> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      await this.kubernetesApi.deleteNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        targetNamespace,
        'workflows',
        name,
      );
    } catch (error) {
      this.logger.error(`Failed to delete workflow ${name}`, error);
      throw error;
    }
  }

  async retryWorkflow(name: string, namespace?: string): Promise<Workflow> {
    try {
      // Use Argo Workflows API for retry
      const response = await this.httpClient.put(
        `/api/v1/workflows/${namespace || this.config.namespace}/${name}/retry`,
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to retry workflow ${name}`, error);
      throw error;
    }
  }

  async stopWorkflow(name: string, namespace?: string): Promise<Workflow> {
    try {
      // Use Argo Workflows API for stopping
      const response = await this.httpClient.put(
        `/api/v1/workflows/${namespace || this.config.namespace}/${name}/stop`,
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to stop workflow ${name}`, error);
      throw error;
    }
  }

  async getWorkflowLogs(
    name: string,
    namespace?: string,
    podName?: string,
  ): Promise<string> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      if (podName) {
        // Get logs from specific pod
        const response = await this.kubernetesApi.readNamespacedPodLog(
          podName,
          targetNamespace,
        );
        return response.body;
      } else {
        // Use Argo Workflows API for workflow logs
        const response = await this.httpClient.get(
          `/api/v1/workflows/${targetNamespace}/${name}/log`,
        );
        return response.data;
      }
    } catch (error) {
      this.logger.error(`Failed to get workflow logs for ${name}`, error);
      return '';
    }
  }

  async submitWorkflowFromTemplate(
    templateName: string,
    parameters?: Record<string, string>,
    namespace?: string,
  ): Promise<Workflow> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      const workflowSubmission = {
        namespace: targetNamespace,
        resourceKind: 'WorkflowTemplate',
        resourceName: templateName,
        submitOptions: {
          parameters: Object.entries(parameters || {}).map(([name, value]) => ({
            name,
            value,
          })),
        },
      };

      const response = await this.httpClient.post(
        `/api/v1/workflows/${targetNamespace}/submit`,
        workflowSubmission,
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to submit workflow from template ${templateName}`,
        error,
      );
      throw error;
    }
  }

  async getWorkflowsByLabel(
    labelSelector: string,
    namespace?: string,
  ): Promise<Workflow[]> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      const response = await this.kubernetesApi.listNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        targetNamespace,
        'workflows',
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector,
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get workflows by label', error);
      return [];
    }
  }

  getWorkflowStatus(workflow: Workflow): {
    phase: string;
    duration?: string;
    progress?: string;
    message?: string;
  } {
    const status = {
      phase: workflow.status.phase,
      progress: workflow.status.progress,
      message: workflow.status.message,
    };

    if (workflow.status.startedAt && workflow.status.finishedAt) {
      const start = new Date(workflow.status.startedAt);
      const end = new Date(workflow.status.finishedAt);
      const durationMs = end.getTime() - start.getTime();
      status.duration = this.formatDuration(durationMs);
    } else if (workflow.status.startedAt) {
      const start = new Date(workflow.status.startedAt);
      const now = new Date();
      const durationMs = now.getTime() - start.getTime();
      status.duration = this.formatDuration(durationMs);
    }

    return status;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
```

### 3. Create Argo Workflows Backend Plugin

Create `packages/backend/src/plugins/argoWorkflows.ts`:

```typescript
import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { ArgoWorkflowsProvider } from './argoWorkflows/argoWorkflowsProvider';

export const argoWorkflowsPlugin = createBackendPlugin({
  pluginId: 'argo-workflows',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        auth: coreServices.auth,
      },
      async init({ httpRouter, logger, config, auth }) {
        const argoWorkflowsProvider = new ArgoWorkflowsProvider(
          config,
          logger,
          kubernetesApi,
        );
        const router = Router();

        // Get all workflows
        router.get('/workflows', async (req, res) => {
          try {
            const { namespace, labelSelector } = req.query;

            let workflows;
            if (labelSelector) {
              workflows = await argoWorkflowsProvider.getWorkflowsByLabel(
                labelSelector as string,
                namespace as string,
              );
            } else {
              workflows = await argoWorkflowsProvider.getWorkflows(
                namespace as string,
              );
            }

            res.json(workflows);
          } catch (error) {
            logger.error('Failed to get workflows', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get specific workflow
        router.get('/workflows/:namespace/:name', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const workflow = await argoWorkflowsProvider.getWorkflow(
              name,
              namespace,
            );

            if (!workflow) {
              return res.status(404).json({ error: 'Workflow not found' });
            }

            res.json(workflow);
          } catch (error) {
            logger.error('Failed to get workflow', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Create workflow
        router.post('/workflows', async (req, res) => {
          try {
            const { namespace } = req.query;
            const workflow = await argoWorkflowsProvider.createWorkflow(
              req.body,
              namespace as string,
            );
            res.status(201).json(workflow);
          } catch (error) {
            logger.error('Failed to create workflow', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Submit workflow from template
        router.post('/workflows/submit', async (req, res) => {
          try {
            const { templateName, parameters, namespace } = req.body;
            const workflow =
              await argoWorkflowsProvider.submitWorkflowFromTemplate(
                templateName,
                parameters,
                namespace,
              );
            res.status(201).json(workflow);
          } catch (error) {
            logger.error('Failed to submit workflow', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Retry workflow
        router.put('/workflows/:namespace/:name/retry', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const workflow = await argoWorkflowsProvider.retryWorkflow(
              name,
              namespace,
            );
            res.json(workflow);
          } catch (error) {
            logger.error('Failed to retry workflow', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Stop workflow
        router.put('/workflows/:namespace/:name/stop', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const workflow = await argoWorkflowsProvider.stopWorkflow(
              name,
              namespace,
            );
            res.json(workflow);
          } catch (error) {
            logger.error('Failed to stop workflow', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Delete workflow
        router.delete('/workflows/:namespace/:name', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            await argoWorkflowsProvider.deleteWorkflow(name, namespace);
            res.status(204).send();
          } catch (error) {
            logger.error('Failed to delete workflow', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get workflow logs
        router.get('/workflows/:namespace/:name/logs', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const { podName } = req.query;
            const logs = await argoWorkflowsProvider.getWorkflowLogs(
              name,
              namespace,
              podName as string,
            );
            res.json({ logs });
          } catch (error) {
            logger.error('Failed to get workflow logs', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get workflow templates
        router.get('/workflow-templates', async (req, res) => {
          try {
            const { namespace } = req.query;
            const templates = await argoWorkflowsProvider.getWorkflowTemplates(
              namespace as string,
            );
            res.json(templates);
          } catch (error) {
            logger.error('Failed to get workflow templates', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get cluster workflow templates
        router.get('/cluster-workflow-templates', async (req, res) => {
          try {
            const templates =
              await argoWorkflowsProvider.getClusterWorkflowTemplates();
            res.json(templates);
          } catch (error) {
            logger.error('Failed to get cluster workflow templates', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Health check
        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/argo-workflows', router);
      },
    });
  },
});
```

### 4. Create Frontend Argo Workflows Components

Create `packages/app/src/components/argoWorkflows/ArgoWorkflowsPage.tsx`:

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
  StatusPending,
  StatusWarning,
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { PlayArrow, Stop, Refresh, Delete, ViewList } from '@material-ui/icons';

const useStyles = makeStyles(theme => ({
  workflowCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  statusIcon: {
    marginRight: theme.spacing(1),
  },
  actionButton: {
    marginRight: theme.spacing(1),
  },
  logContainer: {
    backgroundColor: theme.palette.grey[900],
    color: theme.palette.common.white,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: 400,
    overflow: 'auto',
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
      id={`workflows-tabpanel-${index}`}
      aria-labelledby={`workflows-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

export const ArgoWorkflowsPage = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<any[]>([]);
  const [clusterTemplates, setClusterTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [workflowLogs, setWorkflowLogs] = useState<string>('');
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateParameters, setTemplateParameters] = useState<
    Record<string, string>
  >({});

  const namespace = entity.metadata.namespace || 'default';
  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchWorkflowsData();
  }, [namespace]);

  const fetchWorkflowsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [workflowsResponse, templatesResponse, clusterTemplatesResponse] =
        await Promise.allSettled([
          fetch(
            `${backendUrl}/api/argo-workflows/workflows?namespace=${namespace}`,
          ),
          fetch(
            `${backendUrl}/api/argo-workflows/workflow-templates?namespace=${namespace}`,
          ),
          fetch(`${backendUrl}/api/argo-workflows/cluster-workflow-templates`),
        ]);

      if (
        workflowsResponse.status === 'fulfilled' &&
        workflowsResponse.value.ok
      ) {
        setWorkflows(await workflowsResponse.value.json());
      }

      if (
        templatesResponse.status === 'fulfilled' &&
        templatesResponse.value.ok
      ) {
        setWorkflowTemplates(await templatesResponse.value.json());
      }

      if (
        clusterTemplatesResponse.status === 'fulfilled' &&
        clusterTemplatesResponse.value.ok
      ) {
        setClusterTemplates(await clusterTemplatesResponse.value.json());
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

  const getWorkflowStatus = (workflow: any) => {
    const phase = workflow.status?.phase;
    switch (phase) {
      case 'Succeeded':
        return <StatusOK>Succeeded</StatusOK>;
      case 'Failed':
      case 'Error':
        return <StatusError>{phase}</StatusError>;
      case 'Running':
        return <StatusWarning>Running</StatusWarning>;
      default:
        return <StatusPending>Pending</StatusPending>;
    }
  };

  const handleWorkflowAction = async (action: string, workflow: any) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/argo-workflows/workflows/${workflow.metadata.namespace}/${workflow.metadata.name}/${action}`,
        { method: 'PUT' },
      );

      if (response.ok) {
        await fetchWorkflowsData();
      }
    } catch (error) {
      console.error(`Failed to ${action} workflow:`, error);
    }
  };

  const handleDeleteWorkflow = async (workflow: any) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/argo-workflows/workflows/${workflow.metadata.namespace}/${workflow.metadata.name}`,
        { method: 'DELETE' },
      );

      if (response.ok) {
        await fetchWorkflowsData();
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  const handleViewLogs = async (workflow: any) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/argo-workflows/workflows/${workflow.metadata.namespace}/${workflow.metadata.name}/logs`,
      );

      if (response.ok) {
        const { logs } = await response.json();
        setWorkflowLogs(logs);
        setSelectedWorkflow(workflow);
        setLogsDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to get workflow logs:', error);
    }
  };

  const handleSubmitWorkflow = async () => {
    try {
      const response = await fetch(
        `${backendUrl}/api/argo-workflows/workflows/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateName: selectedTemplate,
            parameters: templateParameters,
            namespace,
          }),
        },
      );

      if (response.ok) {
        await fetchWorkflowsData();
        setSubmitDialogOpen(false);
        setSelectedTemplate('');
        setTemplateParameters({});
      }
    } catch (error) {
      console.error('Failed to submit workflow:', error);
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="CI/CD Workflows" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="CI/CD Workflows" />
        <Content>
          <Typography color="error">Error: {error}</Typography>
        </Content>
      </Page>
    );
  }

  return (
    <ErrorBoundary>
      <Page themeId="tool">
        <Header title="CI/CD Workflows" subtitle={`Namespace: ${namespace}`}>
          <SupportButton>
            Manage and monitor Argo Workflows for continuous integration and
            deployment.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="Argo Workflows Dashboard">
            <Button
              variant="contained"
              color="primary"
              onClick={() => setSubmitDialogOpen(true)}
              disabled={
                workflowTemplates.length === 0 && clusterTemplates.length === 0
              }
            >
              Submit Workflow
            </Button>
          </ContentHeader>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Active Workflows" />
              <Tab label="Workflow Templates" />
              <Tab label="Cluster Templates" />
              <Tab label="Workflow History" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <WorkflowsTable
              workflows={workflows.filter(
                w =>
                  w.status?.phase === 'Running' ||
                  w.status?.phase === 'Pending',
              )}
              getWorkflowStatus={getWorkflowStatus}
              onAction={handleWorkflowAction}
              onDelete={handleDeleteWorkflow}
              onViewLogs={handleViewLogs}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <WorkflowTemplatesTable templates={workflowTemplates} />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <WorkflowTemplatesTable templates={clusterTemplates} />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <WorkflowsTable
              workflows={workflows}
              getWorkflowStatus={getWorkflowStatus}
              onAction={handleWorkflowAction}
              onDelete={handleDeleteWorkflow}
              onViewLogs={handleViewLogs}
              classes={classes}
              showAll
            />
          </TabPanel>

          {/* Workflow Logs Dialog */}
          <Dialog
            open={logsDialogOpen}
            onClose={() => setLogsDialogOpen(false)}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              Workflow Logs - {selectedWorkflow?.metadata?.name}
            </DialogTitle>
            <DialogContent>
              <Box className={classes.logContainer}>
                <pre>{workflowLogs || 'No logs available'}</pre>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setLogsDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Submit Workflow Dialog */}
          <Dialog
            open={submitDialogOpen}
            onClose={() => setSubmitDialogOpen(false)}
          >
            <DialogTitle>Submit Workflow</DialogTitle>
            <DialogContent>
              <FormControl fullWidth margin="normal">
                <InputLabel>Template</InputLabel>
                <Select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value as string)}
                >
                  {workflowTemplates.map(template => (
                    <MenuItem
                      key={template.metadata.name}
                      value={template.metadata.name}
                    >
                      {template.metadata.name} (Namespace)
                    </MenuItem>
                  ))}
                  {clusterTemplates.map(template => (
                    <MenuItem
                      key={template.metadata.name}
                      value={template.metadata.name}
                    >
                      {template.metadata.name} (Cluster)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Template parameters would be dynamically generated here */}
              <TextField
                fullWidth
                margin="normal"
                label="Parameters (JSON)"
                multiline
                rows={4}
                value={JSON.stringify(templateParameters, null, 2)}
                onChange={e => {
                  try {
                    setTemplateParameters(JSON.parse(e.target.value));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmitWorkflow}
                color="primary"
                disabled={!selectedTemplate}
              >
                Submit
              </Button>
            </DialogActions>
          </Dialog>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};

const WorkflowsTable = ({
  workflows,
  getWorkflowStatus,
  onAction,
  onDelete,
  onViewLogs,
  classes,
  showAll = false,
}: any) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Started</TableCell>
          <TableCell>Duration</TableCell>
          <TableCell>Progress</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {workflows.map((workflow: any) => (
          <TableRow key={workflow.metadata.name}>
            <TableCell>{workflow.metadata.name}</TableCell>
            <TableCell>{getWorkflowStatus(workflow)}</TableCell>
            <TableCell>
              {workflow.status?.startedAt
                ? new Date(workflow.status.startedAt).toLocaleString()
                : 'Not started'}
            </TableCell>
            <TableCell>
              {workflow.status?.startedAt && workflow.status?.finishedAt
                ? `${Math.round(
                    (new Date(workflow.status.finishedAt).getTime() -
                      new Date(workflow.status.startedAt).getTime()) /
                      1000,
                  )}s`
                : workflow.status?.startedAt
                ? `${Math.round(
                    (Date.now() -
                      new Date(workflow.status.startedAt).getTime()) /
                      1000,
                  )}s`
                : '-'}
            </TableCell>
            <TableCell>{workflow.status?.progress || '-'}</TableCell>
            <TableCell>
              <Button
                size="small"
                className={classes.actionButton}
                onClick={() => onViewLogs(workflow)}
                startIcon={<ViewList />}
              >
                Logs
              </Button>
              {workflow.status?.phase === 'Running' && (
                <Button
                  size="small"
                  className={classes.actionButton}
                  onClick={() => onAction('stop', workflow)}
                  startIcon={<Stop />}
                >
                  Stop
                </Button>
              )}
              {(workflow.status?.phase === 'Failed' ||
                workflow.status?.phase === 'Error') && (
                <Button
                  size="small"
                  className={classes.actionButton}
                  onClick={() => onAction('retry', workflow)}
                  startIcon={<Refresh />}
                >
                  Retry
                </Button>
              )}
              <Button
                size="small"
                color="secondary"
                onClick={() => onDelete(workflow)}
                startIcon={<Delete />}
              >
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const WorkflowTemplatesTable = ({ templates }: any) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Entrypoint</TableCell>
          <TableCell>Templates</TableCell>
          <TableCell>Parameters</TableCell>
          <TableCell>Created</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {templates.map((template: any) => (
          <TableRow key={template.metadata.name}>
            <TableCell>{template.metadata.name}</TableCell>
            <TableCell>
              <Chip label={template.spec.entrypoint} size="small" />
            </TableCell>
            <TableCell>{template.spec.templates?.length || 0}</TableCell>
            <TableCell>
              {template.spec.arguments?.parameters?.length || 0}
            </TableCell>
            <TableCell>
              {template.metadata.creationTimestamp
                ? new Date(
                    template.metadata.creationTimestamp,
                  ).toLocaleDateString()
                : 'Unknown'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);
```

### 5. Register Argo Workflows Plugin

Update `packages/backend/src/index.ts`:

```typescript
import { argoWorkflowsPlugin } from './plugins/argoWorkflows';

// Add Argo Workflows plugin
backend.add(argoWorkflowsPlugin);
```

### 6. Add Argo Workflows Tab to Entity Page

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import { ArgoWorkflowsPage } from '../argoWorkflows/ArgoWorkflowsPage';

// In the service entity case
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {/* Existing overview content */}
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/ci-cd" title="CI/CD">
      <ArgoWorkflowsPage />
    </EntityLayout.Route>

    {/* Other existing routes */}
  </EntityLayout>
);
```

### 7. Configure Argo Workflows in app-config.yaml

```yaml
argoWorkflows:
  enabled: true
  url: ${ARGO_WORKFLOWS_URL}
  token: ${ARGO_WORKFLOWS_TOKEN}
  namespace: argo

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
            - group: 'argoproj.io'
              apiVersion: 'v1alpha1'
              plural: 'workflows'
            - group: 'argoproj.io'
              apiVersion: 'v1alpha1'
              plural: 'workflowtemplates'
            - group: 'argoproj.io'
              apiVersion: 'v1alpha1'
              plural: 'clusterworkflowtemplates'
```

## Environment Variables Required

```bash
# Argo Workflows Configuration
ARGO_WORKFLOWS_URL=https://argo-workflows.idp-platform.local
ARGO_WORKFLOWS_TOKEN=<argo-workflows-token>

# Kubernetes Configuration
K8S_CLUSTER_URL=https://kubernetes.default.svc
K8S_SERVICE_ACCOUNT_TOKEN=<service-account-token>
```

### 8. Entity Annotations for Workflows

```yaml
# In catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    # Existing annotations
    backstage.io/kubernetes-id: my-service

    # Argo Workflows annotations
    argoproj.io/workflow-template: my-service-ci-cd
    argoproj.io/workflow-namespace: argo

    # CI/CD pipeline annotations
    backstage.io/build-url: https://argo-workflows.idp-platform.local/workflows/argo
    backstage.io/ci-cd-integration: argo-workflows
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

## Expected Outcomes

### ✅ **CI/CD Pipeline Visibility**

- Real-time workflow execution monitoring
- Pipeline status and progress tracking
- Integration with entity pages for service-specific workflows

### ✅ **Workflow Management**

- Submit workflows from templates
- Retry failed workflows
- Stop running workflows
- View detailed logs and execution history

### ✅ **Template Management**

- Browse available workflow templates
- Cluster-wide and namespace-scoped templates
- Parameter-driven workflow submission

### ✅ **Developer Experience**

- Self-service CI/CD pipeline execution
- Integrated workflow logs and debugging
- Visual workflow status indicators

## Troubleshooting

### Common Issues

1. **Argo Workflows API Connection Issues**

   - Verify Argo Workflows server URL and authentication
   - Check network connectivity and firewall rules
   - Ensure proper RBAC permissions for workflow access

2. **Workflow Submission Failures**

   - Verify workflow template exists and is valid
   - Check parameter validation and requirements
   - Ensure namespace permissions for workflow creation

3. **Missing Workflow Data**
   - Confirm Argo Workflows CRDs are installed
   - Verify Kubernetes RBAC permissions
   - Check workflow namespace and label selectors

### Debug Commands

```bash
# Check Argo Workflows installation
kubectl get pods -n argo

# List workflows
kubectl get workflows -A

# Check workflow templates
kubectl get workflowtemplates -A

# View workflow details
kubectl describe workflow <workflow-name> -n <namespace>

# Check Argo Workflows server logs
kubectl logs -n argo deployment/argo-server
```

## Next Steps

1. **Deploy Argo Workflows**: Install Argo Workflows in your cluster
2. **Configure RBAC**: Set up proper permissions for workflow management
3. **Create Templates**: Define workflow templates for common CI/CD patterns
4. **Test Integration**: Verify workflow visibility and execution in Backstage
5. **Team Training**: Onboard developers on workflow management capabilities

---

**Dependencies**: Argo Workflows, Kubernetes RBAC  
**Estimated Effort**: 4-5 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
