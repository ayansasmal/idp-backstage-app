import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

export interface FeatureFlag {
    name: string;
    displayName?: string;
    description?: string;
    type: 'release' | 'experiment' | 'operational' | 'kill-switch' | 'permission';
    project: string;
    enabled: boolean;
    stale: boolean;
    favorite: boolean;
    impressionData: boolean;
    createdAt: string;
    lastSeenAt?: string;
    environments: FeatureFlagEnvironment[];
    variants?: FeatureFlagVariant[];
    strategies?: FeatureFlagStrategy[];
    tags?: FeatureFlagTag[];
}

export interface FeatureFlagEnvironment {
    name: string;
    displayName: string;
    enabled: boolean;
    strategies: FeatureFlagStrategy[];
}

export interface FeatureFlagStrategy {
    id: string;
    name: string;
    title?: string;
    disabled?: boolean;
    parameters?: Record<string, any>;
    constraints?: FeatureFlagConstraint[];
    variants?: FeatureFlagVariant[];
}

export interface FeatureFlagConstraint {
    contextName: string;
    operator: string;
    values: string[];
    inverted?: boolean;
    caseInsensitive?: boolean;
}

export interface FeatureFlagVariant {
    name: string;
    weight: number;
    weightType: 'fix' | 'variable';
    stickiness?: string;
    payload?: {
        type: 'json' | 'csv' | 'string' | 'number';
        value: string;
    };
    overrides?: FeatureFlagOverride[];
}

export interface FeatureFlagOverride {
    contextName: string;
    values: string[];
}

export interface FeatureFlagTag {
    type: string;
    value: string;
}

export interface CreateFeatureFlagRequest {
    name: string;
    displayName?: string;
    description?: string;
    type?: 'release' | 'experiment' | 'operational' | 'kill-switch' | 'permission';
    project: string;
    impressionData?: boolean;
}

export interface UpdateFeatureFlagRequest {
    displayName?: string;
    description?: string;
    type?: 'release' | 'experiment' | 'operational' | 'kill-switch' | 'permission';
    impressionData?: boolean;
    stale?: boolean;
}

export interface ToggleFeatureFlagRequest {
    environment: string;
    enabled: boolean;
}

export interface TenantEnvironmentApp {
    tenant: string;
    environment: string;
    app: string;
}

export interface FeatureFlagMetrics {
    total: number;
    enabled: number;
    disabled: number;
    stale: number;
    byType: Record<string, number>;
}

export interface UnleashFeatureFlagsApiInterface {
    getFeatureFlags(context: TenantEnvironmentApp): Promise<FeatureFlag[]>;
    getFeatureFlag(context: TenantEnvironmentApp, flagName: string): Promise<FeatureFlag>;
    createFeatureFlag(context: TenantEnvironmentApp, request: CreateFeatureFlagRequest): Promise<FeatureFlag>;
    updateFeatureFlag(context: TenantEnvironmentApp, flagName: string, request: UpdateFeatureFlagRequest): Promise<FeatureFlag>;
    deleteFeatureFlag(context: TenantEnvironmentApp, flagName: string): Promise<void>;
    toggleFeatureFlag(context: TenantEnvironmentApp, flagName: string, request: ToggleFeatureFlagRequest): Promise<void>;
    getFeatureFlagMetrics(context: TenantEnvironmentApp): Promise<FeatureFlagMetrics>;
}

export const unleashFeatureFlagsApiRef = createApiRef<UnleashFeatureFlagsApiInterface>({
    id: 'plugin.unleash-feature-flags.service',
});

export class UnleashFeatureFlagsApi implements UnleashFeatureFlagsApiInterface {
    private readonly discoveryApi: DiscoveryApi;
    private readonly fetchApi: FetchApi;

    constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
        this.discoveryApi = options.discoveryApi;
        this.fetchApi = options.fetchApi;
    }

    private async getBaseUrl(): Promise<string> {
        return await this.discoveryApi.getBaseUrl('unleash-feature-flags');
    }

    private buildQueryParams(context: TenantEnvironmentApp): string {
        return new URLSearchParams({
            tenant: context.tenant,
            environment: context.environment,
            app: context.app,
        }).toString();
    }

    async getFeatureFlags(context: TenantEnvironmentApp): Promise<FeatureFlag[]> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = this.buildQueryParams(context);

        const response = await this.fetchApi.fetch(`${baseUrl}/feature-flags?${queryParams}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch feature flags: ${response.statusText}`);
        }

        const data = await response.json();
        return data.featureFlags || [];
    }

    async getFeatureFlag(context: TenantEnvironmentApp, flagName: string): Promise<FeatureFlag> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = this.buildQueryParams(context);

        const response = await this.fetchApi.fetch(`${baseUrl}/feature-flags/${encodeURIComponent(flagName)}?${queryParams}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch feature flag: ${response.statusText}`);
        }

        const data = await response.json();
        return data.featureFlag;
    }

    async createFeatureFlag(context: TenantEnvironmentApp, request: CreateFeatureFlagRequest): Promise<FeatureFlag> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = this.buildQueryParams(context);

        const response = await this.fetchApi.fetch(`${baseUrl}/feature-flags?${queryParams}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`Failed to create feature flag: ${response.statusText}`);
        }

        const data = await response.json();
        return data.featureFlag;
    }

    async updateFeatureFlag(context: TenantEnvironmentApp, flagName: string, request: UpdateFeatureFlagRequest): Promise<FeatureFlag> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = this.buildQueryParams(context);

        const response = await this.fetchApi.fetch(`${baseUrl}/feature-flags/${encodeURIComponent(flagName)}?${queryParams}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`Failed to update feature flag: ${response.statusText}`);
        }

        const data = await response.json();
        return data.featureFlag;
    }

    async deleteFeatureFlag(context: TenantEnvironmentApp, flagName: string): Promise<void> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = this.buildQueryParams(context);

        const response = await this.fetchApi.fetch(`${baseUrl}/feature-flags/${encodeURIComponent(flagName)}?${queryParams}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`Failed to delete feature flag: ${response.statusText}`);
        }
    }

    async toggleFeatureFlag(context: TenantEnvironmentApp, flagName: string, request: ToggleFeatureFlagRequest): Promise<void> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = this.buildQueryParams(context);

        const response = await this.fetchApi.fetch(`${baseUrl}/feature-flags/${encodeURIComponent(flagName)}/toggle?${queryParams}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`Failed to toggle feature flag: ${response.statusText}`);
        }
    }

    async getFeatureFlagMetrics(context: TenantEnvironmentApp): Promise<FeatureFlagMetrics> {
        const baseUrl = await this.getBaseUrl();
        const queryParams = this.buildQueryParams(context);

        const response = await this.fetchApi.fetch(`${baseUrl}/metrics?${queryParams}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch feature flag metrics: ${response.statusText}`);
        }

        const data = await response.json();
        return data.metrics;
    }
}
