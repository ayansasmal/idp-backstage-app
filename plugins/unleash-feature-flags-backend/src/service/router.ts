import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { InputError, NotFoundError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { startUnleash, initialize, isEnabled, Context, InMemStorageProvider } from 'unleash-client';
import fetch from 'node-fetch';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

// Types for Unleash API responses
interface UnleashFeature {
  name: string;
  enabled?: boolean;
  description?: string;
  createdAt?: string;
  lastSeenAt?: string;
  project?: string;
  stale?: boolean;
  type?: string;
  variants?: any[];
}

interface UnleashHealth {
  connected: boolean;
  url: string;
  instanceId: string;
  adminApiStatus?: string;
  error?: string;
}

interface FeatureFlag {
  name: string;
  enabled?: boolean;
  description?: string;
  tenant?: string;
  environment?: string;
  application?: string;
  flagName?: string;
  createdAt?: string;
  lastModified?: string;
  project?: string;
  stale?: boolean;
  type?: string;
  variants?: any[];
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;

  // Unleash configuration
  const unleashUrl = config.getOptionalString('unleash.url') || 'http://localhost:4242/api';
  const unleashApiToken = config.getOptionalString('unleash.apiToken');
  const unleashInstanceId = config.getOptionalString('unleash.instanceId') || 'idp-backstage';
  const unleashAdminUrl = config.getOptionalString('unleash.adminUrl') || 'http://localhost:4242/api/admin';

  // Initialize Unleash client for feature flag evaluation
  let unleashClient: any = null;
  let unleashInitialized = false;

  // Mock storage for development
  const mockFlags = new Map<string, FeatureFlag>();

  // Initialize with sample data
  const sampleFlags: FeatureFlag[] = [
    {
      name: 'idp-platform.development.backstage.new-ui-theme',
      enabled: true,
      description: 'Enable the new modern UI theme for Backstage',
      tenant: 'idp-platform',
      environment: 'development',
      application: 'backstage',
      flagName: 'new-ui-theme',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      lastModified: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      name: 'idp-platform.staging.api.enhanced-auth',
      enabled: false,
      description: 'Enable enhanced authentication flow with MFA support',
      tenant: 'idp-platform',
      environment: 'staging',
      application: 'api',
      flagName: 'enhanced-auth',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      lastModified: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  sampleFlags.forEach(flag => {
    mockFlags.set(flag.name, flag);
  });

  // Initialize Unleash client
  const initializeUnleash = async () => {
    if (unleashInitialized) return unleashClient;

    try {
      if (unleashApiToken) {
        // Production mode: Connect to real Unleash instance
        unleashClient = await startUnleash({
          url: unleashUrl,
          appName: unleashInstanceId,
          instanceId: unleashInstanceId,
          refreshInterval: 15000,
          metricsInterval: 60000,
          storageProvider: new InMemStorageProvider(),
          customHeaders: {
            Authorization: unleashApiToken,
          },
        });
        logger.info('Connected to Unleash OSS', { url: unleashUrl });
      } else {
        // Development mode: Use in-memory storage with mock data
        logger.info('Running in development mode with mock data');
        unleashClient = initialize({
          url: 'http://localhost:4242/api',
          appName: unleashInstanceId,
          instanceId: unleashInstanceId,
          storageProvider: new InMemStorageProvider(),
        });
      }
      
      unleashInitialized = true;
      return unleashClient;
    } catch (error) {
      logger.error('Failed to initialize Unleash client', error as Error);
      unleashClient = null;
      return null;
    }
  };

  // Admin API helper function
  const callUnleashAdmin = async (endpoint: string, options: any = {}): Promise<any> => {
    if (!unleashApiToken) {
      throw new InputError('Unleash API token not configured for admin operations');
    }

    const url = `${unleashAdminUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': unleashApiToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unleash Admin API error: ${response.status} ${response.statusText} - ${error}`);
    }

    return response.json();
  };

  const router = Router();
  router.use(express.json());
  
  // Mount all routes under /unleash-feature-flags
  const featureFlagsRouter = Router();

  // Get all feature flags with optional filtering
  featureFlagsRouter.get('/', async (req, res) => {
    try {
      await initializeUnleash();
      
      const { project = 'default', environment, tenant, application } = req.query;
      
      if (unleashClient && unleashApiToken) {
        // Production mode: Fetch from Unleash Admin API
        try {
          const response = await callUnleashAdmin(`/projects/${project}/features`);
          const features = response.features || [];
          
          // Transform Unleash features to our format
          const flags = features.map((feature: UnleashFeature): FeatureFlag => {
            const nameParts = feature.name.split('.');
            const [featureTenant, featureEnv, featureApp, ...flagParts] = nameParts;
            
            return {
              name: feature.name,
              enabled: feature.enabled || false,
              description: feature.description || '',
              tenant: featureTenant || 'unknown',
              environment: featureEnv || 'development',
              application: featureApp || 'default',
              flagName: flagParts.length > 0 ? flagParts.join('.') : feature.name,
              createdAt: feature.createdAt || new Date().toISOString(),
              lastModified: feature.lastSeenAt || feature.createdAt || new Date().toISOString(),
              project: feature.project || project as string,
              stale: feature.stale || false,
              type: feature.type || 'release',
              variants: feature.variants || [],
            };
          });
          
          // Apply filters
          let filteredFlags = flags;
          if (environment) {
            filteredFlags = filteredFlags.filter((flag: FeatureFlag) => flag.environment === environment);
          }
          if (tenant) {
            filteredFlags = filteredFlags.filter((flag: FeatureFlag) => flag.tenant === tenant);
          }
          if (application) {
            filteredFlags = filteredFlags.filter((flag: FeatureFlag) => flag.application === application);
          }
          
          logger.info(`Returning ${filteredFlags.length} feature flags from Unleash`);
          res.json(filteredFlags);
        } catch (unleashError) {
          logger.error('Error fetching from Unleash', unleashError as Error);
          // Fallback to mock data
          const flags = Array.from(mockFlags.values());
          logger.info(`Fallback: Returning ${flags.length} mock feature flags`);
          res.json(flags);
        }
      } else {
        // Development mode: Return mock data
        const flags = Array.from(mockFlags.values());
        logger.info(`Development mode: Returning ${flags.length} mock feature flags`);
        res.json(flags);
      }
    } catch (error) {
      logger.error('Error fetching feature flags', error as Error);
      res.status(500).json({ error: 'Failed to fetch feature flags' });
    }
  });

  // Create a new feature flag
  featureFlagsRouter.post('/', async (req, res) => {
    const { tenant, environment, application, flagName, description, project = 'default', type = 'release' } = req.body;
    
    // Validation
    if (!tenant || !environment || !application || !flagName) {
      throw new InputError('Missing required fields: tenant, environment, application, flagName');
    }
    
    const name = `${tenant}.${environment}.${application}.${flagName}`;
    
    try {
      await initializeUnleash();
      
      if (unleashClient && unleashApiToken) {
        // Production mode: Create via Unleash Admin API
        try {
          // Check if feature exists
          try {
            await callUnleashAdmin(`/projects/${project}/features/${name}`);
            return res.status(409).json({ error: 'Feature flag already exists' });
          } catch (checkError) {
            // Feature doesn't exist, continue with creation
          }
          
          // Create the feature
          const featurePayload = {
            name,
            description: description || `Feature flag for ${tenant} ${application} in ${environment}`,
            type,
            enabled: false,
            stale: false,
            variants: [],
          };
          
          const createdFeature = await callUnleashAdmin(`/projects/${project}/features`, {
            method: 'POST',
            body: JSON.stringify(featurePayload),
          });
          
          // Transform response to our format
          const newFlag: FeatureFlag = {
            name: createdFeature.name,
            enabled: createdFeature.enabled || false,
            description: createdFeature.description || '',
            tenant,
            environment,
            application,
            flagName,
            createdAt: createdFeature.createdAt || new Date().toISOString(),
            lastModified: new Date().toISOString(),
            project: createdFeature.project || project,
            stale: createdFeature.stale || false,
            type: createdFeature.type || type,
            variants: createdFeature.variants || [],
          };
          
          logger.info(`Created feature flag in Unleash: ${name}`);
          return res.status(201).json(newFlag);
        } catch (unleashError: any) {
          logger.error('Error creating in Unleash', unleashError);
          return res.status(500).json({ error: `Failed to create feature flag in Unleash: ${unleashError.message}` });
        }
      } else {
        // Development mode: Use mock storage
        if (mockFlags.has(name)) {
          return res.status(409).json({ error: 'Feature flag already exists' });
        }
        
        const newFlag: FeatureFlag = {
          name,
          enabled: false,
          description: description || '',
          tenant,
          environment,
          application,
          flagName,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          project,
          stale: false,
          type,
          variants: [],
        };
        
        mockFlags.set(name, newFlag);
        logger.info(`Created mock feature flag: ${name}`);
        return res.status(201).json(newFlag);
      }
    } catch (error) {
      logger.error('Error creating feature flag', error as Error);
      return res.status(500).json({ error: 'Failed to create feature flag' });
    }
  });

  // Toggle feature flag
  featureFlagsRouter.patch('/:flagName/toggle', async (req, res) => {
    const { flagName } = req.params;
    const { project = 'default', environment = 'development' } = req.query;
    const decodedFlagName = decodeURIComponent(flagName);
    
    try {
      await initializeUnleash();
      
      if (unleashClient && unleashApiToken) {
        // Production mode: Toggle via Unleash Admin API
        try {
          // Get current feature state
          const feature: UnleashFeature = await callUnleashAdmin(`/projects/${project}/features/${decodedFlagName}`);
          const newEnabledState = !feature.enabled;
          
          // Toggle the feature
          if (newEnabledState) {
            await callUnleashAdmin(`/projects/${project}/features/${decodedFlagName}/environments/${environment}/on`, {
              method: 'POST',
            });
          } else {
            await callUnleashAdmin(`/projects/${project}/features/${decodedFlagName}/environments/${environment}/off`, {
              method: 'POST',
            });
          }
          
          // Get updated feature state
          const updatedFeature: UnleashFeature = await callUnleashAdmin(`/projects/${project}/features/${decodedFlagName}`);
          
          // Transform to our format
          const nameParts = updatedFeature.name.split('.');
          const [tenant, env, app, ...flagParts] = nameParts;
          
          const flag: FeatureFlag = {
            name: updatedFeature.name,
            enabled: newEnabledState,
            description: updatedFeature.description || '',
            tenant: tenant || 'unknown',
            environment: env || 'development',
            application: app || 'default',
            flagName: flagParts.length > 0 ? flagParts.join('.') : updatedFeature.name,
            createdAt: updatedFeature.createdAt || new Date().toISOString(),
            lastModified: new Date().toISOString(),
            project: (updatedFeature.project as string) || (project as string),
            stale: updatedFeature.stale || false,
            type: updatedFeature.type || 'release',
            variants: updatedFeature.variants || [],
          };
          
          logger.info(`Toggled Unleash flag ${decodedFlagName} to ${newEnabledState}`);
          return res.json(flag);
        } catch (unleashError: any) {
          logger.error('Error toggling in Unleash', unleashError);
          return res.status(500).json({ error: `Failed to toggle feature flag in Unleash: ${unleashError.message}` });
        }
      } else {
        // Development mode: Use mock storage
        const flag = mockFlags.get(decodedFlagName);
        if (!flag) {
          throw new NotFoundError('Feature flag not found');
        }
        
        flag.enabled = !flag.enabled;
        flag.lastModified = new Date().toISOString();
        mockFlags.set(decodedFlagName, flag);
        
        logger.info(`Toggled mock flag ${decodedFlagName} to ${flag.enabled}`);
        return res.json(flag);
      }
    } catch (error) {
      logger.error('Error toggling feature flag', error as Error);
      return res.status(500).json({ error: 'Failed to toggle feature flag' });
    }
  });

  // Delete feature flag
  featureFlagsRouter.delete('/:flagName', async (req, res) => {
    const { flagName } = req.params;
    const { project = 'default' } = req.query;
    const decodedFlagName = decodeURIComponent(flagName);
    
    try {
      await initializeUnleash();
      
      if (unleashClient && unleashApiToken) {
        // Production mode: Delete via Unleash Admin API
        try {
          // Check if feature exists first
          await callUnleashAdmin(`/projects/${project}/features/${decodedFlagName}`);
          
          // Archive the feature (Unleash best practice instead of hard delete)
          await callUnleashAdmin(`/projects/${project}/features/${decodedFlagName}/archive`, {
            method: 'POST',
          });
          
          logger.info(`Archived Unleash feature flag: ${decodedFlagName}`);
          return res.status(204).send();
        } catch (unleashError: any) {
          if (unleashError?.message?.includes('404')) {
            throw new NotFoundError('Feature flag not found');
          }
          logger.error('Error deleting in Unleash', unleashError);
          return res.status(500).json({ error: `Failed to delete feature flag in Unleash: ${unleashError.message}` });
        }
      } else {
        // Development mode: Use mock storage
        if (!mockFlags.has(decodedFlagName)) {
          throw new NotFoundError('Feature flag not found');
        }
        
        mockFlags.delete(decodedFlagName);
        logger.info(`Deleted mock flag: ${decodedFlagName}`);
        return res.status(204).send();
      }
    } catch (error) {
      logger.error('Error deleting feature flag', error as Error);
      return res.status(500).json({ error: 'Failed to delete feature flag' });
    }
  });

  // Evaluate feature flag for a specific context
  featureFlagsRouter.post('/evaluate/:flagName', async (req, res) => {
    const { flagName } = req.params;
    const { userId, properties = {}, environment = 'development' } = req.body;
    const decodedFlagName = decodeURIComponent(flagName);
    
    try {
      await initializeUnleash();
      
      if (unleashClient) {
        // Use Unleash client for evaluation
        const context: Context = {
          userId,
          environment,
          properties: {
            ...properties,
            environment,
          },
        };
        
        const enabled = isEnabled(decodedFlagName, context, false);
        
        logger.info(`Evaluated flag ${decodedFlagName} for user ${userId}: ${enabled}`);
        return res.json({
          name: decodedFlagName,
          enabled,
          userId,
          environment,
          evaluatedAt: new Date().toISOString(),
        });
      } else {
        // Fallback to mock evaluation
        const flag = mockFlags.get(decodedFlagName);
        if (!flag) {
          throw new NotFoundError('Feature flag not found');
        }
        
        logger.info(`Mock evaluated flag ${decodedFlagName}: ${flag.enabled}`);
        return res.json({
          name: decodedFlagName,
          enabled: flag.enabled,
          userId,
          environment,
          evaluatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error evaluating feature flag', error as Error);
      return res.status(500).json({ error: 'Failed to evaluate feature flag' });
    }
  });

  // Get feature flag details
  featureFlagsRouter.get('/:flagName', async (req, res) => {
    const { flagName } = req.params;
    const { project = 'default' } = req.query;
    const decodedFlagName = decodeURIComponent(flagName);
    
    try {
      await initializeUnleash();
      
      if (unleashClient && unleashApiToken) {
        // Production mode: Get from Unleash
        try {
          const feature: UnleashFeature = await callUnleashAdmin(`/projects/${project}/features/${decodedFlagName}`);
          
          // Transform to our format
          const nameParts = feature.name.split('.');
          const [tenant, environment, application, ...flagParts] = nameParts;
          
          const flag: FeatureFlag = {
            name: feature.name,
            enabled: feature.enabled || false,
            description: feature.description || '',
            tenant: tenant || 'unknown',
            environment: environment || 'development',
            application: application || 'default',
            flagName: flagParts.length > 0 ? flagParts.join('.') : feature.name,
            createdAt: feature.createdAt || new Date().toISOString(),
            lastModified: feature.lastSeenAt || feature.createdAt || new Date().toISOString(),
            project: feature.project || project as string,
            stale: feature.stale || false,
            type: feature.type || 'release',
            variants: feature.variants || [],
          };
          
          logger.info(`Retrieved feature flag details: ${decodedFlagName}`);
          return res.json(flag);
        } catch (unleashError: any) {
          if (unleashError?.message?.includes('404')) {
            throw new NotFoundError('Feature flag not found');
          }
          throw unleashError;
        }
      } else {
        // Development mode: Get from mock storage
        const flag = mockFlags.get(decodedFlagName);
        if (!flag) {
          throw new NotFoundError('Feature flag not found');
        }
        
        logger.info(`Retrieved mock feature flag details: ${decodedFlagName}`);
        return res.json(flag);
      }
    } catch (error) {
      logger.error('Error getting feature flag details', error as Error);
      return res.status(500).json({ error: 'Failed to get feature flag details' });
    }
  });

  // Health check endpoint
  featureFlagsRouter.get('/health/status', async (_req, res) => {
    try {
      const unleashHealth: UnleashHealth = {
        connected: unleashInitialized && !!unleashClient,
        url: unleashUrl,
        instanceId: unleashInstanceId,
      };
      
      const status = {
        service: 'Unleash Feature Flags Plugin',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mode: unleashApiToken ? 'production' : 'development',
        unleash: unleashHealth,
        mockFlagsCount: mockFlags.size,
      };
      
      // Test Unleash connection if available
      if (unleashApiToken && unleashClient) {
        try {
          await callUnleashAdmin('/projects');
          unleashHealth.adminApiStatus = 'connected';
        } catch (unleashError: any) {
          unleashHealth.adminApiStatus = 'error';
          unleashHealth.error = unleashError?.message || 'Unknown error';
        }
      }
      
      logger.info('Health check requested');
      return res.json(status);
    } catch (error: any) {
      logger.error('Error in health check', error);
      return res.status(500).json({ 
        service: 'Unleash Feature Flags Plugin',
        status: 'unhealthy',
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Mount the feature flags routes under /unleash-feature-flags
  router.use('/unleash-feature-flags', featureFlagsRouter);

  return router;
}