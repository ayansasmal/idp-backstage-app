import { createPlugin, createRoutableExtension, createRouteRef } from '@backstage/core-plugin-api';

const rootRouteRef = createRouteRef({
  id: 'feature-flags',
});

export const featureFlagsPlugin = createPlugin({
  id: 'feature-flags',
  routes: {
    root: rootRouteRef,
  },
});

export const FeatureFlagsPage = featureFlagsPlugin.provide(
  createRoutableExtension({
    name: 'FeatureFlagsPage',
    component: () =>
      import('./components/FeatureFlagsPage').then(m => m.FeatureFlagsPage),
    mountPoint: rootRouteRef,
  }),
);