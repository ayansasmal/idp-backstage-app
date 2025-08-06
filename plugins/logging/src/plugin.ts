import {
    createBackendPlugin,
    coreServices,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { LoggingService } from './service';

/**
 * Centralized logging plugin for Backstage
 * Provides structured logging with CloudWatch integration
 */
export const loggingPlugin = createBackendPlugin({
    pluginId: 'logging',
    register(env) {
        env.registerInit({
            deps: {
                logger: coreServices.logger,
                config: coreServices.rootConfig,
                httpRouter: coreServices.httpRouter,
                scheduler: coreServices.scheduler,
            },
            async init({ logger, config, httpRouter, scheduler }) {
                // Initialize logging service
                const loggingService = new LoggingService(config, logger);
                await loggingService.initialize();

                // Create HTTP router for logging endpoints
                const router = await createRouter({
                    logger,
                    config,
                    loggingService,
                });

                httpRouter.use(router);
                httpRouter.addAuthPolicy({
                    path: '/health',
                    allow: 'unauthenticated',
                });

                // Schedule periodic log cleanup and maintenance
                await scheduler.scheduleTask({
                    id: 'logging-cleanup',
                    frequency: { hours: 24 },
                    timeout: { minutes: 30 },
                    fn: async () => {
                        await loggingService.performMaintenance();
                    },
                });

                logger.info('Centralized logging plugin initialized successfully');
            },
        });
    },
});
