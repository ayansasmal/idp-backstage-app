import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import * as k8s from '@kubernetes/client-node';
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

export interface WorkflowTemplateResource {
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
  private logger: LoggerService;
  private kubernetesApi: k8s.CustomObjectsApi;
  private httpClient: any;

  constructor(config: Config, logger: LoggerService) {
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
    this.setupKubernetesClient();
    this.setupHttpClient();
  }

  private setupKubernetesClient() {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.kubernetesApi = kc.makeApiClient(k8s.CustomObjectsApi);
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

      const response = await this.kubernetesApi.listNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'workflows',
      });

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get workflows', error);
      throw error;
    }
  }

  async getWorkflowTemplates(namespace?: string): Promise<WorkflowTemplateResource[]> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      const response = await this.kubernetesApi.listNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'workflowtemplates',
      });

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get workflow templates', error);
      return [];
    }
  }

  async getClusterWorkflowTemplates(): Promise<WorkflowTemplateResource[]> {
    try {
      const response = await this.kubernetesApi.listClusterCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        plural: 'clusterworkflowtemplates',
      });

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

      const response = await this.kubernetesApi.getNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'workflows',
        name: name,
      });

      return response.body as Workflow;
    } catch (error) {
      this.logger.error(`Failed to get workflow ${name}`, error);
      return null;
    }
  }

  async createWorkflow(workflow: any, namespace?: string): Promise<Workflow> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      const response = await this.kubernetesApi.createNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'workflows',
        body: workflow,
      });

      return response.body as Workflow;
    } catch (error) {
      this.logger.error('Failed to create workflow', error);
      throw error;
    }
  }

  async deleteWorkflow(name: string, namespace?: string): Promise<void> {
    try {
      const targetNamespace = namespace || this.config.namespace;

      await this.kubernetesApi.deleteNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'workflows',
        name: name,
      });
    } catch (error) {
      this.logger.error(`Failed to delete workflow ${name}`, error);
      throw error;
    }
  }

  async retryWorkflow(name: string, namespace?: string): Promise<Workflow> {
    try {
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
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        const coreApi = kc.makeApiClient(k8s.CoreV1Api);
        
        const response = await coreApi.readNamespacedPodLog({
          name: podName,
          namespace: targetNamespace,
        });
        return response.body;
      } else {
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

      const response = await this.kubernetesApi.listNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'workflows',
        labelSelector: labelSelector,
      });

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
      (status as any).duration = this.formatDuration(durationMs);
    } else if (workflow.status.startedAt) {
      const start = new Date(workflow.status.startedAt);
      const now = new Date();
      const durationMs = now.getTime() - start.getTime();
      (status as any).duration = this.formatDuration(durationMs);
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