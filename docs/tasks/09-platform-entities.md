# Service Catalog for IDP Platform Components

**Task 09: Platform Entities**  
**Priority:** Medium  
**Objective:** Build a comprehensive service catalog for all IDP platform components in Backstage

## Overview

This task enables platform teams to register, discover, and manage all platform services, infrastructure, and resources in a unified Backstage catalog.

## Tasks

### 1. Define Platform Entities

Create `catalog-info.yaml` for each platform component (service, infrastructure, resource):

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: platform-service
  description: Core platform service for IDP
  annotations:
    backstage.io/kubernetes-id: platform-service
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

### 2. Register Entities in Backstage Catalog

Add entity YAML files to `catalog-info.yaml` in the root of each repository or in a central catalog directory.

### 3. Add Entity Page Tabs

Update `packages/app/src/components/catalog/EntityPage.tsx` to include tabs for platform services, infrastructure, and resources.

### 4. Annotate Entities for Discovery

Add relevant annotations for Kubernetes, GitOps, monitoring, and API docs:

```yaml
metadata:
  annotations:
    backstage.io/kubernetes-id: platform-service
    argocd.argoproj.io/instance: platform-service
    prometheus.io/scrape: 'true'
    backstage.io/api-docs-ref: url:https://raw.githubusercontent.com/my-org/platform-service/main/openapi.yaml
```

### 5. Organize Catalog Groups

Group entities by type, owner, system, and lifecycle for easy navigation in Backstage.

## Expected Outcomes

### ✅ **Unified Service Catalog**

- All platform components registered and discoverable
- Consistent metadata and annotations
- Easy navigation and ownership tracking

### ✅ **Integrated Platform Management**

- Cross-service visibility and relationships
- Centralized resource and infrastructure management
- Enhanced developer experience

## Troubleshooting

### Common Issues

1. **Missing Entities**

   - Ensure all services and resources have `catalog-info.yaml`
   - Check for correct annotations and metadata
   - Validate catalog registration in Backstage

2. **Navigation Issues**
   - Organize entities by groups and tags
   - Use Backstage search and filters

### Debug Commands

```bash
# Validate catalog registration
curl http://localhost:7000/api/catalog/entities

# Check entity metadata
cat catalog-info.yaml
```

## Next Steps

1. **Register all platform components**
2. **Automate catalog updates in CI/CD**
3. **Train teams on catalog usage and standards**

---

**Dependencies**: Backstage catalog, platform services, infrastructure resources  
**Estimated Effort**: 2-3 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
