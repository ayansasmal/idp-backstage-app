import { Router } from 'express';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError } from '@backstage/errors';
import { UnleashService, TenantEnvironmentApp, CreateFeatureFlagRequest, UpdateFeatureFlagRequest, ToggleFeatureFlagRequest } from './service';

export interface RouterOptions {
    unleashService: UnleashService;
    config: Config;
    logger: LoggerService;
}

/**
 * Creates a router for the Unleash feature flags plugin
 */
export async function createRouter(options: RouterOptions): Promise<Router> {
    const { unleashService, logger } = options;
    const router = Router();

    // Middleware to parse tenant.environment.app context
    router.use((req, res, next) => {
        const { tenant, environment, app } = req.query;

        if (!tenant || !environment || !app) {
            return res.status(400).json({
                error: 'Missing required query parameters: tenant, environment, app',
            });
        }

        req.context = {
            tenant: String(tenant),
            environment: String(environment),
            app: String(app),
        } as TenantEnvironmentApp;

        next();
    });

    // GET /health - Health check
    router.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // GET /projects - Get all projects
    router.get('/projects', async (req, res) => {
        try {
            const projects = await unleashService.getProjects();
            res.json({ projects });
        } catch (error) {
            logger.error('Failed to get projects', { error: String(error) });
            res.status(500).json({ error: 'Failed to get projects' });
        }
    });

    // GET /environments - Get all environments
    router.get('/environments', async (req, res) => {
        try {
            const environments = await unleashService.getEnvironments();
            res.json({ environments });
        } catch (error) {
            logger.error('Failed to get environments', { error: String(error) });
            res.status(500).json({ error: 'Failed to get environments' });
        }
    });

    // GET /feature-flags - Get feature flags for tenant.environment.app
    router.get('/feature-flags', async (req, res) => {
        try {
            const context = req.context as TenantEnvironmentApp;
            const featureFlags = await unleashService.getFeatureFlags(context);
            res.json({ featureFlags });
        } catch (error) {
            logger.error('Failed to get feature flags', {
                tenant: req.context?.tenant,
                environment: req.context?.environment,
                app: req.context?.app,
                error: String(error)
            });
            res.status(500).json({ error: 'Failed to get feature flags' });
        }
    });

    // GET /feature-flags/:flagName - Get specific feature flag
    router.get('/feature-flags/:flagName', async (req, res) => {
        try {
            const context = req.context as TenantEnvironmentApp;
            const { flagName } = req.params;

            const featureFlag = await unleashService.getFeatureFlag(context, flagName);
            res.json({ featureFlag });
        } catch (error) {
            if (error instanceof NotFoundError) {
                res.status(404).json({ error: error.message });
            } else {
                logger.error('Failed to get feature flag', {
                    tenant: req.context?.tenant,
                    environment: req.context?.environment,
                    app: req.context?.app,
                    flagName: req.params.flagName,
                    error: String(error)
                });
                res.status(500).json({ error: 'Failed to get feature flag' });
            }
        }
    });

    // POST /feature-flags - Create feature flag
    router.post('/feature-flags', async (req, res) => {
        try {
            const context = req.context as TenantEnvironmentApp;
            const request = req.body as CreateFeatureFlagRequest;

            // Validate required fields
            if (!request.name) {
                throw new InputError('Feature flag name is required');
            }

            // Set project to match tenant.environment.app context
            request.project = `${context.tenant}-${context.environment}-${context.app}`;

            const featureFlag = await unleashService.createFeatureFlag(context, request);
            res.status(201).json({ featureFlag });
        } catch (error) {
            if (error instanceof InputError) {
                res.status(400).json({ error: error.message });
            } else {
                logger.error('Failed to create feature flag', {
                    tenant: req.context?.tenant,
                    environment: req.context?.environment,
                    app: req.context?.app,
                    body: req.body,
                    error: String(error)
                });
                res.status(500).json({ error: 'Failed to create feature flag' });
            }
        }
    });

    // PUT /feature-flags/:flagName - Update feature flag
    router.put('/feature-flags/:flagName', async (req, res) => {
        try {
            const context = req.context as TenantEnvironmentApp;
            const { flagName } = req.params;
            const request = req.body as UpdateFeatureFlagRequest;

            const featureFlag = await unleashService.updateFeatureFlag(context, flagName, request);
            res.json({ featureFlag });
        } catch (error) {
            if (error instanceof NotFoundError) {
                res.status(404).json({ error: error.message });
            } else {
                logger.error('Failed to update feature flag', {
                    tenant: req.context?.tenant,
                    environment: req.context?.environment,
                    app: req.context?.app,
                    flagName: req.params.flagName,
                    body: req.body,
                    error: String(error)
                });
                res.status(500).json({ error: 'Failed to update feature flag' });
            }
        }
    });

    // DELETE /feature-flags/:flagName - Delete feature flag
    router.delete('/feature-flags/:flagName', async (req, res) => {
        try {
            const context = req.context as TenantEnvironmentApp;
            const { flagName } = req.params;

            await unleashService.deleteFeatureFlag(context, flagName);
            res.status(204).send();
        } catch (error) {
            if (error instanceof NotFoundError) {
                res.status(404).json({ error: error.message });
            } else {
                logger.error('Failed to delete feature flag', {
                    tenant: req.context?.tenant,
                    environment: req.context?.environment,
                    app: req.context?.app,
                    flagName: req.params.flagName,
                    error: String(error)
                });
                res.status(500).json({ error: 'Failed to delete feature flag' });
            }
        }
    });

    // POST /feature-flags/:flagName/toggle - Toggle feature flag
    router.post('/feature-flags/:flagName/toggle', async (req, res) => {
        try {
            const context = req.context as TenantEnvironmentApp;
            const { flagName } = req.params;
            const request = req.body as ToggleFeatureFlagRequest;

            // Validate required fields
            if (request.environment === undefined || request.enabled === undefined) {
                throw new InputError('Environment and enabled fields are required');
            }

            await unleashService.toggleFeatureFlag(context, flagName, request);
            res.status(200).json({ message: 'Feature flag toggled successfully' });
        } catch (error) {
            if (error instanceof NotFoundError) {
                res.status(404).json({ error: error.message });
            } else if (error instanceof InputError) {
                res.status(400).json({ error: error.message });
            } else {
                logger.error('Failed to toggle feature flag', {
                    tenant: req.context?.tenant,
                    environment: req.context?.environment,
                    app: req.context?.app,
                    flagName: req.params.flagName,
                    body: req.body,
                    error: String(error)
                });
                res.status(500).json({ error: 'Failed to toggle feature flag' });
            }
        }
    });

    // GET /feature-flags/:flagName/strategies - Get feature flag strategies
    router.get('/feature-flags/:flagName/strategies', async (req, res) => {
        try {
            const context = req.context as TenantEnvironmentApp;
            const { flagName } = req.params;
            const { environment } = req.query;

            if (!environment) {
                throw new InputError('Environment query parameter is required');
            }

            const strategies = await unleashService.getFeatureFlagStrategies(context, flagName, String(environment));
            res.json({ strategies });
        } catch (error) {
            if (error instanceof NotFoundError) {
                res.status(404).json({ error: error.message });
            } else if (error instanceof InputError) {
                res.status(400).json({ error: error.message });
            } else {
                logger.error('Failed to get feature flag strategies', {
                    tenant: req.context?.tenant,
                    environment: req.context?.environment,
                    app: req.context?.app,
                    flagName: req.params.flagName,
                    targetEnvironment: req.query.environment,
                    error: String(error)
                });
                res.status(500).json({ error: 'Failed to get feature flag strategies' });
            }
        }
    });

    // GET /metrics - Get feature flag metrics
    router.get('/metrics', async (req, res) => {
        try {
            const context = req.context as TenantEnvironmentApp;
            const metrics = await unleashService.getFeatureFlagMetrics(context);
            res.json({ metrics });
        } catch (error) {
            logger.error('Failed to get feature flag metrics', {
                tenant: req.context?.tenant,
                environment: req.context?.environment,
                app: req.context?.app,
                error: String(error)
            });
            res.status(500).json({ error: 'Failed to get feature flag metrics' });
        }
    });

    return router;
}

// Extend Express Request type to include context
declare global {
    namespace Express {
        interface Request {
            context?: TenantEnvironmentApp;
        }
    }
}
