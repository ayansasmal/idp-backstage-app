import {
    coreServices,
    createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { UnleashService } from './service';

/**
 * Unleash feature flags plugin for Backstage
 * 
 * @public
 */
export const unleashFeatureFlagsPlugin = createBackendPlugin({
    pluginId: 'unleash-feature-flags',
    register(env) {
        env.registerInit({
            deps: {
                httpRouter: coreServices.httpRouter,
                logger: coreServices.logger,
                config: coreServices.rootConfig,
            },
            async init({ httpRouter, logger, config }) {
                // Get Unleash configuration
                const unleashConfig = config.getConfig('unleash');
                const baseUrl = unleashConfig.getString('baseUrl');
                const adminApiKey = unleashConfig.getString('adminApiKey');
                const clientApiKey = unleashConfig.getOptionalString('clientApiKey');
                const defaultProject = unleashConfig.getOptionalString('defaultProject');

                // Create Unleash service
                const unleashService = new UnleashService(
                    {
                        baseUrl,
                        adminApiKey,
                        clientApiKey,
                        defaultProject,
                    },
                    logger,
                );

                // Create router
                const router = await createRouter({
                    unleashService,
                    config,
                    logger,
                });

                // Mount router
                httpRouter.use(router);

                logger.info('Unleash feature flags plugin initialized successfully');
            },
        });
    },
});

export default unleashFeatureFlagsPlugin;
