import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { InfoCard, Progress } from '@backstage/core-components';
import {
    Grid,
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
} from '@material-ui/core';
import {
    TrendingUp as TrendingUpIcon,
    ToggleOn as EnabledIcon,
    ToggleOff as DisabledIcon,
    Warning as StaleIcon,
} from '@material-ui/icons';
import { FeatureFlagMetrics as MetricsType, TenantEnvironmentApp, unleashFeatureFlagsApiRef } from '../api';

interface FeatureFlagMetricsProps {
    context: TenantEnvironmentApp;
}

export const FeatureFlagMetrics = ({ context }: FeatureFlagMetricsProps) => {
    const api = useApi(unleashFeatureFlagsApiRef);
    const [metrics, setMetrics] = useState<MetricsType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                setLoading(true);
                const data = await api.getFeatureFlagMetrics(context);
                setMetrics(data);
            } catch (err) {
                console.error('Failed to fetch metrics:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, [api, context]);

    if (loading) {
        return <Progress />;
    }

    if (!metrics) {
        return null;
    }

    const MetricCard = ({
        title,
        value,
        icon,
        color = 'primary'
    }: {
        title: string;
        value: number;
        icon: React.ReactNode;
        color?: 'primary' | 'secondary' | 'default' | 'error' | 'warning' | 'info' | 'success';
    }) => (
        <Card>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <div>
                        <Typography variant="h4" component="div" color={color}>
                            {value}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {title}
                        </Typography>
                    </div>
                    <Box color={`${color}.main`}>
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    return (
        <InfoCard title="Feature Flag Metrics">
            <Grid container spacing={2}>
                {/* Summary Metrics */}
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Total Flags"
                        value={metrics.total}
                        icon={<TrendingUpIcon />}
                        color="primary"
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Enabled"
                        value={metrics.enabled}
                        icon={<EnabledIcon />}
                        color="success"
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Disabled"
                        value={metrics.disabled}
                        icon={<DisabledIcon />}
                        color="default"
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Stale"
                        value={metrics.stale}
                        icon={<StaleIcon />}
                        color="warning"
                    />
                </Grid>

                {/* Flag Types Breakdown */}
                <Grid item xs={12}>
                    <Box mt={2}>
                        <Typography variant="h6" gutterBottom>
                            Flag Types
                        </Typography>
                        <Box display="flex" flexWrap="wrap" gap={1}>
                            {Object.entries(metrics.byType).map(([type, count]) => (
                                <Chip
                                    key={type}
                                    label={`${type}: ${count}`}
                                    variant="outlined"
                                    size="small"
                                />
                            ))}
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </InfoCard>
    );
};
