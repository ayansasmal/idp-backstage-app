import {
    createBackendModule,
    coreServices,
} from '@backstage/backend-plugin-api';
import { RBACPermissionPolicy, defaultRBACConfig, RBACConfig } from './policy';

/**
 * Creates an RBAC permission policy factory
 */
export function createRBACPermissionPolicy(config?: RBACConfig): RBACPermissionPolicy {
    return new RBACPermissionPolicy(config || defaultRBACConfig);
}

/**
 * Backend module for RBAC permissions
 */
export const permissionModuleRBAC = createBackendModule({
    pluginId: 'permission',
    moduleId: 'rbac-policy',
    register(reg) {
        reg.registerInit({
            deps: {
                config: coreServices.rootConfig,
                logger: coreServices.logger,
            },
            async init({ config, logger }) {
                // Load RBAC configuration
                const rbacConfig = loadRBACConfig(config);

                logger.info('RBAC Configuration loaded successfully', {
                    rolesCount: Object.keys(rbacConfig.roles).length,
                    userRolesCount: Object.keys(rbacConfig.userRoles).length,
                    groupRolesCount: Object.keys(rbacConfig.groupRoles).length,
                    superAdminsCount: rbacConfig.superAdmins.length,
                });

                // The policy will be created when needed via createRBACPermissionPolicy
            },
        });
    },
});

/**
 * Load RBAC configuration from app-config.yaml
 */
function loadRBACConfig(config: any): RBACConfig {
    const permissionConfig = config.getOptionalConfig('permission');
    const rbacConfig = permissionConfig?.getOptionalConfig('rbac');

    if (!rbacConfig) {
        // Return default configuration if no RBAC config is provided
        return defaultRBACConfig;
    }

    return {
        roles: rbacConfig.getOptionalConfigArray('roles')?.reduce((acc: any, roleConfig: any) => {
            const name = roleConfig.getString('name');
            acc[name] = {
                name: roleConfig.getString('displayName') || name,
                description: roleConfig.getOptionalString('description') || '',
                permissions: roleConfig.getStringArray('permissions'),
                resources: roleConfig.getOptional('resources'),
            };
            return acc;
        }, {}) || defaultRBACConfig.roles,

        userRoles: rbacConfig.getOptional('userRoles') || defaultRBACConfig.userRoles,
        groupRoles: rbacConfig.getOptional('groupRoles') || defaultRBACConfig.groupRoles,
        superAdmins: rbacConfig.getOptionalStringArray('superAdmins') || defaultRBACConfig.superAdmins,
    };
}
