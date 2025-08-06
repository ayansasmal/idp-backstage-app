import {
    createPlugin,
    createRoutableExtension,
    createApiFactory,
    discoveryApiRef,
    fetchApiRef,
} from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';
import { unleashFeatureFlagsApiRef, UnleashFeatureFlagsApi } from './api';

export const unleashFeatureFlagsPlugin = createPlugin({
    id: 'unleash-feature-flags',
    routes: {
        root: rootRouteRef,
    },
    apis: [
        createApiFactory({
            api: unleashFeatureFlagsApiRef,
            deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
            factory: ({ discoveryApi, fetchApi }) =>
                new UnleashFeatureFlagsApi({ discoveryApi, fetchApi }),
        }),
    ],
});

export const UnleashFeatureFlagsPage = unleashFeatureFlagsPlugin.provide(
    createRoutableExtension({
        name: 'UnleashFeatureFlagsPage',
        component: () =>
            import('./components/FeatureFlagsPage').then(m => m.FeatureFlagsPage),
        mountPoint: rootRouteRef,
    }),
);
