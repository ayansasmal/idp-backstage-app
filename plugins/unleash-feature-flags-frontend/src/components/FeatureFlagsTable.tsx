import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
    Table,
    TableColumn,
    Progress,
    ResponseErrorPanel,
} from '@backstage/core-components';
import {
    Chip,
    IconButton,
    Tooltip,
    Switch,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@material-ui/core';
import {
    MoreVert as MoreIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Info as InfoIcon,
} from '@material-ui/icons';
import { Alert } from '@material-ui/lab';
import { FeatureFlag, TenantEnvironmentApp, unleashFeatureFlagsApiRef } from '../api';

interface FeatureFlagsTableProps {
    context: TenantEnvironmentApp;
}

export const FeatureFlagsTable = ({ context }: FeatureFlagsTableProps) => {
    const api = useApi(unleashFeatureFlagsApiRef);
    const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);

    useEffect(() => {
        const fetchFeatureFlags = async () => {
            try {
                setLoading(true);
                setError(null);
                const flags = await api.getFeatureFlags(context);
                setFeatureFlags(flags);
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Unknown error'));
            } finally {
                setLoading(false);
            }
        };

        fetchFeatureFlags();
    }, [api, context]);

    const handleToggleFlag = async (flag: FeatureFlag, environment: string, enabled: boolean) => {
        try {
            await api.toggleFeatureFlag(context, flag.name, { environment, enabled });
            // Refresh the flags
            const flags = await api.getFeatureFlags(context);
            setFeatureFlags(flags);
        } catch (err) {
            console.error('Failed to toggle feature flag:', err);
        }
    };

    const handleDeleteFlag = async (flagName: string) => {
        try {
            await api.deleteFeatureFlag(context, flagName);
            // Refresh the flags
            const flags = await api.getFeatureFlags(context);
            setFeatureFlags(flags);
            setAnchorEl(null);
            setSelectedFlag(null);
        } catch (err) {
            console.error('Failed to delete feature flag:', err);
        }
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, flag: FeatureFlag) => {
        setAnchorEl(event.currentTarget);
        setSelectedFlag(flag);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedFlag(null);
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'release':
                return 'primary';
            case 'experiment':
                return 'secondary';
            case 'operational':
                return 'default';
            case 'kill-switch':
                return 'error';
            case 'permission':
                return 'warning';
            default:
                return 'default';
        }
    };

    const columns: TableColumn[] = [
        {
            title: 'Name',
            field: 'name',
            render: (row: FeatureFlag) => (
                <div>
                    <div style={{ fontWeight: 'bold' }}>{row.displayName || row.name}</div>
                    <div style={{ fontSize: '0.8em', color: 'gray' }}>{row.name}</div>
                </div>
            ),
        },
        {
            title: 'Type',
            field: 'type',
            render: (row: FeatureFlag) => (
                <Chip
                    label={row.type}
                    color={getTypeColor(row.type) as any}
                    size="small"
                    variant="outlined"
                />
            ),
        },
        {
            title: 'Description',
            field: 'description',
            render: (row: FeatureFlag) => row.description || '-',
        },
        {
            title: 'Status',
            field: 'enabled',
            render: (row: FeatureFlag) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Chip
                        label={row.enabled ? 'Enabled' : 'Disabled'}
                        color={row.enabled ? 'primary' : 'default'}
                        size="small"
                    />
                    {row.stale && (
                        <Chip label="Stale" color="secondary" size="small" variant="outlined" />
                    )}
                </div>
            ),
        },
        {
            title: 'Environments',
            field: 'environments',
            render: (row: FeatureFlag) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {row.environments?.map((env) => (
                        <div key={env.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ minWidth: '80px', fontSize: '0.9em' }}>{env.displayName}</span>
                            <Switch
                                checked={env.enabled}
                                onChange={(event) => handleToggleFlag(row, env.name, event.target.checked)}
                                size="small"
                                color="primary"
                            />
                        </div>
                    ))}
                </div>
            ),
        },
        {
            title: 'Created',
            field: 'createdAt',
            render: (row: FeatureFlag) => new Date(row.createdAt).toLocaleDateString(),
        },
        {
            title: 'Actions',
            field: 'actions',
            render: (row: FeatureFlag) => (
                <div>
                    <Tooltip title="More actions">
                        <IconButton
                            size="small"
                            onClick={(event) => handleMenuOpen(event, row)}
                        >
                            <MoreIcon />
                        </IconButton>
                    </Tooltip>
                </div>
            ),
        },
    ];

    if (loading) {
        return <Progress />;
    }

    if (error) {
        return <ResponseErrorPanel error={error} />;
    }

    return (
        <>
            <Table
                title="Feature Flags"
                options={{
                    search: true,
                    paging: true,
                    pageSize: 10,
                    pageSizeOptions: [5, 10, 20, 50],
                }}
                columns={columns}
                data={featureFlags}
                emptyContent={
                    <div style={{ textAlign: 'center', padding: '32px' }}>
                        <InfoIcon style={{ fontSize: '48px', color: 'gray', marginBottom: '16px' }} />
                        <div>No feature flags found for this context.</div>
                        <div style={{ color: 'gray', marginTop: '8px' }}>
                            Create your first feature flag to get started.
                        </div>
                    </div>
                }
            />

            {/* Actions Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleMenuClose}>
                    <ListItemIcon>
                        <EditIcon />
                    </ListItemIcon>
                    <ListItemText primary="Edit" />
                </MenuItem>
                <MenuItem
                    onClick={() => selectedFlag && handleDeleteFlag(selectedFlag.name)}
                    style={{ color: 'red' }}
                >
                    <ListItemIcon>
                        <DeleteIcon style={{ color: 'red' }} />
                    </ListItemIcon>
                    <ListItemText primary="Delete" />
                </MenuItem>
            </Menu>
        </>
    );
};
