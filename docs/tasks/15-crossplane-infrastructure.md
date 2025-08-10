# Crossplane Infrastructure as Code

**Task 15: Crossplane Infrastructure as Code Integration**  
**Priority:** Medium  
**Objective:** Integrate Crossplane for cloud-native infrastructure provisioning and management through Backstage

## Overview

This task integrates Crossplane with Backstage to enable infrastructure as code through Kubernetes APIs, providing developers with self-service infrastructure provisioning capabilities for AWS resources while maintaining governance and compliance.

## Tasks

### 1. Install Crossplane Integration Dependencies

```bash
# Install Kubernetes and Crossplane-related packages
yarn workspace backend add @backstage/plugin-kubernetes-backend
yarn workspace backend add @backstage/plugin-scaffolder-backend
yarn workspace app add @backstage/plugin-kubernetes
yarn workspace backend add @kubernetes/client-node
yarn workspace backend add yaml
```

### 2. Create Crossplane Resource Provider

Create `packages/backend/src/plugins/crossplane/crossplaneProvider.ts`:

```typescript
import { KubernetesRequestAuth } from '@backstage/plugin-kubernetes-node';
import { Config } from '@backstage/config';
import { Logger } from 'winston';

export interface CrossplaneConfig {
  enabled: boolean;
  clusters: {
    name: string;
    url: string;
    authProvider: string;
  }[];
}

export interface CompositeResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: any;
  status?: {
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
      lastTransitionTime?: string;
    }>;
    connectionDetails?: {
      secretRef?: {
        name: string;
        namespace: string;
      };
    };
  };
}

export interface CompositeResourceDefinition {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
  };
  spec: {
    group: string;
    versions: Array<{
      name: string;
      served: boolean;
      referenceable: boolean;
      schema: {
        openAPIV3Schema: any;
      };
    }>;
    names: {
      kind: string;
      plural: string;
      categories?: string[];
    };
    claimNames?: {
      kind: string;
      plural: string;
    };
  };
}

export interface ProviderConfig {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
  };
  spec: {
    credentials: {
      source: string;
      secretRef?: {
        namespace: string;
        name: string;
        key: string;
      };
    };
  };
}

export class CrossplaneProvider {
  private config: CrossplaneConfig;
  private logger: Logger;
  private kubernetesApi: any;

  constructor(config: Config, logger: Logger, kubernetesApi: any) {
    this.config = config.getOptionalConfig('crossplane') as CrossplaneConfig;
    this.logger = logger;
    this.kubernetesApi = kubernetesApi;
  }

  async getCompositeResources(
    namespace?: string,
    auth?: KubernetesRequestAuth,
  ): Promise<CompositeResource[]> {
    try {
      const resources: CompositeResource[] = [];

      // Get all XRDs to understand available composite resources
      const xrds = await this.getCompositeResourceDefinitions(auth);

      for (const xrd of xrds) {
        try {
          const xrResources = await this.getResourcesByGroup(
            xrd.spec.group,
            xrd.spec.versions[0].name,
            xrd.spec.names.plural,
            namespace,
            auth,
          );
          resources.push(...xrResources);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch resources for ${xrd.spec.names.plural}`,
            error,
          );
        }
      }

      return resources;
    } catch (error) {
      this.logger.error('Failed to get composite resources', error);
      throw error;
    }
  }

  async getCompositeResourceDefinitions(
    auth?: KubernetesRequestAuth,
  ): Promise<CompositeResourceDefinition[]> {
    try {
      const response = await this.kubernetesApi.listClusterCustomObject(
        'apiextensions.crossplane.io',
        'v1',
        'compositeresourcedefinitions',
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get composite resource definitions', error);
      return [];
    }
  }

  async getProviderConfigs(
    auth?: KubernetesRequestAuth,
  ): Promise<ProviderConfig[]> {
    try {
      const response = await this.kubernetesApi.listClusterCustomObject(
        'pkg.crossplane.io',
        'v1',
        'providerconfigs',
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get provider configs', error);
      return [];
    }
  }

  async getCompositions(auth?: KubernetesRequestAuth): Promise<any[]> {
    try {
      const response = await this.kubernetesApi.listClusterCustomObject(
        'apiextensions.crossplane.io',
        'v1',
        'compositions',
      );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.error('Failed to get compositions', error);
      return [];
    }
  }

  async createCompositeResource(
    resource: CompositeResource,
    auth?: KubernetesRequestAuth,
  ): Promise<CompositeResource> {
    try {
      const [group, version] = resource.apiVersion.split('/');
      const response = await this.kubernetesApi.createNamespacedCustomObject(
        group,
        version,
        resource.metadata.namespace || 'default',
        this.pluralize(resource.kind.toLowerCase()),
        resource,
      );

      return response.body as CompositeResource;
    } catch (error) {
      this.logger.error('Failed to create composite resource', error);
      throw error;
    }
  }

  async deleteCompositeResource(
    group: string,
    version: string,
    plural: string,
    namespace: string,
    name: string,
    auth?: KubernetesRequestAuth,
  ): Promise<void> {
    try {
      await this.kubernetesApi.deleteNamespacedCustomObject(
        group,
        version,
        namespace,
        plural,
        name,
      );
    } catch (error) {
      this.logger.error('Failed to delete composite resource', error);
      throw error;
    }
  }

  async getResourceStatus(
    group: string,
    version: string,
    plural: string,
    namespace: string,
    name: string,
    auth?: KubernetesRequestAuth,
  ): Promise<any> {
    try {
      const response = await this.kubernetesApi.getNamespacedCustomObject(
        group,
        version,
        namespace,
        plural,
        name,
      );

      return response.body;
    } catch (error) {
      this.logger.error('Failed to get resource status', error);
      throw error;
    }
  }

  private async getResourcesByGroup(
    group: string,
    version: string,
    plural: string,
    namespace?: string,
    auth?: KubernetesRequestAuth,
  ): Promise<CompositeResource[]> {
    try {
      const response = namespace
        ? await this.kubernetesApi.listNamespacedCustomObject(
            group,
            version,
            namespace,
            plural,
          )
        : await this.kubernetesApi.listClusterCustomObject(
            group,
            version,
            plural,
          );

      return (response.body as any).items || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch ${plural} resources`, error);
      return [];
    }
  }

  private pluralize(word: string): string {
    // Simple pluralization - extend as needed
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    }
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch')) {
      return word + 'es';
    }
    return word + 's';
  }

  async getAWSResources(auth?: KubernetesRequestAuth): Promise<any[]> {
    const awsResources = [];

    try {
      // Get RDS instances
      const rdsInstances = await this.getResourcesByGroup(
        'rds.aws.crossplane.io',
        'v1alpha1',
        'dbinstances',
        undefined,
        auth,
      );
      awsResources.push(
        ...rdsInstances.map(r => ({ ...r, resourceType: 'RDS Instance' })),
      );

      // Get S3 buckets
      const s3Buckets = await this.getResourcesByGroup(
        's3.aws.crossplane.io',
        'v1beta1',
        'buckets',
        undefined,
        auth,
      );
      awsResources.push(
        ...s3Buckets.map(r => ({ ...r, resourceType: 'S3 Bucket' })),
      );

      // Get VPCs
      const vpcs = await this.getResourcesByGroup(
        'ec2.aws.crossplane.io',
        'v1beta1',
        'vpcs',
        undefined,
        auth,
      );
      awsResources.push(...vpcs.map(r => ({ ...r, resourceType: 'VPC' })));

      // Get EKS clusters
      const eksClusters = await this.getResourcesByGroup(
        'eks.aws.crossplane.io',
        'v1beta1',
        'clusters',
        undefined,
        auth,
      );
      awsResources.push(
        ...eksClusters.map(r => ({ ...r, resourceType: 'EKS Cluster' })),
      );
    } catch (error) {
      this.logger.error('Failed to get AWS resources', error);
    }

    return awsResources;
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
        const crossplaneProvider = new CrossplaneProvider(
          config,
          logger,
          kubernetesApi,
        );
        const router = Router();

        // Get all composite resources
        router.get('/resources', async (req, res) => {
          try {
            const { namespace } = req.query;
            const authHeader = req.headers.authorization;

            if (!authHeader) {
              return res.status(401).json({ error: 'Unauthorized' });
            }

            const resources = await crossplaneProvider.getCompositeResources(
              namespace as string,
              { token: authHeader.replace('Bearer ', '') },
            );

            res.json(resources);
          } catch (error) {
            logger.error('Failed to get composite resources', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get composite resource definitions
        router.get('/xrds', async (req, res) => {
          try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
              return res.status(401).json({ error: 'Unauthorized' });
            }

            const xrds =
              await crossplaneProvider.getCompositeResourceDefinitions({
                token: authHeader.replace('Bearer ', ''),
              });

            res.json(xrds);
          } catch (error) {
            logger.error('Failed to get XRDs', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get compositions
        router.get('/compositions', async (req, res) => {
          try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
              return res.status(401).json({ error: 'Unauthorized' });
            }

            const compositions = await crossplaneProvider.getCompositions({
              token: authHeader.replace('Bearer ', ''),
            });

            res.json(compositions);
          } catch (error) {
            logger.error('Failed to get compositions', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get AWS resources
        router.get('/aws-resources', async (req, res) => {
          try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
              return res.status(401).json({ error: 'Unauthorized' });
            }

            const awsResources = await crossplaneProvider.getAWSResources({
              token: authHeader.replace('Bearer ', ''),
            });

            res.json(awsResources);
          } catch (error) {
            logger.error('Failed to get AWS resources', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Create composite resource
        router.post('/resources', async (req, res) => {
          try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
              return res.status(401).json({ error: 'Unauthorized' });
            }

            const resource = await crossplaneProvider.createCompositeResource(
              req.body,
              { token: authHeader.replace('Bearer ', '') },
            );

            res.status(201).json(resource);
          } catch (error) {
            logger.error('Failed to create composite resource', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get resource status
        router.get(
          '/resources/:group/:version/:plural/:namespace/:name/status',
          async (req, res) => {
            try {
              const { group, version, plural, namespace, name } = req.params;
              const authHeader = req.headers.authorization;

              if (!authHeader) {
                return res.status(401).json({ error: 'Unauthorized' });
              }

              const status = await crossplaneProvider.getResourceStatus(
                group,
                version,
                plural,
                namespace,
                name,
                { token: authHeader.replace('Bearer ', '') },
              );

              res.json(status);
            } catch (error) {
              logger.error('Failed to get resource status', error);
              res.status(500).json({ error: 'Internal server error' });
            }
          },
        );

        // Delete composite resource
        router.delete(
          '/resources/:group/:version/:plural/:namespace/:name',
          async (req, res) => {
            try {
              const { group, version, plural, namespace, name } = req.params;
              const authHeader = req.headers.authorization;

              if (!authHeader) {
                return res.status(401).json({ error: 'Unauthorized' });
              }

              await crossplaneProvider.deleteCompositeResource(
                group,
                version,
                plural,
                namespace,
                name,
                { token: authHeader.replace('Bearer ', '') },
              );

              res.status(204).send();
            } catch (error) {
              logger.error('Failed to delete composite resource', error);
              res.status(500).json({ error: 'Internal server error' });
            }
          },
        );

        // Health check
        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/crossplane', router);
      },
    });
  },
});
```

### 4. Create Infrastructure Templates for Crossplane

Create `templates/infrastructure/aws-rds/template.yaml`:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: aws-rds-instance
  title: AWS RDS Database Instance
  description: Provision an AWS RDS database instance using Crossplane
  tags:
    - aws
    - rds
    - database
    - infrastructure
spec:
  owner: platform-team
  type: resource
  parameters:
    - title: Database Information
      required:
        - name
        - description
        - owner
      properties:
        name:
          title: Database Name
          type: string
          description: Name for the RDS instance
          pattern: '^[a-zA-Z0-9-]+$'
        description:
          title: Description
          type: string
          description: Purpose of this database
        owner:
          title: Owner
          type: string
          ui:field: OwnerPicker

    - title: Database Configuration
      required:
        - engine
        - instanceClass
        - allocatedStorage
      properties:
        engine:
          title: Database Engine
          type: string
          enum:
            - postgres
            - mysql
            - mariadb
          default: postgres
        engineVersion:
          title: Engine Version
          type: string
          default: '13.7'
          description: Database engine version
        instanceClass:
          title: Instance Class
          type: string
          enum:
            - db.t3.micro
            - db.t3.small
            - db.t3.medium
            - db.t3.large
          default: db.t3.small
        allocatedStorage:
          title: Storage Size (GB)
          type: number
          minimum: 20
          maximum: 1000
          default: 20
        multiAZ:
          title: Multi-AZ Deployment
          type: boolean
          default: false
          description: Enable high availability

    - title: Security Configuration
      properties:
        vpcSecurityGroupIds:
          title: VPC Security Group IDs
          type: array
          items:
            type: string
          description: Security group IDs for database access
        subnetGroupName:
          title: DB Subnet Group Name
          type: string
          description: Database subnet group for VPC deployment
        publiclyAccessible:
          title: Publicly Accessible
          type: boolean
          default: false
          description: Allow public internet access
        storageEncrypted:
          title: Storage Encryption
          type: boolean
          default: true
          description: Enable encryption at rest

    - title: Platform Configuration
      properties:
        environment:
          title: Environment
          type: string
          enum:
            - development
            - staging
            - production
          default: development
        namespace:
          title: Kubernetes Namespace
          type: string
          default: default

  steps:
    - id: fetch-base
      name: Fetch Base Template
      action: fetch:template
      input:
        url: ./content
        values:
          name: ${{ parameters.name }}
          description: ${{ parameters.description }}
          owner: ${{ parameters.owner }}
          engine: ${{ parameters.engine }}
          engineVersion: ${{ parameters.engineVersion }}
          instanceClass: ${{ parameters.instanceClass }}
          allocatedStorage: ${{ parameters.allocatedStorage }}
          multiAZ: ${{ parameters.multiAZ }}
          vpcSecurityGroupIds: ${{ parameters.vpcSecurityGroupIds }}
          subnetGroupName: ${{ parameters.subnetGroupName }}
          publiclyAccessible: ${{ parameters.publiclyAccessible }}
          storageEncrypted: ${{ parameters.storageEncrypted }}
          environment: ${{ parameters.environment }}
          namespace: ${{ parameters.namespace }}

    - id: create-crossplane-resource
      name: Create Crossplane Resource
      action: crossplane:create-resource
      input:
        resource:
          apiVersion: rds.aws.crossplane.io/v1alpha1
          kind: DBInstance
          metadata:
            name: ${{ parameters.name }}
            namespace: ${{ parameters.namespace }}
            labels:
              environment: ${{ parameters.environment }}
              owner: ${{ parameters.owner }}
          spec:
            forProvider:
              engine: ${{ parameters.engine }}
              engineVersion: ${{ parameters.engineVersion }}
              dbInstanceClass: ${{ parameters.instanceClass }}
              allocatedStorage: ${{ parameters.allocatedStorage }}
              multiAZ: ${{ parameters.multiAZ }}
              vpcSecurityGroupIds: ${{ parameters.vpcSecurityGroupIds }}
              dbSubnetGroupName: ${{ parameters.subnetGroupName }}
              publiclyAccessible: ${{ parameters.publiclyAccessible }}
              storageEncrypted: ${{ parameters.storageEncrypted }}
              region: us-east-1
            writeConnectionSecretsToRef:
              name: ${{ parameters.name }}-connection
              namespace: ${{ parameters.namespace }}
            providerConfigRef:
              name: aws-provider-config

    - id: register
      name: Register in Catalog
      action: catalog:register
      input:
        catalogInfoPath: '/catalog-info.yaml'

  output:
    links:
      - title: Crossplane Resource
        url: https://backstage.idp-platform.local/crossplane/resources/${{ parameters.name }}
      - title: Open in catalog
        icon: catalog
        entityRef: ${{ steps.register.output.entityRef }}
```

### 5. Create Crossplane Dashboard Components

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
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import {
  CloudIcon,
  DatabaseIcon,
  NetworkIcon,
  StorageIcon,
} from '@material-ui/icons';

const useStyles = makeStyles(theme => ({
  resourceCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  resourceIcon: {
    fontSize: 48,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1),
  },
  statusIcon: {
    marginRight: theme.spacing(1),
  },
  resourceGrid: {
    minHeight: 200,
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
      id={`crossplane-tabpanel-${index}`}
      aria-labelledby={`crossplane-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

export const CrossplanePage = () => {
  const classes = useStyles();
  const configApi = useApi(configApiRef);
  const [resources, setResources] = useState<any[]>([]);
  const [xrds, setXrds] = useState<any[]>([]);
  const [compositions, setCompositions] = useState<any[]>([]);
  const [awsResources, setAwsResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchCrossplaneData();
  }, []);

  const fetchCrossplaneData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        resourcesResponse,
        xrdsResponse,
        compositionsResponse,
        awsResponse,
      ] = await Promise.allSettled([
        fetch(`${backendUrl}/api/crossplane/resources`),
        fetch(`${backendUrl}/api/crossplane/xrds`),
        fetch(`${backendUrl}/api/crossplane/compositions`),
        fetch(`${backendUrl}/api/crossplane/aws-resources`),
      ]);

      if (
        resourcesResponse.status === 'fulfilled' &&
        resourcesResponse.value.ok
      ) {
        setResources(await resourcesResponse.value.json());
      }

      if (xrdsResponse.status === 'fulfilled' && xrdsResponse.value.ok) {
        setXrds(await xrdsResponse.value.json());
      }

      if (
        compositionsResponse.status === 'fulfilled' &&
        compositionsResponse.value.ok
      ) {
        setCompositions(await compositionsResponse.value.json());
      }

      if (awsResponse.status === 'fulfilled' && awsResponse.value.ok) {
        setAwsResources(await awsResponse.value.json());
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

  const getResourceStatus = (resource: any) => {
    if (!resource.status?.conditions) {
      return <StatusPending>Pending</StatusPending>;
    }

    const readyCondition = resource.status.conditions.find(
      (c: any) => c.type === 'Ready' || c.type === 'Synced',
    );

    if (readyCondition?.status === 'True') {
      return <StatusOK>Ready</StatusOK>;
    }

    if (readyCondition?.status === 'False') {
      return <StatusError>Failed</StatusError>;
    }

    return <StatusWarning>In Progress</StatusWarning>;
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType.toLowerCase()) {
      case 'rds instance':
      case 'dbinstance':
        return <DatabaseIcon className={classes.resourceIcon} />;
      case 's3 bucket':
      case 'bucket':
        return <StorageIcon className={classes.resourceIcon} />;
      case 'vpc':
      case 'subnet':
        return <NetworkIcon className={classes.resourceIcon} />;
      default:
        return <CloudIcon className={classes.resourceIcon} />;
    }
  };

  const handleDeleteResource = async (resource: any) => {
    try {
      const [group, version] = resource.apiVersion.split('/');
      const plural = resource.kind.toLowerCase() + 's'; // Simple pluralization

      const response = await fetch(
        `${backendUrl}/api/crossplane/resources/${group}/${version}/${plural}/${
          resource.metadata.namespace || 'default'
        }/${resource.metadata.name}`,
        { method: 'DELETE' },
      );

      if (response.ok) {
        await fetchCrossplaneData();
        setDeleteDialogOpen(false);
        setSelectedResource(null);
      }
    } catch (error) {
      console.error('Failed to delete resource:', error);
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Infrastructure as Code" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Infrastructure as Code" />
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
          title="Infrastructure as Code"
          subtitle="Crossplane Resource Management"
        >
          <SupportButton>
            Manage cloud infrastructure through Kubernetes APIs.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="Crossplane Dashboard">
            <Typography variant="body1">
              Provision and manage cloud infrastructure using Crossplane
            </Typography>
          </ContentHeader>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Overview" />
              <Tab label="Composite Resources" />
              <Tab label="AWS Resources" />
              <Tab label="Compositions" />
              <Tab label="Resource Definitions" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <CrossplaneOverview
              resources={resources}
              awsResources={awsResources}
              xrds={xrds}
              compositions={compositions}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <CompositeResourcesTable
              resources={resources}
              getResourceStatus={getResourceStatus}
              onResourceSelect={setSelectedResource}
              onDeleteResource={() => setDeleteDialogOpen(true)}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <AWSResourcesGrid
              awsResources={awsResources}
              getResourceStatus={getResourceStatus}
              getResourceIcon={getResourceIcon}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <CompositionsTable compositions={compositions} />
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <ResourceDefinitionsTable xrds={xrds} />
          </TabPanel>

          {/* Delete confirmation dialog */}
          <Dialog
            open={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
          >
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete{' '}
                {selectedResource?.metadata?.name}? This action cannot be
                undone.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => handleDeleteResource(selectedResource)}
                color="secondary"
              >
                Delete
              </Button>
            </DialogActions>
          </Dialog>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};

const CrossplaneOverview = ({
  resources,
  awsResources,
  xrds,
  compositions,
  classes,
}: any) => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={3}>
      <Card className={classes.resourceCard}>
        <CardContent>
          <CloudIcon className={classes.resourceIcon} />
          <Typography variant="h6" gutterBottom>
            Composite Resources
          </Typography>
          <Typography variant="h4">{resources.length}</Typography>
          <Typography variant="body2" color="textSecondary">
            Active infrastructure resources
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card className={classes.resourceCard}>
        <CardContent>
          <DatabaseIcon className={classes.resourceIcon} />
          <Typography variant="h6" gutterBottom>
            AWS Resources
          </Typography>
          <Typography variant="h4">{awsResources.length}</Typography>
          <Typography variant="body2" color="textSecondary">
            AWS cloud resources
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card className={classes.resourceCard}>
        <CardContent>
          <NetworkIcon className={classes.resourceIcon} />
          <Typography variant="h6" gutterBottom>
            Compositions
          </Typography>
          <Typography variant="h4">{compositions.length}</Typography>
          <Typography variant="body2" color="textSecondary">
            Infrastructure templates
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card className={classes.resourceCard}>
        <CardContent>
          <StorageIcon className={classes.resourceIcon} />
          <Typography variant="h6" gutterBottom>
            Resource Types
          </Typography>
          <Typography variant="h4">{xrds.length}</Typography>
          <Typography variant="body2" color="textSecondary">
            Available resource definitions
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const CompositeResourcesTable = ({
  resources,
  getResourceStatus,
  onResourceSelect,
  onDeleteResource,
}: any) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Kind</TableCell>
          <TableCell>Namespace</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Age</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {resources.map((resource: any, index: number) => (
          <TableRow key={index}>
            <TableCell>{resource.metadata.name}</TableCell>
            <TableCell>
              <Chip label={resource.kind} size="small" />
            </TableCell>
            <TableCell>
              {resource.metadata.namespace || 'cluster-scoped'}
            </TableCell>
            <TableCell>{getResourceStatus(resource)}</TableCell>
            <TableCell>
              {resource.metadata.creationTimestamp
                ? new Date(
                    resource.metadata.creationTimestamp,
                  ).toLocaleDateString()
                : 'Unknown'}
            </TableCell>
            <TableCell>
              <Button
                size="small"
                onClick={() => {
                  onResourceSelect(resource);
                  onDeleteResource();
                }}
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

const AWSResourcesGrid = ({
  awsResources,
  getResourceStatus,
  getResourceIcon,
  classes,
}: any) => (
  <Grid container spacing={3} className={classes.resourceGrid}>
    {awsResources.map((resource: any, index: number) => (
      <Grid item xs={12} md={4} key={index}>
        <Card className={classes.resourceCard}>
          <CardContent>
            {getResourceIcon(resource.resourceType)}
            <Typography variant="h6" gutterBottom>
              {resource.metadata.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {resource.resourceType}
            </Typography>
            <Box mb={1}>{getResourceStatus(resource)}</Box>
            <Typography variant="body2">
              Namespace: {resource.metadata.namespace || 'default'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

const CompositionsTable = ({ compositions }: any) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Composite Type</TableCell>
          <TableCell>Resources</TableCell>
          <TableCell>Age</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {compositions.map((composition: any, index: number) => (
          <TableRow key={index}>
            <TableCell>{composition.metadata.name}</TableCell>
            <TableCell>
              <Chip
                label={`${
                  composition.spec.compositeTypeRef?.kind || 'Unknown'
                }`}
                size="small"
              />
            </TableCell>
            <TableCell>{composition.spec.resources?.length || 0}</TableCell>
            <TableCell>
              {composition.metadata.creationTimestamp
                ? new Date(
                    composition.metadata.creationTimestamp,
                  ).toLocaleDateString()
                : 'Unknown'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const ResourceDefinitionsTable = ({ xrds }: any) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Kind</TableCell>
          <TableCell>Group</TableCell>
          <TableCell>Versions</TableCell>
          <TableCell>Claim Support</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {xrds.map((xrd: any, index: number) => (
          <TableRow key={index}>
            <TableCell>{xrd.metadata.name}</TableCell>
            <TableCell>
              <Chip label={xrd.spec.names.kind} size="small" />
            </TableCell>
            <TableCell>{xrd.spec.group}</TableCell>
            <TableCell>
              {xrd.spec.versions.map((v: any) => v.name).join(', ')}
            </TableCell>
            <TableCell>
              <Chip
                label={xrd.spec.claimNames ? 'Yes' : 'No'}
                size="small"
                color={xrd.spec.claimNames ? 'primary' : 'default'}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);
```

### 6. Register Crossplane Plugin

Update `packages/backend/src/index.ts`:

```typescript
import { crossplanePlugin } from './plugins/crossplane';

// Add Crossplane plugin
backend.add(crossplanePlugin);
```

### 7. Configure Crossplane in app-config.yaml

```yaml
crossplane:
  enabled: true
  clusters:
    - name: production
      url: ${K8S_CLUSTER_URL}
      authProvider: serviceAccount
      serviceAccountToken: ${K8S_SERVICE_ACCOUNT_TOKEN}

catalog:
  locations:
    - type: file
      target: ./templates/infrastructure/aws-rds/template.yaml
    - type: file
      target: ./templates/infrastructure/aws-s3/template.yaml
    - type: file
      target: ./templates/infrastructure/aws-vpc/template.yaml
```

## Environment Variables Required

```bash
# Kubernetes Configuration
K8S_CLUSTER_URL=https://kubernetes.default.svc
K8S_SERVICE_ACCOUNT_TOKEN=<service-account-token>

# AWS Provider Configuration (for Crossplane)
AWS_ACCESS_KEY_ID=<aws-access-key>
AWS_SECRET_ACCESS_KEY=<aws-secret-key>
AWS_REGION=us-east-1

# Crossplane Provider Config
CROSSPLANE_PROVIDER_CONFIG_NAME=aws-provider-config
```

### 8. Example Crossplane Compositions

Create example compositions for common infrastructure patterns:

#### AWS RDS Composition:

```yaml
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: aws-rds-postgresql
  labels:
    provider: aws
    service: rds
    engine: postgresql
spec:
  compositeTypeRef:
    apiVersion: platform.company.com/v1alpha1
    kind: XPostgreSQLInstance
  resources:
    - name: rds-instance
      base:
        apiVersion: rds.aws.crossplane.io/v1alpha1
        kind: DBInstance
        spec:
          forProvider:
            engine: postgres
            engineVersion: '13.7'
            dbInstanceClass: db.t3.small
            allocatedStorage: 20
            storageEncrypted: true
            multiAZ: false
            publiclyAccessible: false
            region: us-east-1
          writeConnectionSecretsToRef:
            namespace: crossplane-system
      patches:
        - type: FromCompositeFieldPath
          fromFieldPath: metadata.name
          toFieldPath: metadata.name
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.instanceClass
          toFieldPath: spec.forProvider.dbInstanceClass
        - type: FromCompositeFieldPath
          fromFieldPath: spec.parameters.storageSize
          toFieldPath: spec.forProvider.allocatedStorage
      connectionDetails:
        - fromConnectionSecretKey: endpoint
        - fromConnectionSecretKey: port
        - fromConnectionSecretKey: username
        - fromConnectionSecretKey: password
```

## Expected Outcomes

### ✅ **Infrastructure as Code**

- Self-service infrastructure provisioning through Backstage
- Kubernetes-native resource management
- GitOps-compatible infrastructure definitions

### ✅ **AWS Resource Management**

- Automated AWS resource provisioning
- Compliance and governance through policies
- Cost optimization through resource lifecycle management

### ✅ **Developer Experience**

- Template-based infrastructure creation
- Visual resource status monitoring
- Integrated resource lifecycle management

### ✅ **Platform Governance**

- Standardized infrastructure patterns
- RBAC-controlled resource access
- Audit trail for all infrastructure changes

## Troubleshooting

### Common Issues

1. **Crossplane CRDs Not Available**

   - Verify Crossplane is installed and running
   - Check CRD installation status
   - Ensure proper RBAC permissions

2. **AWS Provider Configuration Issues**

   - Verify AWS credentials are correct
   - Check provider configuration secret
   - Ensure IAM permissions for resource creation

3. **Resource Provisioning Failures**
   - Check Crossplane provider logs
   - Verify AWS service limits and quotas
   - Review resource specifications and constraints

### Debug Commands

```bash
# Check Crossplane installation
kubectl get pods -n crossplane-system

# List provider configurations
kubectl get providerconfigs

# Check composite resource status
kubectl get composite

# View Crossplane provider logs
kubectl logs -n crossplane-system deployment/crossplane-provider-aws
```

## Next Steps

1. **Install Crossplane**: Deploy Crossplane and AWS provider
2. **Configure Providers**: Set up AWS provider configuration
3. **Create Compositions**: Define infrastructure templates
4. **Test Provisioning**: Validate resource creation workflows
5. **Team Training**: Onboard teams on infrastructure as code practices

---

**Dependencies**: Crossplane, AWS Provider, Kubernetes RBAC  
**Estimated Effort**: 5-6 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
