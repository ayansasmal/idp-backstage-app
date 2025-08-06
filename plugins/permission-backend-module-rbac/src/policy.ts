import {
    PolicyDecision,
    AuthorizeResult,
} from '@backstage/plugin-permission-common';
import {
    PermissionPolicy,
    PolicyQuery,
} from '@backstage/plugin-permission-node';
import { BackstageIdentityResponse } from '@backstage/plugin-auth-node';

export interface RoleDefinition {
    name: string;
    description: string;
    permissions: string[];
    resources?: {
        [resourceType: string]: {
            allow?: string[];
            deny?: string[];
        };
    };
}

export interface RBACConfig {
    roles: Record<string, RoleDefinition>;
    userRoles: Record<string, string[]>;
    groupRoles: Record<string, string[]>;
    superAdmins: string[];
}

/**
 * Enhanced RBAC Permission Policy with AWS Cognito integration
 */
export class RBACPermissionPolicy implements PermissionPolicy {
    private config: RBACConfig;

    constructor(config: RBACConfig) {
        this.config = config;
    }

    async handle(
        request: PolicyQuery,
        user?: BackstageIdentityResponse,
    ): Promise<PolicyDecision> {
        // Allow super admins to do everything
        if (user && this.isSuperAdmin(user)) {
            return { result: AuthorizeResult.ALLOW };
        }

        // Get user roles
        const userRoles = this.getUserRoles(user);

        if (userRoles.length === 0) {
            // No roles assigned - deny by default
            return { result: AuthorizeResult.DENY };
        }

        // Check permission against user roles
        const permission = request.permission;

        // Handle resource permissions
        if (permission.resourceType) {
            return this.handleResourcePermission(request, userRoles);
        }

        // Handle basic permissions
        return this.handleBasicPermission(permission.name, userRoles);
    }

    private isSuperAdmin(user: BackstageIdentityResponse): boolean {
        const userRef = user.identity.userEntityRef;
        const ownershipEntityRefs = user.identity.ownershipEntityRefs || [];

        // Check user entity ref
        if (this.config.superAdmins.includes(userRef)) {
            return true;
        }

        // Check ownership entity refs (could include group memberships)
        return ownershipEntityRefs.some(ref => this.config.superAdmins.includes(ref));
    }

    private getUserRoles(user?: BackstageIdentityResponse): string[] {
        if (!user) return [];

        const userRef = user.identity.userEntityRef;
        const ownershipEntityRefs = user.identity.ownershipEntityRefs || [];

        let roles: string[] = [];

        // Add roles from direct user mapping
        if (this.config.userRoles[userRef]) {
            roles = [...roles, ...this.config.userRoles[userRef]];
        }

        // Add roles from group mapping (ownership refs can include groups)
        for (const entityRef of ownershipEntityRefs) {
            if (this.config.groupRoles[entityRef]) {
                roles = [...roles, ...this.config.groupRoles[entityRef]];
            }

            // Handle simple group names (for AWS Cognito groups)
            const groupName = entityRef.split('/').pop();
            if (groupName && this.config.groupRoles[groupName]) {
                roles = [...roles, ...this.config.groupRoles[groupName]];
            }
        }

        // Remove duplicates
        return [...new Set(roles)];
    }

    private handleBasicPermission(permissionName: string, userRoles: string[]): PolicyDecision {
        for (const roleName of userRoles) {
            const role = this.config.roles[roleName];
            if (role && (role.permissions.includes('*') || role.permissions.includes(permissionName))) {
                return { result: AuthorizeResult.ALLOW };
            }
        }
        return { result: AuthorizeResult.DENY };
    }

    private handleResourcePermission(
        request: PolicyQuery,
        userRoles: string[],
    ): PolicyDecision {
        const permission = request.permission;
        const resourceRef = (request as any).resourceRef;

        if (!resourceRef) {
            // No resource specified, check basic permission
            return this.handleBasicPermission(permission.name, userRoles);
        }

        // Extract resource type and identifier
        const resourceType = permission.resourceType || 'unknown';
        const resourceName = resourceRef.split('/').pop() || resourceRef;

        for (const roleName of userRoles) {
            const role = this.config.roles[roleName];
            if (!role || (!role.permissions.includes('*') && !role.permissions.includes(permission.name))) {
                continue;
            }

            // Check resource-level permissions
            if (role.resources && role.resources[resourceType]) {
                const resourceRules = role.resources[resourceType];

                // Check deny rules first
                if (resourceRules.deny && this.matchesPattern(resourceName, resourceRules.deny)) {
                    continue; // This role is denied for this resource
                }

                // Check allow rules
                if (resourceRules.allow && this.matchesPattern(resourceName, resourceRules.allow)) {
                    return { result: AuthorizeResult.ALLOW };
                }

                // If no specific resource rules, allow if permission is granted
                if (!resourceRules.allow && !resourceRules.deny) {
                    return { result: AuthorizeResult.ALLOW };
                }
            } else {
                // No resource rules, allow if permission is granted
                return { result: AuthorizeResult.ALLOW };
            }
        }

        return { result: AuthorizeResult.DENY };
    }

    private matchesPattern(resourceName: string, patterns: string[]): boolean {
        return patterns.some(pattern => {
            if (pattern === '*') return true;
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(resourceName);
            }
            return pattern === resourceName;
        });
    }
}

/**
 * Default RBAC configuration with common roles
 */
export const defaultRBACConfig: RBACConfig = {
    roles: {
        // Super Admin - Full access
        'super-admin': {
            name: 'Super Admin',
            description: 'Full administrative access to all resources',
            permissions: ['*'],
        },

        // Platform Admin - Platform management
        'platform-admin': {
            name: 'Platform Admin',
            description: 'Platform administration and user management',
            permissions: [
                'catalog.entity.create',
                'catalog.entity.delete',
                'catalog.entity.refresh',
                'scaffolder.action.execute',
                'scaffolder.task.read',
                'scaffolder.task.create',
            ],
        },

        // Developer - Development activities
        'developer': {
            name: 'Developer',
            description: 'Standard developer access for creating and managing services',
            permissions: [
                'catalog.entity.read',
                'catalog.entity.create',
                'scaffolder.template.parameter.read',
                'scaffolder.action.execute',
                'scaffolder.task.read',
                'scaffolder.task.create',
            ],
            resources: {
                'catalog-entity': {
                    allow: ['*'],
                    deny: ['system-*'], // Cannot access system components
                },
                'scaffolder-template': {
                    allow: ['*'],
                },
            },
        },

        // Read Only - View access only
        'read-only': {
            name: 'Read Only',
            description: 'Read-only access to catalog and documentation',
            permissions: [
                'catalog.entity.read',
                'scaffolder.template.parameter.read',
                'techdocs.read',
            ],
        },

        // Team Lead - Team management
        'team-lead': {
            name: 'Team Lead',
            description: 'Team leadership with extended permissions',
            permissions: [
                'catalog.entity.read',
                'catalog.entity.create',
                'catalog.entity.refresh',
                'scaffolder.template.parameter.read',
                'scaffolder.action.execute',
                'scaffolder.task.read',
                'scaffolder.task.create',
            ],
            resources: {
                'catalog-entity': {
                    allow: ['*'],
                },
                'user': {
                    allow: ['team-*'], // Can manage team members
                },
            },
        },

        // Guest - Limited access
        'guest': {
            name: 'Guest',
            description: 'Limited guest access',
            permissions: [
                'catalog.entity.read',
                'techdocs.read',
            ],
            resources: {
                'catalog-entity': {
                    allow: ['public-*'], // Only public components
                },
            },
        },
    },

    userRoles: {
        // Example user role mappings
        // 'user:default/john.doe': ['developer', 'team-lead'],
        // 'user:default/jane.smith': ['platform-admin'],
    },

    groupRoles: {
        // AWS Cognito group to role mappings
        'Administrators': ['platform-admin'],
        'Developers': ['developer'],
        'TeamLeads': ['team-lead'],
        'ReadOnly': ['read-only'],
        'Guests': ['guest'],

        // Group entity refs
        'group:default/administrators': ['platform-admin'],
        'group:default/developers': ['developer'],
        'group:default/team-leads': ['team-lead'],
        'group:default/readonly': ['read-only'],
    },

    superAdmins: [
        // Add super admin user references or group references
        // 'user:default/admin',
        // 'group:default/super-admins',
    ],
};
