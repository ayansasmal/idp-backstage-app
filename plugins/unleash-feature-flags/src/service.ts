import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { NotFoundError, ConflictError } from '@backstage/errors';
import fetch from 'node-fetch';

export interface UnleashConfig {
    baseUrl: string;
    adminApiKey: string;
    clientApiKey?: string;
    defaultProject?: string;
}

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
    operator: 'IN' | 'NOT_IN' | 'STR_CONTAINS' | 'STR_STARTS_WITH' | 'STR_ENDS_WITH' | 'NUM_EQ' | 'NUM_GT' | 'NUM_GTE' | 'NUM_LT' | 'NUM_LTE' | 'DATE_AFTER' | 'DATE_BEFORE' | 'SEMVER_EQ' | 'SEMVER_GT' | 'SEMVER_LT';
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

export interface Project {
    id: string;
    name: string;
    description?: string;
    health?: number;
    createdAt: string;
    updatedAt?: string;
    mode: 'open' | 'protected' | 'private';
    defaultStickiness?: string;
    environments?: string[];
}

export interface Environment {
    name: string;
    displayName: string;
    type: string;
    enabled: boolean;
    protected: boolean;
    sortOrder: number;
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

/**
 * Service for managing Unleash feature flags with tenant.environment.app context
 */
export class UnleashService {
    private config: UnleashConfig;
    private logger: LoggerService;
    private baseHeaders: Record<string, string>;

    constructor(config: UnleashConfig, logger: LoggerService) {
        this.config = config;
        this.logger = logger;
        this.baseHeaders = {
            'Content-Type': 'application/json',
            'Authorization': this.config.adminApiKey,
        };
    }

    /**
     * Get all projects
     */
    async getProjects(): Promise<Project[]> {
        try {
            const response = await fetch(`${this.config.baseUrl}/api/admin/projects`, {
                method: 'GET',
                headers: this.baseHeaders,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch projects: ${response.statusText}`);
            }

            const data = await response.json() as any;
            return data.projects || [];
        } catch (error) {
            this.logger.error('Failed to get projects', { error });
            throw error;
        }
    }

    /**
     * Get all environments
     */
    async getEnvironments(): Promise<Environment[]> {
        try {
            const response = await fetch(`${this.config.baseUrl}/api/admin/environments`, {
                method: 'GET',
                headers: this.baseHeaders,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch environments: ${response.statusText}`);
            }

            const data = await response.json() as any;
            return data.environments || [];
        } catch (error) {
            this.logger.error('Failed to get environments', { error });
            throw error;
        }
    }

    /**
     * Get feature flags for a specific tenant.environment.app context
     */
    async getFeatureFlags(context: TenantEnvironmentApp): Promise<FeatureFlag[]> {
        try {
            const projectName = this.buildProjectName(context);
            const response = await fetch(`${this.config.baseUrl}/api/admin/projects/${projectName}/features`, {
                method: 'GET',
                headers: this.baseHeaders,
            });

            if (response.status === 404) {
                // Project doesn't exist, return empty array
                return [];
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch feature flags: ${response.statusText}`);
            }

            const data = await response.json() as any;
            return this.transformFeatureFlags(data.features || []);
        } catch (error) {
            this.logger.error('Failed to get feature flags', { context, error });
            throw error;
        }
    }

    /**
     * Get a specific feature flag
     */
    async getFeatureFlag(context: TenantEnvironmentApp, flagName: string): Promise<FeatureFlag> {
        try {
            const projectName = this.buildProjectName(context);
            const response = await fetch(`${this.config.baseUrl}/api/admin/projects/${projectName}/features/${flagName}`, {
                method: 'GET',
                headers: this.baseHeaders,
            });

            if (response.status === 404) {
                throw new NotFoundError(`Feature flag ${flagName} not found`);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch feature flag: ${response.statusText}`);
            }

            const data = await response.json() as any;
            return this.transformFeatureFlag(data);
        } catch (error) {
            this.logger.error('Failed to get feature flag', { context, flagName, error });
            throw error;
        }
    }

    /**
     * Create a new feature flag
     */
    async createFeatureFlag(context: TenantEnvironmentApp, request: CreateFeatureFlagRequest): Promise<FeatureFlag> {
        try {
            // Ensure project exists
            await this.ensureProjectExists(context);

            const projectName = this.buildProjectName(context);
            const flagData = {
                ...request,
                project: projectName,
                name: this.buildFlagName(context, request.name),
            };

            const response = await fetch(`${this.config.baseUrl}/api/admin/projects/${projectName}/features`, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify(flagData),
            });

            if (response.status === 409) {
                throw new ConflictError(`Feature flag ${request.name} already exists`);
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create feature flag: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json() as any;
            return this.transformFeatureFlag(data);
        } catch (error) {
            this.logger.error('Failed to create feature flag', { context, request, error });
            throw error;
        }
    }

    /**
     * Update a feature flag
     */
    async updateFeatureFlag(context: TenantEnvironmentApp, flagName: string, request: UpdateFeatureFlagRequest): Promise<FeatureFlag> {
        try {
            const projectName = this.buildProjectName(context);
            const fullFlagName = this.buildFlagName(context, flagName);

            const response = await fetch(`${this.config.baseUrl}/api/admin/projects/${projectName}/features/${fullFlagName}`, {
                method: 'PUT',
                headers: this.baseHeaders,
                body: JSON.stringify(request),
            });

            if (response.status === 404) {
                throw new NotFoundError(`Feature flag ${flagName} not found`);
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update feature flag: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json() as any;
            return this.transformFeatureFlag(data);
        } catch (error) {
            this.logger.error('Failed to update feature flag', { context, flagName, request, error });
            throw error;
        }
    }

    /**
     * Delete a feature flag
     */
    async deleteFeatureFlag(context: TenantEnvironmentApp, flagName: string): Promise<void> {
        try {
            const projectName = this.buildProjectName(context);
            const fullFlagName = this.buildFlagName(context, flagName);

            const response = await fetch(`${this.config.baseUrl}/api/admin/projects/${projectName}/features/${fullFlagName}`, {
                method: 'DELETE',
                headers: this.baseHeaders,
            });

            if (response.status === 404) {
                throw new NotFoundError(`Feature flag ${flagName} not found`);
            }

            if (!response.ok) {
                throw new Error(`Failed to delete feature flag: ${response.statusText}`);
            }

            this.logger.info('Feature flag deleted successfully', { context, flagName });
        } catch (error) {
            this.logger.error('Failed to delete feature flag', { context, flagName, error });
            throw error;
        }
    }

    /**
     * Toggle feature flag in environment
     */
    async toggleFeatureFlag(context: TenantEnvironmentApp, flagName: string, request: ToggleFeatureFlagRequest): Promise<void> {
        try {
            const projectName = this.buildProjectName(context);
            const fullFlagName = this.buildFlagName(context, flagName);
            const environmentName = this.buildEnvironmentName(context, request.environment);

            const endpoint = request.enabled ? 'on' : 'off';
            const response = await fetch(`${this.config.baseUrl}/api/admin/projects/${projectName}/features/${fullFlagName}/environments/${environmentName}/${endpoint}`, {
                method: 'POST',
                headers: this.baseHeaders,
            });

            if (response.status === 404) {
                throw new NotFoundError(`Feature flag ${flagName} or environment ${request.environment} not found`);
            }

            if (!response.ok) {
                throw new Error(`Failed to toggle feature flag: ${response.statusText}`);
            }

            this.logger.info('Feature flag toggled successfully', { context, flagName, environment: request.environment, enabled: request.enabled });
        } catch (error) {
            this.logger.error('Failed to toggle feature flag', { context, flagName, request, error });
            throw error;
        }
    }

    /**
     * Get feature flag strategies for a specific environment
     */
    async getFeatureFlagStrategies(context: TenantEnvironmentApp, flagName: string, environment: string): Promise<FeatureFlagStrategy[]> {
        try {
            const projectName = this.buildProjectName(context);
            const fullFlagName = this.buildFlagName(context, flagName);
            const environmentName = this.buildEnvironmentName(context, environment);

            const response = await fetch(`${this.config.baseUrl}/api/admin/projects/${projectName}/features/${fullFlagName}/environments/${environmentName}/strategies`, {
                method: 'GET',
                headers: this.baseHeaders,
            });

            if (response.status === 404) {
                throw new NotFoundError(`Feature flag ${flagName} or environment ${environment} not found`);
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch feature flag strategies: ${response.statusText}`);
            }

            const data = await response.json() as any;
            return data || [];
        } catch (error) {
            this.logger.error('Failed to get feature flag strategies', { context, flagName, environment, error });
            throw error;
        }
    }

    private buildProjectName(context: TenantEnvironmentApp): string {
        return `${context.tenant}-${context.environment}-${context.app}`;
    }

    private buildFlagName(context: TenantEnvironmentApp, flagName: string): string {
        return `${context.tenant}.${context.environment}.${context.app}.${flagName}`;
    }

    private buildEnvironmentName(context: TenantEnvironmentApp, environment: string): string {
        return `${context.tenant}-${environment}`;
    }

    private async ensureProjectExists(context: TenantEnvironmentApp): Promise<void> {
        const projectName = this.buildProjectName(context);

        try {
            // Check if project exists
            const response = await fetch(`${this.config.baseUrl}/api/admin/projects/${projectName}`, {
                method: 'GET',
                headers: this.baseHeaders,
            });

            if (response.ok) {
                return; // Project exists
            }

            if (response.status === 404) {
                // Create project
                const createResponse = await fetch(`${this.config.baseUrl}/api/admin/projects`, {
                    method: 'POST',
                    headers: this.baseHeaders,
                    body: JSON.stringify({
                        id: projectName,
                        name: projectName,
                        description: `Auto-created project for ${context.tenant}.${context.environment}.${context.app}`,
                        mode: 'open',
                    }),
                });

                if (!createResponse.ok) {
                    throw new Error(`Failed to create project: ${createResponse.statusText}`);
                }

                this.logger.info('Project created successfully', { projectName, context });
            } else {
                throw new Error(`Failed to check project existence: ${response.statusText}`);
            }
        } catch (error) {
            this.logger.error('Failed to ensure project exists', { projectName, context, error });
            throw error;
        }
    }

    private transformFeatureFlags(features: any[]): FeatureFlag[] {
        return features.map(feature => this.transformFeatureFlag(feature));
    }

    private transformFeatureFlag(feature: any): FeatureFlag {
        return {
            name: feature.name,
            displayName: feature.description || feature.name,
            description: feature.description,
            type: feature.type || 'release',
            project: feature.project,
            enabled: feature.enabled || false,
            stale: feature.stale || false,
            favorite: feature.favorite || false,
            impressionData: feature.impressionData || false,
            createdAt: feature.createdAt,
            lastSeenAt: feature.lastSeenAt,
            environments: feature.environments || [],
            variants: feature.variants || [],
            strategies: feature.strategies || [],
            tags: feature.tags || [],
        };
    }

    /**
     * Get feature flag usage metrics
     */
    async getFeatureFlagMetrics(context: TenantEnvironmentApp): Promise<{
        total: number;
        enabled: number;
        disabled: number;
        stale: number;
        byType: Record<string, number>;
    }> {
        try {
            const flags = await this.getFeatureFlags(context);

            const metrics = {
                total: flags.length,
                enabled: 0,
                disabled: 0,
                stale: 0,
                byType: {} as Record<string, number>,
            };

            for (const flag of flags) {
                if (flag.enabled) {
                    metrics.enabled++;
                } else {
                    metrics.disabled++;
                }

                if (flag.stale) {
                    metrics.stale++;
                }

                metrics.byType[flag.type] = (metrics.byType[flag.type] || 0) + 1;
            }

            return metrics;
        } catch (error) {
            this.logger.error('Failed to get feature flag metrics', { context, error });
            throw error;
        }
    }
}
