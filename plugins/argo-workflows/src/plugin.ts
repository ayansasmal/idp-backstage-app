import {
    createBackendPlugin,
    coreServices,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { ArgoWorkflowsService, ArgoWorkflowsConfig } from './service';

/**
 * Argo Workflows plugin for Backstage
 */
export const argoWorkflowsPlugin = createBackendPlugin({
    pluginId: 'argo-workflows',
    register(env) {
        env.registerInit({
            deps: {
                logger: coreServices.logger,
                config: coreServices.rootConfig,
                httpRouter: coreServices.httpRouter,
            },
            async init({ logger, config, httpRouter }) {
                // Load Argo Workflows configuration
                const argoConfig = loadArgoWorkflowsConfig(config);

                // Initialize Argo Workflows service
                const argoService = new ArgoWorkflowsService(argoConfig, logger);

                // Create HTTP router
                const router = await createRouter({
                    logger,
                    config,
                    argoService,
                });

                httpRouter.use(router);
                httpRouter.addAuthPolicy({
                    path: '/health',
                    allow: 'unauthenticated',
                });

                logger.info('Argo Workflows plugin initialized successfully');
            },
        });
    },
});

/**
 * Load Argo Workflows configuration from app-config.yaml
 */
function loadArgoWorkflowsConfig(config: any): ArgoWorkflowsConfig {
    const argoConfig = config.getOptionalConfig('argoWorkflows');

    if (!argoConfig) {
        throw new Error('Argo Workflows configuration not found in app-config.yaml');
    }

    return {
        baseUrl: argoConfig.getOptionalString('baseUrl'),
        token: argoConfig.getOptionalString('token'),
        namespace: argoConfig.getString('namespace'),
        kubeConfig: argoConfig.getOptionalString('kubeConfig'),
        insecure: argoConfig.getOptionalBoolean('insecure') || false,
    };
}
