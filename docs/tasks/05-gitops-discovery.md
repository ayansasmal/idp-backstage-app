# GitOps Discovery and Application Management

**Task 05: GitOps Discovery and Application Management**  
**Priority:** High  
**Objective:** Implement comprehensive GitOps application discovery and lifecycle management through ArgoCD integration

## Overview

This task establishes deep GitOps integration to automatically discover, track, and manage applications deployed through ArgoCD, providing developers with complete visibility into their application deployments, configurations, and lifecycle events.

## Tasks

### 1. Install GitOps Discovery Dependencies

```bash
# Install required packages
yarn workspace backend add @backstage/plugin-kubernetes-backend
yarn workspace app add @backstage/plugin-kubernetes
yarn workspace backend add @octokit/rest
yarn workspace backend add yaml
yarn workspace backend add git-url-parse
yarn workspace backend add simple-git
```

### 2. Create GitOps Discovery Provider

Create `packages/backend/src/plugins/gitops/gitopsProvider.ts`:

```typescript
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import { Octokit } from '@octokit/rest';
import * as gitUrlParse from 'git-url-parse';
import simpleGit from 'simple-git';
import * as yaml from 'yaml';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface GitOpsConfig {
  argocd: {
    url: string;
    token: string;
    skipTLSVerify?: boolean;
  };
  repositories: Array<{
    name: string;
    url: string;
    type: 'github' | 'gitlab' | 'bitbucket';
    token?: string;
    branch?: string;
    pathPatterns?: string[];
  }>;
  discovery: {
    enabled: boolean;
    scanInterval: number; // minutes
    excludePatterns?: string[];
    includePatterns?: string[];
  };
}

export interface GitOpsApplication {
  name: string;
  namespace: string;
  project: string;
  repository: {
    url: string;
    branch: string;
    path: string;
    revision: string;
  };
  destination: {
    cluster: string;
    namespace: string;
  };
  status: {
    sync: 'Synced' | 'OutOfSync' | 'Unknown';
    health:
      | 'Healthy'
      | 'Progressing'
      | 'Degraded'
      | 'Suspended'
      | 'Missing'
      | 'Unknown';
    phase: 'Running' | 'Pending' | 'Error' | 'Failed' | 'Succeeded';
    operationState?: ArgoOperationState;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  resources?: K8sResource[];
  syncPolicy?: SyncPolicy;
  history?: RevisionHistory[];
}

export interface ArgoOperationState {
  operation: {
    sync: {
      revision: string;
      prune: boolean;
      dryRun: boolean;
    };
  };
  phase: 'Running' | 'Succeeded' | 'Failed' | 'Error' | 'Terminating';
  message?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface K8sResource {
  group: string;
  version: string;
  kind: string;
  namespace?: string;
  name: string;
  status: 'Synced' | 'OutOfSync' | 'Unknown';
  health: 'Healthy' | 'Progressing' | 'Degraded' | 'Missing' | 'Unknown';
  hookPhase?: string;
}

export interface SyncPolicy {
  automated?: {
    prune: boolean;
    selfHeal: boolean;
    allowEmpty: boolean;
  };
  syncOptions?: string[];
  retry?: {
    limit: number;
    backoff: {
      duration: string;
      factor: number;
      maxDuration: string;
    };
  };
}

export interface RevisionHistory {
  id: number;
  revision: string;
  deployedAt: string;
  author: string;
  message: string;
  source: {
    repoURL: string;
    path: string;
    targetRevision: string;
  };
}

export interface GitOpsRepository {
  name: string;
  url: string;
  applications: DiscoveredApplication[];
  lastScanned: string;
  errors?: string[];
}

export interface DiscoveredApplication {
  name: string;
  path: string;
  type: 'helm' | 'kustomize' | 'plain-yaml' | 'jsonnet';
  values?: any;
  metadata: {
    description?: string;
    team?: string;
    environment?: string;
    version?: string;
  };
  dependencies?: string[];
  resources?: string[];
}

export class GitOpsProvider {
  private config: GitOpsConfig;
  private logger: Logger;
  private argocdClient: any;
  private githubClient?: Octokit;
  private scanInterval?: NodeJS.Timeout;

  constructor(config: Config, logger: Logger) {
    const gitopsConfig = config.getOptionalConfig('gitops');
    if (!gitopsConfig) {
      throw new Error('GitOps configuration not found');
    }

    this.config = {
      argocd: {
        url: gitopsConfig.getString('argocd.url'),
        token: gitopsConfig.getString('argocd.token'),
        skipTLSVerify:
          gitopsConfig.getOptionalBoolean('argocd.skipTLSVerify') ?? false,
      },
      repositories:
        gitopsConfig.getOptionalConfigArray('repositories')?.map(repo => ({
          name: repo.getString('name'),
          url: repo.getString('url'),
          type: repo.getString('type') as any,
          token: repo.getOptionalString('token'),
          branch: repo.getOptionalString('branch') ?? 'main',
          pathPatterns: repo.getOptionalStringArray('pathPatterns') ?? ['**/*'],
        })) || [],
      discovery: {
        enabled: gitopsConfig.getOptionalBoolean('discovery.enabled') ?? true,
        scanInterval:
          gitopsConfig.getOptionalNumber('discovery.scanInterval') ?? 30,
        excludePatterns: gitopsConfig.getOptionalStringArray(
          'discovery.excludePatterns',
        ),
        includePatterns: gitopsConfig.getOptionalStringArray(
          'discovery.includePatterns',
        ),
      },
    };

    this.logger = logger;
    this.setupClients();

    if (this.config.discovery.enabled) {
      this.startPeriodicScanning();
    }
  }

  private setupClients() {
    // Setup ArgoCD client
    this.argocdClient = {
      baseURL: this.config.argocd.url.replace(/\/$/, ''),
      headers: {
        Authorization: `Bearer ${this.config.argocd.token}`,
        'Content-Type': 'application/json',
      },
    };

    // Setup GitHub client if configured
    const githubRepo = this.config.repositories.find(
      repo => repo.type === 'github',
    );
    if (githubRepo?.token) {
      this.githubClient = new Octokit({
        auth: githubRepo.token,
      });
    }
  }

  async getApplications(filters?: {
    project?: string;
    cluster?: string;
    namespace?: string;
    labels?: Record<string, string>;
  }): Promise<GitOpsApplication[]> {
    try {
      const response = await this.makeArgoRequest('/api/v1/applications');
      const applications = response.items || [];

      return applications
        .filter((app: any) => this.matchesFilters(app, filters))
        .map((app: any) => this.normalizeApplication(app));
    } catch (error) {
      this.logger.error('Failed to get ArgoCD applications', error);
      throw error;
    }
  }

  private async makeArgoRequest(
    endpoint: string,
    options?: RequestInit,
  ): Promise<any> {
    const url = `${this.argocdClient.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.argocdClient.headers,
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `ArgoCD API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  private matchesFilters(app: any, filters?: any): boolean {
    if (!filters) return true;

    if (filters.project && app.spec.project !== filters.project) {
      return false;
    }

    if (filters.cluster && app.spec.destination.name !== filters.cluster) {
      return false;
    }

    if (
      filters.namespace &&
      app.spec.destination.namespace !== filters.namespace
    ) {
      return false;
    }

    if (filters.labels) {
      const appLabels = app.metadata.labels || {};
      for (const [key, value] of Object.entries(filters.labels)) {
        if (appLabels[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private normalizeApplication(app: any): GitOpsApplication {
    return {
      name: app.metadata.name,
      namespace: app.metadata.namespace,
      project: app.spec.project,
      repository: {
        url: app.spec.source.repoURL,
        branch: app.spec.source.targetRevision || 'HEAD',
        path: app.spec.source.path || '.',
        revision: app.status?.sync?.revision || 'unknown',
      },
      destination: {
        cluster: app.spec.destination.name || app.spec.destination.server,
        namespace: app.spec.destination.namespace,
      },
      status: {
        sync: app.status?.sync?.status || 'Unknown',
        health: app.status?.health?.status || 'Unknown',
        phase: app.status?.operationState?.phase || 'Unknown',
        operationState: app.status?.operationState,
      },
      metadata: {
        createdAt: app.metadata.creationTimestamp,
        updatedAt: app.status?.reconciledAt || app.metadata.creationTimestamp,
        labels: app.metadata.labels,
        annotations: app.metadata.annotations,
      },
      resources: this.normalizeResources(app.status?.resources || []),
      syncPolicy: app.spec.syncPolicy,
      history: this.normalizeHistory(app.status?.history || []),
    };
  }

  private normalizeResources(resources: any[]): K8sResource[] {
    return resources.map(resource => ({
      group: resource.group || '',
      version: resource.version,
      kind: resource.kind,
      namespace: resource.namespace,
      name: resource.name,
      status: resource.status || 'Unknown',
      health: resource.health?.status || 'Unknown',
      hookPhase: resource.hookPhase,
    }));
  }

  private normalizeHistory(history: any[]): RevisionHistory[] {
    return history.map(entry => ({
      id: entry.id,
      revision: entry.revision,
      deployedAt: entry.deployedAt,
      author: entry.source?.author || 'unknown',
      message: entry.source?.message || '',
      source: entry.source,
    }));
  }

  async getApplication(
    name: string,
    namespace: string = 'argocd',
  ): Promise<GitOpsApplication | null> {
    try {
      const response = await this.makeArgoRequest(
        `/api/v1/applications/${namespace}/${name}`,
      );
      return this.normalizeApplication(response);
    } catch (error) {
      this.logger.error(`Failed to get application ${name}`, error);
      return null;
    }
  }

  async syncApplication(
    name: string,
    namespace: string = 'argocd',
    options?: {
      prune?: boolean;
      dryRun?: boolean;
      revision?: string;
      resources?: string[];
    },
  ): Promise<ArgoOperationState> {
    try {
      const body = {
        prune: options?.prune ?? false,
        dryRun: options?.dryRun ?? false,
        strategy: {
          apply: {
            force: false,
          },
        },
        ...(options?.revision && { revision: options.revision }),
        ...(options?.resources && { resources: options.resources }),
      };

      const response = await this.makeArgoRequest(
        `/api/v1/applications/${namespace}/${name}/sync`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to sync application ${name}`, error);
      throw error;
    }
  }

  async refreshApplication(
    name: string,
    namespace: string = 'argocd',
  ): Promise<void> {
    try {
      await this.makeArgoRequest(`/api/v1/applications/${namespace}/${name}`, {
        method: 'GET',
        headers: {
          ...this.argocdClient.headers,
          'Argocd-Application-Refresh': 'hard',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to refresh application ${name}`, error);
      throw error;
    }
  }

  async rollbackApplication(
    name: string,
    revision: string,
    namespace: string = 'argocd',
  ): Promise<ArgoOperationState> {
    try {
      const body = {
        revision,
        prune: false,
        dryRun: false,
      };

      const response = await this.makeArgoRequest(
        `/api/v1/applications/${namespace}/${name}/rollback`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to rollback application ${name}`, error);
      throw error;
    }
  }

  async getApplicationLogs(
    name: string,
    namespace: string = 'argocd',
    options?: {
      container?: string;
      sinceSeconds?: number;
      tail?: number;
      follow?: boolean;
    },
  ): Promise<string[]> {
    try {
      const params = new URLSearchParams();
      if (options?.container) params.append('container', options.container);
      if (options?.sinceSeconds)
        params.append('sinceSeconds', options.sinceSeconds.toString());
      if (options?.tail) params.append('tailLines', options.tail.toString());
      if (options?.follow) params.append('follow', 'true');

      const response = await this.makeArgoRequest(
        `/api/v1/applications/${namespace}/${name}/logs?${params}`,
      );

      // Parse log stream response
      return response.split('\n').filter(Boolean);
    } catch (error) {
      this.logger.error(`Failed to get application logs for ${name}`, error);
      return [];
    }
  }

  async discoverApplications(): Promise<GitOpsRepository[]> {
    const repositories: GitOpsRepository[] = [];

    for (const repoConfig of this.config.repositories) {
      try {
        this.logger.info(`Scanning repository: ${repoConfig.name}`);
        const applications = await this.scanRepository(repoConfig);

        repositories.push({
          name: repoConfig.name,
          url: repoConfig.url,
          applications,
          lastScanned: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to scan repository ${repoConfig.name}`,
          error,
        );
        repositories.push({
          name: repoConfig.name,
          url: repoConfig.url,
          applications: [],
          lastScanned: new Date().toISOString(),
          errors: [error.message],
        });
      }
    }

    return repositories;
  }

  private async scanRepository(
    repoConfig: any,
  ): Promise<DiscoveredApplication[]> {
    const applications: DiscoveredApplication[] = [];
    const tempDir = path.join('/tmp', `gitops-scan-${Date.now()}`);

    try {
      // Clone repository
      const git = simpleGit();
      await git.clone(repoConfig.url, tempDir, [
        '--depth',
        '1',
        '--branch',
        repoConfig.branch,
      ]);

      // Scan for applications
      for (const pattern of repoConfig.pathPatterns) {
        const matchedPaths = await this.findApplicationPaths(tempDir, pattern);

        for (const appPath of matchedPaths) {
          const app = await this.analyzeApplication(tempDir, appPath);
          if (app) {
            applications.push(app);
          }
        }
      }
    } finally {
      // Cleanup
      await fs
        .remove(tempDir)
        .catch(err =>
          this.logger.warn(`Failed to cleanup temp directory: ${err.message}`),
        );
    }

    return applications;
  }

  private async findApplicationPaths(
    repoPath: string,
    pattern: string,
  ): Promise<string[]> {
    const glob = require('glob');
    const paths: string[] = [];

    // Look for common GitOps application indicators
    const indicators = [
      '**/Chart.yaml', // Helm charts
      '**/kustomization.yaml', // Kustomize
      '**/kustomization.yml',
      '**/values.yaml', // Helm values
      '**/deployment.yaml', // Plain Kubernetes manifests
      '**/application.yaml', // ArgoCD Applications
    ];

    for (const indicator of indicators) {
      const matches = glob.sync(path.join(repoPath, pattern, indicator), {
        ignore:
          this.config.discovery.excludePatterns?.map(p =>
            path.join(repoPath, p),
          ) || [],
      });

      paths.push(
        ...matches.map(match => path.dirname(path.relative(repoPath, match))),
      );
    }

    return [...new Set(paths)]; // Remove duplicates
  }

  private async analyzeApplication(
    repoPath: string,
    appPath: string,
  ): Promise<DiscoveredApplication | null> {
    const fullPath = path.join(repoPath, appPath);

    try {
      // Determine application type
      const type = await this.detectApplicationType(fullPath);
      if (!type) return null;

      // Extract metadata
      const metadata = await this.extractApplicationMetadata(fullPath, type);

      // Get application name
      const name = metadata.name || path.basename(appPath);

      return {
        name,
        path: appPath,
        type,
        values: metadata.values,
        metadata: {
          description: metadata.description,
          team: metadata.team,
          environment: metadata.environment,
          version: metadata.version,
        },
        dependencies: metadata.dependencies || [],
        resources: metadata.resources || [],
      };
    } catch (error) {
      this.logger.warn(`Failed to analyze application at ${appPath}`, error);
      return null;
    }
  }

  private async detectApplicationType(
    appPath: string,
  ): Promise<'helm' | 'kustomize' | 'plain-yaml' | 'jsonnet' | null> {
    if (await fs.pathExists(path.join(appPath, 'Chart.yaml'))) {
      return 'helm';
    }

    if (
      (await fs.pathExists(path.join(appPath, 'kustomization.yaml'))) ||
      (await fs.pathExists(path.join(appPath, 'kustomization.yml')))
    ) {
      return 'kustomize';
    }

    const files = await fs.readdir(appPath);
    if (files.some(file => file.endsWith('.jsonnet'))) {
      return 'jsonnet';
    }

    if (files.some(file => file.endsWith('.yaml') || file.endsWith('.yml'))) {
      return 'plain-yaml';
    }

    return null;
  }

  private async extractApplicationMetadata(
    appPath: string,
    type: string,
  ): Promise<any> {
    const metadata: any = {};

    try {
      switch (type) {
        case 'helm':
          const chartFile = path.join(appPath, 'Chart.yaml');
          if (await fs.pathExists(chartFile)) {
            const chart = yaml.parse(await fs.readFile(chartFile, 'utf8'));
            metadata.name = chart.name;
            metadata.description = chart.description;
            metadata.version = chart.version;
            metadata.dependencies =
              chart.dependencies?.map((dep: any) => dep.name) || [];
          }

          const valuesFile = path.join(appPath, 'values.yaml');
          if (await fs.pathExists(valuesFile)) {
            metadata.values = yaml.parse(await fs.readFile(valuesFile, 'utf8'));
          }
          break;

        case 'kustomize':
          const kustomizationFile = (await fs.pathExists(
            path.join(appPath, 'kustomization.yaml'),
          ))
            ? path.join(appPath, 'kustomization.yaml')
            : path.join(appPath, 'kustomization.yml');

          if (await fs.pathExists(kustomizationFile)) {
            const kustomization = yaml.parse(
              await fs.readFile(kustomizationFile, 'utf8'),
            );
            metadata.name = kustomization.namePrefix || path.basename(appPath);
            metadata.resources = kustomization.resources || [];
          }
          break;

        case 'plain-yaml':
          // Scan YAML files for metadata
          const yamlFiles = (await fs.readdir(appPath)).filter(
            file => file.endsWith('.yaml') || file.endsWith('.yml'),
          );

          for (const file of yamlFiles.slice(0, 5)) {
            // Limit to first 5 files
            const content = await fs.readFile(path.join(appPath, file), 'utf8');
            const docs = yaml.parseAllDocuments(content);

            for (const doc of docs) {
              const data = doc.toJSON();
              if (data?.metadata?.name && !metadata.name) {
                metadata.name = data.metadata.name;
              }
              if (data?.metadata?.annotations?.['backstage.io/description']) {
                metadata.description =
                  data.metadata.annotations['backstage.io/description'];
              }
            }
          }
          break;
      }

      // Look for backstage annotations
      const backstageFile = path.join(appPath, 'catalog-info.yaml');
      if (await fs.pathExists(backstageFile)) {
        const backstageConfig = yaml.parse(
          await fs.readFile(backstageFile, 'utf8'),
        );
        metadata.team = backstageConfig.spec?.owner;
        metadata.description =
          metadata.description || backstageConfig.metadata?.description;
      }
    } catch (error) {
      this.logger.warn(`Failed to extract metadata from ${appPath}`, error);
    }

    return metadata;
  }

  private startPeriodicScanning() {
    this.scanInterval = setInterval(async () => {
      try {
        this.logger.info('Starting periodic GitOps repository scan');
        await this.discoverApplications();
        this.logger.info('Completed periodic GitOps repository scan');
      } catch (error) {
        this.logger.error('Failed during periodic GitOps scan', error);
      }
    }, this.config.discovery.scanInterval * 60 * 1000); // Convert minutes to milliseconds
  }

  async getRepositoryPullRequests(repoUrl: string): Promise<any[]> {
    if (!this.githubClient) {
      return [];
    }

    try {
      const parsed = gitUrlParse(repoUrl);
      const { data } = await this.githubClient.pulls.list({
        owner: parsed.owner,
        repo: parsed.name,
        state: 'open',
        per_page: 50,
      });

      return data.map(pr => ({
        number: pr.number,
        title: pr.title,
        author: pr.user?.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        url: pr.html_url,
        branch: pr.head.ref,
        baseBranch: pr.base.ref,
        status: pr.mergeable_state,
        labels: pr.labels.map(label => label.name),
      }));
    } catch (error) {
      this.logger.error('Failed to get pull requests', error);
      return [];
    }
  }

  dispose() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
  }
}
```

### 3. Create GitOps Backend Plugin

Create `packages/backend/src/plugins/gitops.ts`:

```typescript
import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { GitOpsProvider } from './gitops/gitopsProvider';

export const gitopsPlugin = createBackendPlugin({
  pluginId: 'gitops',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        auth: coreServices.auth,
      },
      async init({ httpRouter, logger, config, auth }) {
        const gitopsProvider = new GitOpsProvider(config, logger);
        const router = Router();

        // Get all applications
        router.get('/applications', async (req, res) => {
          try {
            const { project, cluster, namespace } = req.query;
            const filters = {
              ...(project && { project: project as string }),
              ...(cluster && { cluster: cluster as string }),
              ...(namespace && { namespace: namespace as string }),
            };

            const applications = await gitopsProvider.getApplications(filters);
            res.json(applications);
          } catch (error) {
            logger.error('Failed to get applications', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get specific application
        router.get('/applications/:namespace/:name', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const application = await gitopsProvider.getApplication(
              name,
              namespace,
            );

            if (!application) {
              return res.status(404).json({ error: 'Application not found' });
            }

            res.json(application);
          } catch (error) {
            logger.error('Failed to get application', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Sync application
        router.post('/applications/:namespace/:name/sync', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const { prune, dryRun, revision, resources } = req.body;

            const operation = await gitopsProvider.syncApplication(
              name,
              namespace,
              {
                prune,
                dryRun,
                revision,
                resources,
              },
            );

            res.json(operation);
          } catch (error) {
            logger.error('Failed to sync application', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Refresh application
        router.post(
          '/applications/:namespace/:name/refresh',
          async (req, res) => {
            try {
              const { namespace, name } = req.params;
              await gitopsProvider.refreshApplication(name, namespace);
              res.json({ success: true });
            } catch (error) {
              logger.error('Failed to refresh application', error);
              res.status(500).json({ error: 'Internal server error' });
            }
          },
        );

        // Rollback application
        router.post(
          '/applications/:namespace/:name/rollback',
          async (req, res) => {
            try {
              const { namespace, name } = req.params;
              const { revision } = req.body;

              if (!revision) {
                return res.status(400).json({ error: 'Revision is required' });
              }

              const operation = await gitopsProvider.rollbackApplication(
                name,
                revision,
                namespace,
              );
              res.json(operation);
            } catch (error) {
              logger.error('Failed to rollback application', error);
              res.status(500).json({ error: 'Internal server error' });
            }
          },
        );

        // Get application logs
        router.get('/applications/:namespace/:name/logs', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const { container, sinceSeconds, tail, follow } = req.query;

            const logs = await gitopsProvider.getApplicationLogs(
              name,
              namespace,
              {
                container: container as string,
                sinceSeconds: sinceSeconds
                  ? parseInt(sinceSeconds as string, 10)
                  : undefined,
                tail: tail ? parseInt(tail as string, 10) : undefined,
                follow: follow === 'true',
              },
            );

            res.json({ logs });
          } catch (error) {
            logger.error('Failed to get application logs', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Discover applications from repositories
        router.get('/discovery/repositories', async (req, res) => {
          try {
            const repositories = await gitopsProvider.discoverApplications();
            res.json(repositories);
          } catch (error) {
            logger.error('Failed to discover applications', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get repository pull requests
        router.get(
          '/repositories/:repoName/pull-requests',
          async (req, res) => {
            try {
              const { repoName } = req.params;
              // Find repository URL by name
              const repoConfig = gitopsProvider['config'].repositories.find(
                r => r.name === repoName,
              );

              if (!repoConfig) {
                return res.status(404).json({ error: 'Repository not found' });
              }

              const pullRequests =
                await gitopsProvider.getRepositoryPullRequests(repoConfig.url);
              res.json(pullRequests);
            } catch (error) {
              logger.error('Failed to get pull requests', error);
              res.status(500).json({ error: 'Internal server error' });
            }
          },
        );

        // Health check
        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/gitops', router);
      },
    });
  },
});
```

### 4. Create GitOps Frontend Component

Create `packages/app/src/components/gitops/GitOpsPage.tsx`:

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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Sync,
  Refresh,
  History,
  CloudDownload,
  Timeline,
  Error,
  Warning,
  Info,
  CheckCircle,
  ExpandMore,
  Launch,
  Visibility,
  Code,
  PlayArrow,
  Stop,
  RestoreFromTrash,
} from '@material-ui/icons';

const useStyles = makeStyles(theme => ({
  statusCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  syncButton: {
    marginRight: theme.spacing(1),
  },
  operationDialog: {
    minWidth: 400,
  },
  logContainer: {
    backgroundColor: theme.palette.grey[900],
    color: theme.palette.common.white,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    maxHeight: 400,
    overflow: 'auto',
  },
  healthStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  resourceTable: {
    marginTop: theme.spacing(2),
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
      id={`gitops-tabpanel-${index}`}
      aria-labelledby={`gitops-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

export const GitOpsPage = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [repositories, setRepositories] = useState<any[]>([]);
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncOptions, setSyncOptions] = useState({
    prune: false,
    dryRun: false,
    revision: '',
  });

  const namespace = entity.metadata.namespace || 'default';
  const serviceName = entity.metadata.name;
  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchGitOpsData();
  }, [namespace, serviceName]);

  const fetchGitOpsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [appsResponse, reposResponse] = await Promise.allSettled([
        fetch(`${backendUrl}/api/gitops/applications?namespace=${namespace}`),
        fetch(`${backendUrl}/api/gitops/discovery/repositories`),
      ]);

      if (appsResponse.status === 'fulfilled' && appsResponse.value.ok) {
        const apps = await appsResponse.value.json();
        setApplications(apps);

        // Auto-select application that matches the entity
        const matchingApp = apps.find(
          (app: any) =>
            app.name === serviceName ||
            app.metadata.labels?.['app.kubernetes.io/name'] === serviceName,
        );
        if (matchingApp) {
          setSelectedApp(matchingApp);
        }
      }

      if (reposResponse.status === 'fulfilled' && reposResponse.value.ok) {
        setRepositories(await reposResponse.value.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicationDetails = async (
    appName: string,
    appNamespace: string,
  ) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/applications/${appNamespace}/${appName}`,
      );
      if (response.ok) {
        const app = await response.json();
        setSelectedApp(app);
      }
    } catch (error) {
      console.error('Failed to fetch application details', error);
    }
  };

  const handleSyncApplication = async () => {
    if (!selectedApp) return;

    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/applications/${selectedApp.namespace}/${selectedApp.name}/sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncOptions),
        },
      );

      if (response.ok) {
        setSyncDialogOpen(false);
        await fetchApplicationDetails(selectedApp.name, selectedApp.namespace);
      }
    } catch (error) {
      console.error('Failed to sync application', error);
    }
  };

  const handleRefreshApplication = async () => {
    if (!selectedApp) return;

    try {
      await fetch(
        `${backendUrl}/api/gitops/applications/${selectedApp.namespace}/${selectedApp.name}/refresh`,
        { method: 'POST' },
      );

      await fetchApplicationDetails(selectedApp.name, selectedApp.namespace);
    } catch (error) {
      console.error('Failed to refresh application', error);
    }
  };

  const handleRollbackApplication = async (revision: string) => {
    if (!selectedApp) return;

    try {
      const response = await fetch(
        `${backendUrl}/api/gitops/applications/${selectedApp.namespace}/${selectedApp.name}/rollback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision }),
        },
      );

      if (response.ok) {
        await fetchApplicationDetails(selectedApp.name, selectedApp.namespace);
      }
    } catch (error) {
      console.error('Failed to rollback application', error);
    }
  };

  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'synced':
      case 'healthy':
        return <StatusOK />;
      case 'outofSync':
      case 'degraded':
        return <StatusWarning />;
      case 'failed':
      case 'error':
        return <StatusError />;
      default:
        return <StatusPending />;
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="GitOps Management" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="GitOps Management" />
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
          title="GitOps Management"
          subtitle={`Managing deployments for ${serviceName}`}
        >
          <SupportButton>
            Manage ArgoCD applications and GitOps workflows.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="GitOps Dashboard">
            <Typography variant="body1">
              Comprehensive GitOps application management and deployment
              visibility
            </Typography>
          </ContentHeader>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Applications" />
              <Tab label="Application Details" />
              <Tab label="Repository Discovery" />
              <Tab label="Pull Requests" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <ApplicationsOverview
              applications={applications}
              onSelectApplication={setSelectedApp}
              selectedApp={selectedApp}
              getStatusIcon={getStatusIcon}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <ApplicationDetails
              application={selectedApp}
              onSync={() => setSyncDialogOpen(true)}
              onRefresh={handleRefreshApplication}
              onRollback={handleRollbackApplication}
              getStatusIcon={getStatusIcon}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <RepositoryDiscovery
              repositories={repositories}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <PullRequestsPanel pullRequests={pullRequests} classes={classes} />
          </TabPanel>

          {/* Sync Dialog */}
          <Dialog
            open={syncDialogOpen}
            onClose={() => setSyncDialogOpen(false)}
            className={classes.operationDialog}
          >
            <DialogTitle>Sync Application</DialogTitle>
            <DialogContent>
              <Box mt={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={syncOptions.prune}
                      onChange={e =>
                        setSyncOptions({
                          ...syncOptions,
                          prune: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Prune resources"
                />
              </Box>
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={syncOptions.dryRun}
                      onChange={e =>
                        setSyncOptions({
                          ...syncOptions,
                          dryRun: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Dry run"
                />
              </Box>
              <Box mt={2}>
                <TextField
                  fullWidth
                  label="Revision (optional)"
                  value={syncOptions.revision}
                  onChange={e =>
                    setSyncOptions({ ...syncOptions, revision: e.target.value })
                  }
                  placeholder="HEAD"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSyncApplication}
                color="primary"
                variant="contained"
              >
                Sync
              </Button>
            </DialogActions>
          </Dialog>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};

const ApplicationsOverview = ({
  applications,
  onSelectApplication,
  selectedApp,
  getStatusIcon,
  classes,
}: any) => (
  <Grid container spacing={3}>
    <Grid item xs={12}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ArgoCD Applications
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Sync Status</TableCell>
                  <TableCell>Health Status</TableCell>
                  <TableCell>Repository</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {applications.map((app: any, index: number) => (
                  <TableRow
                    key={index}
                    selected={selectedApp?.name === app.name}
                    hover
                    onClick={() => onSelectApplication(app)}
                    style={{ cursor: 'pointer' }}
                  >
                    <TableCell>{app.name}</TableCell>
                    <TableCell>{app.project}</TableCell>
                    <TableCell>
                      <Box className={classes.healthStatus}>
                        {getStatusIcon(app.status.sync)}
                        <Chip
                          size="small"
                          label={app.status.sync}
                          color={
                            app.status.sync === 'Synced' ? 'primary' : 'default'
                          }
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box className={classes.healthStatus}>
                        {getStatusIcon(app.status.health)}
                        <Chip
                          size="small"
                          label={app.status.health}
                          color={
                            app.status.health === 'Healthy'
                              ? 'primary'
                              : 'default'
                          }
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {app.repository.url
                          .split('/')
                          .pop()
                          ?.replace('.git', '')}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {app.repository.path} @ {app.repository.branch}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View in ArgoCD">
                        <IconButton size="small">
                          <Launch />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
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

const ApplicationDetails = ({
  application,
  onSync,
  onRefresh,
  onRollback,
  getStatusIcon,
  classes,
}: any) => {
  if (!application) {
    return (
      <Card>
        <CardContent>
          <Typography color="textSecondary">
            Select an application to view details
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card className={classes.statusCard}>
          <CardContent>
            <Box
              display="flex"
              justifyContent="between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">{application.name}</Typography>
              <Box>
                <Button
                  size="small"
                  className={classes.syncButton}
                  startIcon={<Sync />}
                  onClick={onSync}
                >
                  Sync
                </Button>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={onRefresh}
                >
                  Refresh
                </Button>
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Sync Status</Typography>
                <Box className={classes.healthStatus}>
                  {getStatusIcon(application.status.sync)}
                  <Typography>{application.status.sync}</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Health Status</Typography>
                <Box className={classes.healthStatus}>
                  {getStatusIcon(application.status.health)}
                  <Typography>{application.status.health}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Repository</Typography>
                <Typography variant="body2">
                  {application.repository.url}
                </Typography>
                <Typography variant="caption">
                  {application.repository.path} @{' '}
                  {application.repository.revision}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card className={classes.statusCard}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Deployment History
            </Typography>
            <List dense>
              {application.history
                ?.slice(0, 5)
                .map((entry: any, index: number) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <History />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Revision ${entry.revision.slice(0, 8)}`}
                      secondary={`${entry.author} - ${new Date(
                        entry.deployedAt,
                      ).toLocaleString()}`}
                    />
                    <Tooltip title="Rollback to this revision">
                      <IconButton
                        size="small"
                        onClick={() => onRollback(entry.revision)}
                      >
                        <RestoreFromTrash />
                      </IconButton>
                    </Tooltip>
                  </ListItem>
                ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      {application.resources && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resources
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Kind</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Namespace</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Health</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {application.resources.map(
                      (resource: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{resource.kind}</TableCell>
                          <TableCell>{resource.name}</TableCell>
                          <TableCell>{resource.namespace || '-'}</TableCell>
                          <TableCell>
                            <Chip size="small" label={resource.status} />
                          </TableCell>
                          <TableCell>
                            <Box className={classes.healthStatus}>
                              {getStatusIcon(resource.health)}
                              <Typography variant="body2">
                                {resource.health}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};

const RepositoryDiscovery = ({ repositories, classes }: any) => (
  <Grid container spacing={3}>
    {repositories.map((repo: any, index: number) => (
      <Grid item xs={12} md={6} key={index}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {repo.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Last scanned: {new Date(repo.lastScanned).toLocaleString()}
            </Typography>

            {repo.errors?.length > 0 && (
              <Box mb={2}>
                {repo.errors.map((error: string, errorIndex: number) => (
                  <Chip
                    key={errorIndex}
                    label={error}
                    color="secondary"
                    size="small"
                    icon={<Error />}
                    style={{ margin: 2 }}
                  />
                ))}
              </Box>
            )}

            <Typography variant="subtitle2" gutterBottom>
              Discovered Applications ({repo.applications.length})
            </Typography>

            {repo.applications.map((app: any, appIndex: number) => (
              <Accordion key={appIndex}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Code />
                    <Typography variant="body2">{app.name}</Typography>
                    <Chip size="small" label={app.type} />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body2">Path: {app.path}</Typography>
                    {app.metadata.description && (
                      <Typography variant="body2">
                        Description: {app.metadata.description}
                      </Typography>
                    )}
                    {app.metadata.team && (
                      <Typography variant="body2">
                        Team: {app.metadata.team}
                      </Typography>
                    )}
                    {app.dependencies?.length > 0 && (
                      <Typography variant="body2">
                        Dependencies: {app.dependencies.join(', ')}
                      </Typography>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

const PullRequestsPanel = ({ pullRequests, classes }: any) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Open Pull Requests
      </Typography>
      {pullRequests.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pullRequests.map((pr: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{pr.number}</TableCell>
                  <TableCell>{pr.title}</TableCell>
                  <TableCell>{pr.author}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={`${pr.branch} → ${pr.baseBranch}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={pr.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(pr.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Pull Request">
                      <IconButton
                        size="small"
                        onClick={() => window.open(pr.url, '_blank')}
                      >
                        <Launch />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="textSecondary">
          No open pull requests found
        </Typography>
      )}
    </CardContent>
  </Card>
);
```

### 5. Register GitOps Plugin

Update `packages/backend/src/index.ts`:

```typescript
import { gitopsPlugin } from './plugins/gitops';

// Add GitOps plugin
backend.add(gitopsPlugin);
```

### 6. Add GitOps Tab to Entity Page

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import { GitOpsPage } from '../gitops/GitOpsPage';

// In the service entity case
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {/* Existing overview content */}
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/gitops" title="GitOps">
      <GitOpsPage />
    </EntityLayout.Route>

    {/* Other existing routes */}
  </EntityLayout>
);
```

### 7. Configure GitOps in app-config.yaml

```yaml
gitops:
  argocd:
    url: ${ARGOCD_URL}
    token: ${ARGOCD_TOKEN}
    skipTLSVerify: false

  repositories:
    - name: platform-apps
      url: https://github.com/your-org/platform-apps.git
      type: github
      token: ${GITHUB_TOKEN}
      branch: main
      pathPatterns:
        - 'apps/**'
        - 'infrastructure/**'

    - name: application-manifests
      url: https://github.com/your-org/k8s-manifests.git
      type: github
      token: ${GITHUB_TOKEN}
      branch: main
      pathPatterns:
        - '**/*'

  discovery:
    enabled: true
    scanInterval: 30 # minutes
    excludePatterns:
      - '**/node_modules/**'
      - '**/.git/**'
      - '**/tmp/**'
    includePatterns:
      - '**/*.yaml'
      - '**/*.yml'
```

## Environment Variables Required

```bash
# ArgoCD Configuration
ARGOCD_URL=https://argocd.idp-platform.local
ARGOCD_TOKEN=<argocd-service-account-token>

# GitHub Configuration (for repository scanning)
GITHUB_TOKEN=<github-personal-access-token>

# Alternative Git providers
# GITLAB_TOKEN=<gitlab-access-token>
# BITBUCKET_TOKEN=<bitbucket-app-password>
```

### 8. Entity Annotations for GitOps

```yaml
# In catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    # Existing annotations
    backstage.io/kubernetes-id: my-service

    # GitOps annotations
    argocd.argoproj.io/instance: my-service
    argocd.argoproj.io/project: default

    # Repository annotations
    github.com/project-slug: my-org/my-service
    backstage.io/source-location: url:https://github.com/my-org/my-service

    # GitOps specific
    gitops.argoproj.io/sync-policy: automated
    gitops.argoproj.io/prune: 'true'
    gitops.argoproj.io/self-heal: 'true'
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

## Expected Outcomes

### ✅ **Comprehensive Application Discovery**

- Automatic discovery of applications from Git repositories
- Support for Helm, Kustomize, and plain YAML applications
- Repository scanning with configurable intervals

### ✅ **Complete Deployment Visibility**

- Real-time sync and health status monitoring
- Deployment history and rollback capabilities
- Resource-level status and health tracking

### ✅ **Advanced GitOps Operations**

- One-click sync, refresh, and rollback operations
- Configurable sync policies and automation
- Pull request integration and visibility

### ✅ **Multi-Repository Support**

- Support for multiple Git providers (GitHub, GitLab, Bitbucket)
- Flexible path patterns for application discovery
- Repository-level health and scanning status

## Troubleshooting

### Common Issues

1. **ArgoCD API Connection Issues**

   - Verify ArgoCD URL and token configuration
   - Check RBAC permissions for service account
   - Ensure network connectivity

2. **Repository Scanning Issues**

   - Verify Git repository access and tokens
   - Check path patterns and exclude filters
   - Ensure repository structure follows GitOps patterns

3. **Application Discovery Issues**
   - Verify application manifest structure
   - Check for required files (Chart.yaml, kustomization.yaml, etc.)
   - Review scanning logs for errors

### Debug Commands

```bash
# Check ArgoCD applications
argocd app list

# Verify repository access
git clone <repository-url>

# Test ArgoCD API
curl -H "Authorization: Bearer <token>" https://argocd.example.com/api/v1/applications

# Check application status
argocd app get <app-name>
```

## Next Steps

1. **Configure ArgoCD**: Ensure ArgoCD is properly installed and configured
2. **Set up Repository Access**: Configure Git repository access tokens
3. **Configure RBAC**: Set up proper permissions for ArgoCD service account
4. **Test Integration**: Verify GitOps data appears correctly in Backstage
5. **Team Onboarding**: Train team on GitOps workflows and self-service capabilities

---

**Dependencies**: ArgoCD, Git repositories, Kubernetes RBAC  
**Estimated Effort**: 5-6 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
