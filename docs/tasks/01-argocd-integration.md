# ArgoCD Integration

**Task 1: ArgoCD Integration**  
**Priority:** High  
**Objective:** Enable Backstage to discover and display ArgoCD applications and their deployment status

## Overview

This integration provides real-time visibility into ArgoCD applications directly within Backstage, allowing developers to see deployment status, sync information, and navigate to ArgoCD dashboards from the service catalog.

## Tasks

### 1. Install ArgoCD Backstage Plugin

```bash
# Frontend plugin for ArgoCD UI components
yarn workspace app add @roadiehq/backstage-plugin-argo-cd

# Backend plugin for ArgoCD API integration
yarn workspace backend add @roadiehq/backstage-plugin-argo-cd-backend
```

### 2. Configure ArgoCD Backend Plugin

Update `packages/backend/src/index.ts`:

```typescript
// Add ArgoCD backend plugin
backend.add(import('@roadiehq/backstage-plugin-argo-cd-backend'));
```

Update `app-config.yaml`:

```yaml
argocd:
  username: ${ARGOCD_USERNAME}
  password: ${ARGOCD_PASSWORD}
  appLocatorMethods:
    - type: 'config'
      instances:
        - name: argocd-prod
          url: ${ARGOCD_SERVER_URL}
          username: ${ARGOCD_USERNAME}
          password: ${ARGOCD_PASSWORD}
        - name: argocd-staging
          url: ${ARGOCD_STAGING_SERVER_URL}
          username: ${ARGOCD_USERNAME}
          password: ${ARGOCD_PASSWORD}
```

### 3. Add ArgoCD Frontend Components

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import {
  EntityArgoCDOverviewCard,
  EntityArgoCDHistoryCard,
  isArgocdAvailable,
} from '@roadiehq/backstage-plugin-argo-cd';

// Add to serviceEntityPage
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {/* Existing cards */}
        <EntitySwitch>
          <EntitySwitch.Case if={isArgocdAvailable}>
            <Grid item md={6}>
              <EntityArgoCDOverviewCard />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/argocd" title="ArgoCD">
      <EntityArgoCDHistoryCard />
    </EntityLayout.Route>
  </EntityLayout>
);
```

### 4. Entity Annotations Setup

Add ArgoCD annotations to service catalog entities in `examples/entities.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: example-service
  annotations:
    # ArgoCD application name
    argocd/app-name: example-service
    # ArgoCD instance name (from app-config.yaml)
    argocd/instance-name: argocd-prod
    # Optional: ArgoCD project
    argocd/project-name: default
spec:
  type: service
  lifecycle: production
  owner: platform-team
```

For multiple applications:

```yaml
metadata:
  annotations:
    # Multiple ArgoCD applications
    argocd/app-selector: 'app.kubernetes.io/name=example-service'
```

### 5. ArgoCD Application Configuration

Ensure ArgoCD applications are configured with proper labels for discovery:

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: example-service
  namespace: argocd
  labels:
    app.kubernetes.io/name: example-service
  annotations:
    backstage.io/managed-by-location: 'url:https://github.com/org/repo'
spec:
  project: default
  source:
    repoURL: https://github.com/org/example-service
    targetRevision: HEAD
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## Environment Variables Required

```bash
# ArgoCD Server Configuration
ARGOCD_SERVER_URL=https://argocd.idp-platform.local
ARGOCD_USERNAME=<argocd-username>
ARGOCD_PASSWORD=<argocd-password>

# Alternative: Token-based authentication
ARGOCD_AUTH_TOKEN=<argocd-auth-token>

# Staging Environment (Optional)
ARGOCD_STAGING_SERVER_URL=https://argocd-staging.idp-platform.local
```

## Security Configuration

### RBAC for ArgoCD Access

Create service account for Backstage in ArgoCD:

```yaml
# argocd-rbac.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    p, role:backstage, applications, get, *, allow
    p, role:backstage, applications, list, *, allow
    p, role:backstage, repositories, get, *, allow
    p, role:backstage, repositories, list, *, allow
    g, backstage-service-account, role:backstage
```

## Expected Outcomes

### Deployment Visibility

- ✅ View ArgoCD application status directly in Backstage
- ✅ See sync status (Synced, OutOfSync, Unknown)
- ✅ Display health status (Healthy, Progressing, Degraded)
- ✅ Show last sync timestamp and commit information

### Navigation Integration

- ✅ Direct links from Backstage to ArgoCD application dashboard
- ✅ Quick access to ArgoCD logs and events
- ✅ Sync history and deployment timeline

### Service Catalog Integration

- ✅ Automatic discovery of services with ArgoCD applications
- ✅ Service-to-deployment mapping
- ✅ Multi-environment support (prod, staging, dev)

## Advanced Features

### Custom ArgoCD Dashboard

Create custom dashboard in `packages/app/src/components/argocd/ArgoCDDashboard.tsx`:

```typescript
import React from 'react';
import { Page, Header, Content, Grid } from '@backstage/core-components';
import { ArgoCDApiRef } from '@roadiehq/backstage-plugin-argo-cd';

export const ArgoCDDashboardPage = () => {
  return (
    <Page themeId="tool">
      <Header title="ArgoCD Applications" />
      <Content>
        <Grid container spacing={3}>
          {/* Custom ArgoCD application overview */}
        </Grid>
      </Content>
    </Page>
  );
};
```

### Webhook Integration

Configure ArgoCD webhooks to update Backstage in real-time:

```yaml
# argocd-notifications.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
data:
  service.webhook.backstage: |
    url: https://backstage.idp-platform.local/api/argocd/webhook
    headers:
    - name: Authorization
      value: Bearer $webhook-token
  trigger.on-sync-status-unknown: |
    - when: app.status.sync.status == 'Unknown'
      send: [backstage]
  trigger.on-health-degraded: |
    - when: app.status.health.status == 'Degraded'
      send: [backstage]
```

## Troubleshooting

### Common Issues

1. **Connection Failed**

   - Verify ArgoCD server URL and credentials
   - Check network connectivity from Backstage to ArgoCD
   - Validate RBAC permissions

2. **Applications Not Showing**

   - Ensure entity annotations are correct
   - Verify ArgoCD application labels
   - Check ArgoCD project permissions

3. **Authentication Errors**
   - Validate username/password or token
   - Check ArgoCD RBAC configuration
   - Verify service account permissions

### Debug Commands

```bash
# Test ArgoCD connectivity
curl -k -H "Authorization: Bearer $ARGOCD_AUTH_TOKEN" \
  "$ARGOCD_SERVER_URL/api/v1/applications"

# Check Backstage backend logs
kubectl logs -f deployment/backstage-backend -n backstage

# Verify ArgoCD application labels
argocd app list -o yaml | grep -A 5 -B 5 "app.kubernetes.io/name"
```

## Next Steps

1. **Test Integration**: Verify ArgoCD applications appear in Backstage
2. **Configure Annotations**: Add ArgoCD annotations to existing services
3. **Setup Webhooks**: Enable real-time updates from ArgoCD
4. **Train Team**: Onboard developers on ArgoCD visibility features
5. **Monitor Usage**: Track adoption and identify improvement areas

---

**Dependencies**: ArgoCD cluster access, RBAC configuration  
**Estimated Effort**: 1-2 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
