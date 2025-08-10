# Enhanced API Documentation with Validation

**Task 08: API Documentation Integration**  
**Priority:** Medium  
**Objective:** Integrate enhanced API documentation, validation, and discoverability for all platform services in Backstage

## Overview

This task enables platform teams to surface, validate, and manage API documentation for all services, improving developer experience and service discoverability.

## Tasks

### 1. Install API Documentation Dependencies

```bash
# Install required packages
yarn workspace app add @backstage/plugin-api-docs
```

### 2. Configure API Docs Plugin

Update `packages/app/src/App.tsx`:

```typescript
import { ApiExplorerPage } from '@backstage/plugin-api-docs';

// Add route for API Explorer
<Route path="/api-docs" element={<ApiExplorerPage />} />;
```

### 3. Add API Documentation to Entity Page

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import { EntityApiDocsContent } from '@backstage/plugin-api-docs';

// In the service entity case
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {/* Existing overview content */}
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/api-docs" title="API Docs">
      <EntityApiDocsContent />
    </EntityLayout.Route>

    {/* Other existing routes */}
  </EntityLayout>
);
```

### 4. Add OpenAPI/Swagger Documentation to Services

Add OpenAPI/Swagger spec files to each service repository (e.g., `openapi.yaml` or `swagger.json`).

### 5. Annotate Entities for API Docs

Add the following annotation to each service's `catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    backstage.io/kubernetes-id: my-service
    backstage.io/api-docs-ref: url:https://raw.githubusercontent.com/my-org/my-service/main/openapi.yaml
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

## Expected Outcomes

### ✅ **Unified API Documentation**

- All platform services have discoverable API docs in Backstage
- OpenAPI/Swagger validation and rendering
- Improved developer onboarding and experience

### ✅ **Validation and Quality**

- API specs validated for correctness
- Consistent documentation standards
- Automated checks for missing endpoints

## Troubleshooting

### Common Issues

1. **Missing API Docs**

   - Ensure `backstage.io/api-docs-ref` annotation is present
   - Verify OpenAPI/Swagger spec is accessible
   - Check for correct file format and schema

2. **Validation Errors**
   - Use OpenAPI validator tools
   - Fix schema errors and missing fields
   - Ensure all endpoints are documented

### Debug Commands

```bash
# Validate OpenAPI spec
npx @redocly/cli lint openapi.yaml

# Check API docs in Backstage
Visit /api-docs route in Backstage UI
```

## Next Steps

1. **Add API docs to all services**
2. **Automate validation in CI/CD**
3. **Train teams on API documentation standards**

---

**Dependencies**: OpenAPI/Swagger, Backstage API Docs plugin  
**Estimated Effort**: 2-3 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
