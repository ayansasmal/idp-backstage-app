import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import * as k8s from '@kubernetes/client-node';
import fetch from 'node-fetch';

export interface WorkflowStatus {
    phase: string;
    startedAt?: string;
    finishedAt?: string;
    progress?: string;
    message?: string;
    estimatedDuration?: number;
    resourcesDuration?: {
        cpu: number;
        memory: number;
    };
}

export interface WorkflowStep {
    id: string;
    name: string;
    displayName?: string;
    type: string;
    phase: string;
    startedAt?: string;
    finishedAt?: string;
    duration?: string;
    message?: string;
    children?: string[];
    inputs?: any;
    outputs?: any;
}

export interface ArgoWorkflow {
    metadata: {
        name: string;
        namespace: string;
        uid: string;
        creationTimestamp: string;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
    };
    spec: {
        entrypoint: string;
        arguments?: any;
        templates: any[];
        serviceAccountName?: string;
        ttlStrategy?: {
            secondsAfterCompletion?: number;
            secondsAfterSuccess?: number;
            secondsAfterFailure?: number;
        };
    };
    status: WorkflowStatus;
}

export interface WorkflowTemplate {
    metadata: {
        name: string;
        namespace: string;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
    };
    spec: {
        entrypoint: string;
        arguments?: any;
        templates: any[];
        serviceAccountName?: string;
    };
}

export interface ArgoWorkflowsConfig {
    baseUrl?: string;
    token?: string;
    namespace: string;
    kubeConfig?: string;
    insecure?: boolean;
}

/**
 * Service for interacting with Argo Workflows
 */
export class ArgoWorkflowsService {
    private config: ArgoWorkflowsConfig;
    private k8sApi?: k8s.CustomObjectsApi;
    private logger: LoggerService;

    constructor(config: ArgoWorkflowsConfig, logger: LoggerService) {
        this.config = config;
        this.logger = logger;
        this.initializeKubernetesClient();
    }

    private initializeKubernetesClient(): void {
        try {
            const kc = new k8s.KubeConfig();

            if (this.config.kubeConfig) {
                kc.loadFromString(this.config.kubeConfig);
            } else {
                kc.loadFromDefault();
            }

            this.k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
            this.logger.info('Kubernetes client initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Kubernetes client', { error });
            throw error;
        }
    }

    /**
     * Get all workflows in the configured namespace
     */
    async getWorkflows(): Promise<ArgoWorkflow[]> {
        try {
            if (!this.k8sApi) {
                throw new Error('Kubernetes client not initialized');
            }

            const response = await this.k8sApi.listNamespacedCustomObject(
                'argoproj.io',
                'v1alpha1',
                this.config.namespace,
                'workflows'
            );

            const workflows = (response.body as any).items.map((item: any) =>
                this.transformWorkflow(item)
            );

            return workflows;
        } catch (error) {
            this.logger.error('Failed to get workflows', { error });
            throw error;
        }
    }

    /**
     * Get a specific workflow by name
     */
    async getWorkflow(name: string): Promise<ArgoWorkflow> {
        try {
            if (!this.k8sApi) {
                throw new Error('Kubernetes client not initialized');
            }

            const response = await this.k8sApi.getNamespacedCustomObject(
                'argoproj.io',
                'v1alpha1',
                this.config.namespace,
                'workflows',
                name
            );

            return this.transformWorkflow(response.body);
        } catch (error) {
            if (error.response?.statusCode === 404) {
                throw new NotFoundError(`Workflow ${name} not found`);
            }
            this.logger.error('Failed to get workflow', { name, error });
            throw error;
        }
    }

    /**
     * Get workflows by label selector
     */
    async getWorkflowsByLabel(labelSelector: string): Promise<ArgoWorkflow[]> {
        try {
            if (!this.k8sApi) {
                throw new Error('Kubernetes client not initialized');
            }

            const response = await this.k8sApi.listNamespacedCustomObject(
                'argoproj.io',
                'v1alpha1',
                this.config.namespace,
                'workflows',
                undefined,
                undefined,
                undefined,
                undefined,
                labelSelector
            );

            const workflows = (response.body as any).items.map((item: any) =>
                this.transformWorkflow(item)
            );

            return workflows;
        } catch (error) {
            this.logger.error('Failed to get workflows by label', { labelSelector, error });
            throw error;
        }
    }

    /**
     * Get workflow logs
     */
    async getWorkflowLogs(workflowName: string, stepName?: string): Promise<string> {
        try {
            if (this.config.baseUrl && this.config.token) {
                // Use Argo Workflows API
                return this.getLogsViaAPI(workflowName, stepName);
            } else {
                // Use Kubernetes API
                return this.getLogsViaKubernetes(workflowName, stepName);
            }
        } catch (error) {
            this.logger.error('Failed to get workflow logs', { workflowName, stepName, error });
            throw error;
        }
    }

    /**
     * Submit a new workflow from template
     */
    async submitWorkflow(templateName: string, parameters?: Record<string, any>): Promise<ArgoWorkflow> {
        try {
            if (!this.k8sApi) {
                throw new Error('Kubernetes client not initialized');
            }

            // Get the workflow template
            const templateResponse = await this.k8sApi.getNamespacedCustomObject(
                'argoproj.io',
                'v1alpha1',
                this.config.namespace,
                'workflowtemplates',
                templateName
            );

            const template = templateResponse.body as any;

            // Create workflow from template
            const workflow = {
                apiVersion: 'argoproj.io/v1alpha1',
                kind: 'Workflow',
                metadata: {
                    generateName: `${templateName}-`,
                    namespace: this.config.namespace,
                    labels: {
                        'workflows.argoproj.io/workflow-template': templateName,
                        'backstage.io/managed-by': 'backstage',
                    },
                },
                spec: {
                    ...template.spec,
                    arguments: {
                        parameters: Object.entries(parameters || {}).map(([name, value]) => ({
                            name,
                            value: String(value),
                        })),
                    },
                },
            };

            const response = await this.k8sApi.createNamespacedCustomObject(
                'argoproj.io',
                'v1alpha1',
                this.config.namespace,
                'workflows',
                workflow
            );

            return this.transformWorkflow(response.body);
        } catch (error) {
            this.logger.error('Failed to submit workflow', { templateName, parameters, error });
            throw error;
        }
    }

    /**
     * Delete a workflow
     */
    async deleteWorkflow(name: string): Promise<void> {
        try {
            if (!this.k8sApi) {
                throw new Error('Kubernetes client not initialized');
            }

            await this.k8sApi.deleteNamespacedCustomObject(
                'argoproj.io',
                'v1alpha1',
                this.config.namespace,
                'workflows',
                name
            );

            this.logger.info('Workflow deleted successfully', { name });
        } catch (error) {
            this.logger.error('Failed to delete workflow', { name, error });
            throw error;
        }
    }

    /**
     * Get workflow templates
     */
    async getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
        try {
            if (!this.k8sApi) {
                throw new Error('Kubernetes client not initialized');
            }

            const response = await this.k8sApi.listNamespacedCustomObject(
                'argoproj.io',
                'v1alpha1',
                this.config.namespace,
                'workflowtemplates'
            );

            const templates = (response.body as any).items.map((item: any) => ({
                metadata: {
                    name: item.metadata.name,
                    namespace: item.metadata.namespace,
                    labels: item.metadata.labels || {},
                    annotations: item.metadata.annotations || {},
                },
                spec: item.spec,
            }));

            return templates;
        } catch (error) {
            this.logger.error('Failed to get workflow templates', { error });
            throw error;
        }
    }

    private async getLogsViaAPI(workflowName: string, stepName?: string): Promise<string> {
        const url = `${this.config.baseUrl}/api/v1/workflows/${this.config.namespace}/${workflowName}/log`;
        const params = new URLSearchParams();
        if (stepName) {
            params.append('podName', stepName);
        }

        const response = await fetch(`${url}?${params}`, {
            headers: {
                'Authorization': `Bearer ${this.config.token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get logs: ${response.statusText}`);
        }

        return response.text();
    }

    private async getLogsViaKubernetes(workflowName: string, stepName?: string): Promise<string> {
        // Implementation for getting logs via Kubernetes API
        // This would involve finding the pods associated with the workflow
        // and getting their logs
        return `Logs for workflow ${workflowName}${stepName ? ` step ${stepName}` : ''}`;
    }

    private transformWorkflow(item: any): ArgoWorkflow {
        return {
            metadata: {
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                uid: item.metadata.uid,
                creationTimestamp: item.metadata.creationTimestamp,
                labels: item.metadata.labels || {},
                annotations: item.metadata.annotations || {},
            },
            spec: item.spec,
            status: {
                phase: item.status?.phase || 'Unknown',
                startedAt: item.status?.startedAt,
                finishedAt: item.status?.finishedAt,
                progress: item.status?.progress,
                message: item.status?.message,
                estimatedDuration: item.status?.estimatedDuration,
                resourcesDuration: item.status?.resourcesDuration,
            },
        };
    }

    /**
     * Get workflow statistics
     */
    async getWorkflowStatistics(): Promise<{
        total: number;
        running: number;
        succeeded: number;
        failed: number;
        pending: number;
    }> {
        try {
            const workflows = await this.getWorkflows();

            const stats = {
                total: workflows.length,
                running: 0,
                succeeded: 0,
                failed: 0,
                pending: 0,
            };

            for (const workflow of workflows) {
                switch (workflow.status.phase) {
                    case 'Running':
                        stats.running++;
                        break;
                    case 'Succeeded':
                        stats.succeeded++;
                        break;
                    case 'Failed':
                    case 'Error':
                        stats.failed++;
                        break;
                    case 'Pending':
                        stats.pending++;
                        break;
                }
            }

            return stats;
        } catch (error) {
            this.logger.error('Failed to get workflow statistics', { error });
            throw error;
        }
    }
}
