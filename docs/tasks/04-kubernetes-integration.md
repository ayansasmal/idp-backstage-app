# Kubernetes Integration

**Task 4: Enhanced Kubernetes Integration**  
**Priority:** High  
**Objective:** Expand existing Kubernetes plugin to provide comprehensive cluster visibility and resource management

## Current State

✅ **Already Installed**: Kubernetes plugin (`@backstage/plugin-kubernetes`) is already configured in the project.

## Tasks

### 1. Configure Multiple Kubernetes Clusters

Update `app-config.yaml` with IDP cluster configurations:

```yaml
kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - url: https://kubernetes.idp-platform.local
          name: idp-production
          authProvider: 'serviceAccount'
          serviceAccountToken: ${KUBERNETES_SERVICE_ACCOUNT_TOKEN}
          dashboardUrl: https://dashboard.kubernetes.idp-platform.local
          dashboardApp: standard
        - url: https://kubernetes-staging.idp-platform.local
          name: idp-staging
          authProvider: 'serviceAccount'
          serviceAccountToken: ${KUBERNETES_STAGING_SERVICE_ACCOUNT_TOKEN}
          dashboardUrl: https://dashboard-staging.kubernetes.idp-platform.local
        - url: https://kubernetes-dev.idp-platform.local
          name: idp-development
          authProvider: 'serviceAccount'
          serviceAccountToken: ${KUBERNETES_DEV_SERVICE_ACCOUNT_TOKEN}
  customResources:
    - group: 'argoproj.io'
      apiVersion: 'v1alpha1'
      plural: 'applications'
    - group: 'networking.istio.io'
      apiVersion: 'v1beta1'
      plural: 'virtualservices'
    - group: 'networking.istio.io'
      apiVersion: 'v1beta1'
      plural: 'destinationrules'
```

### 2. Enhanced Entity Annotations

Update entity definitions in `examples/entities.yaml` with comprehensive Kubernetes annotations:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: example-service
  annotations:
    # Kubernetes cluster and namespace
    backstage.io/kubernetes-id: example-service
    backstage.io/kubernetes-namespace: production
    backstage.io/kubernetes-cluster: idp-production

    # Label selector for resources
    backstage.io/kubernetes-label-selector: 'app.kubernetes.io/name=example-service'

    # Multiple environments
    kubernetes.io/production-cluster: idp-production
    kubernetes.io/staging-cluster: idp-staging
    kubernetes.io/development-cluster: idp-development
spec:
  type: service
  lifecycle: production
  owner: platform-team
```

For services spanning multiple clusters:

```yaml
metadata:
  annotations:
    backstage.io/kubernetes-id: example-service
    # Multi-cluster deployment
    backstage.io/kubernetes-namespace: production,staging,development
    backstage.io/kubernetes-cluster: idp-production,idp-staging,idp-development
```

### 3. Custom Kubernetes Views

Create enhanced Kubernetes components in `packages/app/src/components/kubernetes/`:

#### Enhanced Overview Card

```typescript
// packages/app/src/components/kubernetes/KubernetesOverviewCard.tsx
import React from 'react';
import {
  EntityKubernetesContent,
  isKubernetesAvailable,
} from '@backstage/plugin-kubernetes';
import { InfoCard, Progress, WarningPanel } from '@backstage/core-components';

export const EnhancedKubernetesOverviewCard = () => {
  return (
    <EntitySwitch>
      <EntitySwitch.Case if={isKubernetesAvailable}>
        <InfoCard title="Kubernetes Resources" variant="gridItem">
          <EntityKubernetesContent refreshIntervalMs={30000} />
        </InfoCard>
      </EntitySwitch.Case>
      <EntitySwitch.Case>
        <WarningPanel title="No Kubernetes Resources">
          No Kubernetes resources found for this entity.
        </WarningPanel>
      </EntitySwitch.Case>
    </EntitySwitch>
  );
};
```

#### Resource Health Dashboard

```typescript
// packages/app/src/components/kubernetes/ResourceHealthCard.tsx
import React from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { kubernetesApiRef } from '@backstage/plugin-kubernetes';
import { useApi } from '@backstage/core-plugin-api';

export const ResourceHealthCard = () => {
  const { entity } = useEntity();
  const kubernetesApi = useApi(kubernetesApiRef);

  // Custom logic for resource health monitoring
  return (
    <InfoCard title="Resource Health" variant="gridItem">
      {/* Pod health indicators */}
      {/* Deployment status */}
      {/* Service availability */}
      {/* Recent events */}
    </InfoCard>
  );
};
```

### 4. Update Entity Pages

Enhance `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import {
  EntityKubernetesContent,
  isKubernetesAvailable,
} from '@backstage/plugin-kubernetes';
import { EnhancedKubernetesOverviewCard } from '../kubernetes/KubernetesOverviewCard';
import { ResourceHealthCard } from '../kubernetes/ResourceHealthCard';

// Enhanced service entity page
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {/* Existing overview cards */}

        <EntitySwitch>
          <EntitySwitch.Case if={isKubernetesAvailable}>
            <Grid item md={6}>
              <EnhancedKubernetesOverviewCard />
            </Grid>
            <Grid item md={6}>
              <ResourceHealthCard />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/kubernetes" title="Kubernetes">
      <EntityKubernetesContent refreshIntervalMs={10000} />
    </EntityLayout.Route>
  </EntityLayout>
);
```

### 5. RBAC Configuration

Create service accounts with proper permissions:

```yaml
# kubernetes-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backstage-kubernetes
  namespace: backstage
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backstage-kubernetes-reader
rules:
  - apiGroups: ['']
    resources:
      - pods
      - pods/log
      - pods/status
      - services
      - configmaps
      - secrets
      - persistentvolumes
      - persistentvolumeclaims
      - namespaces
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['apps']
    resources:
      - deployments
      - replicasets
      - statefulsets
      - daemonsets
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['networking.k8s.io']
    resources:
      - ingresses
      - networkpolicies
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['metrics.k8s.io']
    resources:
      - pods
      - nodes
    verbs: ['get', 'list']
  - apiGroups: ['argoproj.io']
    resources:
      - applications
      - appprojects
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['networking.istio.io']
    resources:
      - virtualservices
      - destinationrules
      - gateways
    verbs: ['get', 'list', 'watch']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: backstage-kubernetes-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: backstage-kubernetes-reader
subjects:
  - kind: ServiceAccount
    name: backstage-kubernetes
    namespace: backstage
```

### 6. Custom Resource Definitions

Add support for custom Kubernetes resources:

```typescript
// packages/app/src/components/kubernetes/CustomResources.tsx
import React from 'react';
import { InfoCard, Table, Link } from '@backstage/core-components';

export const CustomResourcesCard = () => {
  return (
    <InfoCard title="Custom Resources" variant="gridItem">
      <Table
        columns={[
          { title: 'Name', field: 'name' },
          { title: 'Kind', field: 'kind' },
          { title: 'Status', field: 'status' },
          { title: 'Age', field: 'age' },
        ]}
        data={
          [
            // ArgoCD Applications
            // Istio VirtualServices
            // Custom CRDs
          ]
        }
      />
    </InfoCard>
  );
};
```

## Environment Variables Required

```bash
# Production Cluster
KUBERNETES_SERVICE_ACCOUNT_TOKEN=<k8s-service-account-token>
KUBERNETES_CLUSTER_URL=https://kubernetes.idp-platform.local
KUBERNETES_CLUSTER_NAME=idp-production

# Staging Cluster
KUBERNETES_STAGING_SERVICE_ACCOUNT_TOKEN=<k8s-staging-token>
KUBERNETES_STAGING_CLUSTER_URL=https://kubernetes-staging.idp-platform.local

# Development Cluster
KUBERNETES_DEV_SERVICE_ACCOUNT_TOKEN=<k8s-dev-token>
KUBERNETES_DEV_CLUSTER_URL=https://kubernetes-dev.idp-platform.local

# Dashboard URLs
KUBERNETES_DASHBOARD_URL=https://dashboard.kubernetes.idp-platform.local
KUBERNETES_STAGING_DASHBOARD_URL=https://dashboard-staging.kubernetes.idp-platform.local
```

## Expected Outcomes

### Real-time Resource Monitoring

- ✅ Pod health and status across multiple clusters
- ✅ Deployment rollout status and history
- ✅ Service availability and endpoint health
- ✅ Resource usage metrics (CPU, memory)
- ✅ Recent events and error conditions

### Multi-Cluster Visibility

- ✅ Production, staging, and development environments
- ✅ Cross-cluster service dependencies
- ✅ Environment-specific resource configurations
- ✅ Cluster health and capacity monitoring

### Developer Experience

- ✅ Quick access to logs and debugging information
- ✅ Resource scaling and management insights
- ✅ Integration with ArgoCD deployment status
- ✅ Custom resource monitoring (Istio, ArgoCD, etc.)

## Advanced Features

### Resource Scaling Insights

```typescript
// Custom hook for resource scaling recommendations
export const useResourceScaling = (entity: Entity) => {
  const kubernetesApi = useApi(kubernetesApiRef);

  // Logic to analyze resource usage and provide scaling recommendations
  return {
    currentReplicas: 3,
    recommendedReplicas: 5,
    cpuUsage: '75%',
    memoryUsage: '60%',
    scalingRecommendation: 'Scale up recommended due to high CPU usage',
  };
};
```

### Cost Monitoring

```typescript
// Integration with cloud cost APIs
export const ResourceCostCard = () => {
  return (
    <InfoCard title="Resource Costs" variant="gridItem">
      {/* Monthly cost breakdown */}
      {/* Cost per replica/pod */}
      {/* Cost optimization suggestions */}
    </InfoCard>
  );
};
```

## Troubleshooting

### Common Issues

1. **Service Account Permissions**

   - Ensure proper RBAC configuration
   - Verify token validity and cluster access
   - Check namespace permissions

2. **Cluster Connectivity**

   - Validate cluster URLs and network access
   - Test service account authentication
   - Verify certificate configuration

3. **Resource Discovery**
   - Check entity annotations format
   - Verify label selectors match resources
   - Ensure namespace exists and is accessible

### Debug Commands

```bash
# Test service account permissions
kubectl auth can-i get pods --as=system:serviceaccount:backstage:backstage-kubernetes

# Verify token validity
kubectl get pods -n production --token=$KUBERNETES_SERVICE_ACCOUNT_TOKEN

# Check resource labels
kubectl get deployments -n production --show-labels

# Test custom resources
kubectl get applications -n argocd
kubectl get virtualservices -n istio-system
```

## Performance Optimization

### Caching Strategy

```yaml
# app-config.yaml
kubernetes:
  # Cache configuration
  cacheTTL: 300 # 5 minutes
  refreshInterval: 30 # 30 seconds

  # Limit resource queries
  objectTypes:
    - 'pods'
    - 'services'
    - 'deployments'
    - 'ingresses'
```

### Resource Filtering

```typescript
// Custom resource filtering
const resourceFilter = {
  // Only show resources from specific namespaces
  namespaces: ['production', 'staging'],

  // Filter by labels
  labelSelector: 'app.kubernetes.io/managed-by=backstage',

  // Limit resource types
  kinds: ['Deployment', 'Service', 'Pod', 'Ingress'],
};
```

## Next Steps

1. **Configure Clusters**: Set up service accounts and RBAC
2. **Test Connectivity**: Verify cluster access from Backstage
3. **Update Entities**: Add Kubernetes annotations to existing services
4. **Monitor Performance**: Track resource usage and optimization
5. **Team Training**: Onboard developers on Kubernetes visibility features

---

**Dependencies**: Kubernetes cluster access, RBAC configuration  
**Estimated Effort**: 2-3 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
