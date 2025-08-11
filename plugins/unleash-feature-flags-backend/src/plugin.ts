import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

/**
 * The Unleash Feature Flags plugin.
 *
 * @public
 */
export const unleashFeatureFlagsPlugin = createBackendPlugin({
  pluginId: 'unleash-feature-flags',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({
        config,
        logger,
        httpRouter,
      }) {
        const router = await createRouter({
          logger,
          config,
        });
        httpRouter.use(router as any);
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
      },
    });
  },
});