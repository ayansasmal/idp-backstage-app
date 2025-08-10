import { Router } from 'express';

// TODO: Add back when integrating with Unleash OSS
// import fetch from 'node-fetch';
// const unleashUrl = process.env.UNLEASH_URL;
// const unleashApiToken = process.env.UNLEASH_API_TOKEN;

export const featureFlagsRouter = Router();

// Mock storage for development (will be replaced with Unleash OSS on IDP)
const mockFlags = new Map<string, any>();

// Initialize with sample data
const sampleFlags = [
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
  {
    name: 'idp-platform.production.frontend.beta-features',
    enabled: false,
    description: 'Enable beta features in the frontend application',
    tenant: 'idp-platform',
    environment: 'production',
    application: 'frontend',
    flagName: 'beta-features',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    lastModified: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    name: 'acme-corp.development.mobile-app.dark-mode',
    enabled: true,
    description: 'Enable dark mode toggle in mobile application',
    tenant: 'acme-corp',
    environment: 'development',
    application: 'mobile-app',
    flagName: 'dark-mode',
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    lastModified: new Date(Date.now() - 1800000).toISOString(),
  }
];

sampleFlags.forEach(flag => {
  mockFlags.set(flag.name, flag);
});


// Get all feature flags (mocked for now, will use Unleash OSS on IDP)
featureFlagsRouter.get('/', async (_req, res) => {
  try {
    // TODO: Replace with actual Unleash OSS API call when deployed on IDP
    // For now, return mock data
    const flags = Array.from(mockFlags.values());
    console.log(`[Feature Flags API] Returning ${flags.length} feature flags`);
    res.json(flags);
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

// Create a new feature flag (mocked for now, will use Unleash OSS on IDP)
featureFlagsRouter.post('/', async (req, res) => {
  const { tenant, environment, application, flagName, description } = req.body;
  
  // Validation
  if (!tenant || !environment || !application || !flagName) {
    return res.status(400).json({ error: 'Missing required fields: tenant, environment, application, flagName' });
  }
  
  const name = `${tenant}.${environment}.${application}.${flagName}`;
  
  // Check if flag already exists
  if (mockFlags.has(name)) {
    return res.status(409).json({ error: 'Feature flag already exists' });
  }
  
  const newFlag = {
    name,
    enabled: false,
    description: description || '',
    tenant,
    environment,
    application,
    flagName,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
  
  try {
    // TODO: Replace with actual Unleash OSS API call when deployed on IDP
    mockFlags.set(name, newFlag);
    console.log(`[Feature Flags API] Created new flag: ${name}`);
    return res.status(201).json(newFlag);
  } catch (error) {
    console.error('Error creating feature flag:', error);
    return res.status(500).json({ error: 'Failed to create feature flag' });
  }
});

// Toggle feature flag (mocked for now, will use Unleash OSS on IDP)
featureFlagsRouter.patch('/:flagName/toggle', async (req, res) => {
  const { flagName } = req.params;
  const decodedFlagName = decodeURIComponent(flagName);
  
  try {
    const flag = mockFlags.get(decodedFlagName);
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    
    // TODO: Replace with actual Unleash OSS API call when deployed on IDP
    flag.enabled = !flag.enabled;
    flag.lastModified = new Date().toISOString();
    mockFlags.set(decodedFlagName, flag);
    
    console.log(`[Feature Flags API] Toggled flag ${decodedFlagName} to ${flag.enabled}`);
    return res.json(flag);
  } catch (error) {
    console.error('Error toggling feature flag:', error);
    return res.status(500).json({ error: 'Failed to toggle feature flag' });
  }
});

// Delete feature flag (mocked for now, will use Unleash OSS on IDP)
featureFlagsRouter.delete('/:flagName', async (req, res) => {
  const { flagName } = req.params;
  const decodedFlagName = decodeURIComponent(flagName);
  
  try {
    if (!mockFlags.has(decodedFlagName)) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    
    // TODO: Replace with actual Unleash OSS API call when deployed on IDP
    mockFlags.delete(decodedFlagName);
    console.log(`[Feature Flags API] Deleted flag: ${decodedFlagName}`);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return res.status(500).json({ error: 'Failed to delete feature flag' });
  }
});




export default {
    register({ router }: { router: Router }) {
        router.use('/feature-flags', featureFlagsRouter);
    },
};
