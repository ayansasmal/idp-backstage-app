import React, { useState } from 'react';
import {
    Page,
    Header,
    Content,
    InfoCard,
    SupportButton,
} from '@backstage/core-components';
import {
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Typography,
    Box,
} from '@material-ui/core';
import { Add as AddIcon } from '@material-ui/icons';
import { TenantEnvironmentApp } from '../api';
import { FeatureFlagsTable } from './FeatureFlagsTable';
import { FeatureFlagMetrics } from './FeatureFlagMetrics';
import { CreateFeatureFlagDialog } from './CreateFeatureFlagDialog';

export const FeatureFlagsPage = () => {
    const [context, setContext] = useState<TenantEnvironmentApp>({
        tenant: '',
        environment: '',
        app: '',
    });
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const isContextValid = context.tenant && context.environment && context.app;

    const handleContextChange = (field: keyof TenantEnvironmentApp, value: string) => {
        setContext(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Page themeId="tool">
            <Header title="Feature Flags Management" subtitle="Manage feature flags across tenants, environments, and applications">
                <SupportButton>
                    Manage feature flags using Unleash OSS with tenant.environment.app scoping.
                    Configure feature flags per tenant, environment, and application.
                </SupportButton>
            </Header>

            <Content>
                <Grid container spacing={3}>
                    {/* Context Selection */}
                    <Grid item xs={12}>
                        <InfoCard title="Context Selection">
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={3}>
                                    <FormControl fullWidth variant="outlined" size="small">
                                        <InputLabel>Tenant</InputLabel>
                                        <Select
                                            value={context.tenant}
                                            onChange={(e) => handleContextChange('tenant', e.target.value as string)}
                                            label="Tenant"
                                        >
                                            <MenuItem value="acme">ACME Corp</MenuItem>
                                            <MenuItem value="globex">Globex Inc</MenuItem>
                                            <MenuItem value="initech">Initech</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={3}>
                                    <FormControl fullWidth variant="outlined" size="small">
                                        <InputLabel>Environment</InputLabel>
                                        <Select
                                            value={context.environment}
                                            onChange={(e) => handleContextChange('environment', e.target.value as string)}
                                            label="Environment"
                                        >
                                            <MenuItem value="dev">Development</MenuItem>
                                            <MenuItem value="staging">Staging</MenuItem>
                                            <MenuItem value="prod">Production</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={3}>
                                    <FormControl fullWidth variant="outlined" size="small">
                                        <InputLabel>Application</InputLabel>
                                        <Select
                                            value={context.app}
                                            onChange={(e) => handleContextChange('app', e.target.value as string)}
                                            label="Application"
                                        >
                                            <MenuItem value="web">Web Frontend</MenuItem>
                                            <MenuItem value="api">Backend API</MenuItem>
                                            <MenuItem value="mobile">Mobile App</MenuItem>
                                            <MenuItem value="admin">Admin Panel</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={3}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<AddIcon />}
                                        fullWidth
                                        disabled={!isContextValid}
                                        onClick={() => setCreateDialogOpen(true)}
                                    >
                                        Create Feature Flag
                                    </Button>
                                </Grid>
                            </Grid>

                            {isContextValid && (
                                <Box mt={2}>
                                    <Typography variant="body2" color="textSecondary">
                                        Current context: <strong>{context.tenant}.{context.environment}.{context.app}</strong>
                                    </Typography>
                                </Box>
                            )}
                        </InfoCard>
                    </Grid>

                    {/* Metrics */}
                    {isContextValid && (
                        <Grid item xs={12}>
                            <FeatureFlagMetrics context={context} />
                        </Grid>
                    )}

                    {/* Feature Flags Table */}
                    {isContextValid && (
                        <Grid item xs={12}>
                            <FeatureFlagsTable context={context} />
                        </Grid>
                    )}

                    {/* Empty State */}
                    {!isContextValid && (
                        <Grid item xs={12}>
                            <InfoCard>
                                <Box
                                    display="flex"
                                    flexDirection="column"
                                    alignItems="center"
                                    justifyContent="center"
                                    minHeight={200}
                                >
                                    <Typography variant="h6" color="textSecondary" gutterBottom>
                                        Select Context to Get Started
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary" align="center">
                                        Please select a tenant, environment, and application to view and manage feature flags.
                                    </Typography>
                                </Box>
                            </InfoCard>
                        </Grid>
                    )}
                </Grid>

                {/* Create Feature Flag Dialog */}
                {createDialogOpen && (
                    <CreateFeatureFlagDialog
                        context={context}
                        open={createDialogOpen}
                        onClose={() => setCreateDialogOpen(false)}
                        onSuccess={() => {
                            setCreateDialogOpen(false);
                            // Trigger refresh of feature flags table
                        }}
                    />
                )}
            </Content>
        </Page>
    );
};
