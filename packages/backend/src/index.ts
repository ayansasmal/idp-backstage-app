/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// GitHub OAuth provider
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
// AWS Cognito authentication provider (temporarily disabled due to issues)
// backend.add(import('@internal/plugin-auth-backend-module-aws-cognito'));

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin - temporarily disabled for troubleshooting
// backend.add(import('@backstage/plugin-permission-backend'));
// Use basic allow-all policy instead of complex RBAC
// backend.add(import('@backstage/plugin-permission-backend-module-allow-all-policy'));
// Enhanced RBAC permissions instead of allow-all
// backend.add(import('@internal/plugin-permission-backend-module-rbac'));

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend'));

// Custom Phase 1 plugins
// Centralized logging
backend.add(import('@internal/plugin-logging'));

// Argo Workflows integration
backend.add(import('@internal/plugin-argo-workflows'));

// Unleash feature flags integration
backend.add(import('@internal/plugin-unleash-feature-flags'));

backend.start();
