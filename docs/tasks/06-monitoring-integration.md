# Monitoring Integration with Grafana, Prometheus, and Jaeger

**Task 06: Monitoring Integration**  
**Priority:** High  
**Objective:** Integrate comprehensive monitoring and observability stack with Grafana dashboards, Prometheus metrics, and Jaeger distributed tracing

## Overview

This task establishes deep integration with the monitoring and observability stack, providing developers with comprehensive insights into application performance, system metrics, and distributed tracing through a unified Backstage interface.

## Tasks

### 1. Install Monitoring Integration Dependencies

```bash
# Install monitoring-related packages
yarn workspace backend add @backstage/plugin-kubernetes-backend
yarn workspace app add @backstage/plugin-kubernetes
yarn workspace backend add prometheus-query
yarn workspace backend add node-fetch
yarn workspace backend add lodash
yarn workspace backend add date-fns
```

### 2. Create Unified Monitoring Provider

Create `packages/backend/src/plugins/monitoring/monitoringProvider.ts`:

```typescript
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import fetch from 'node-fetch';
import { format, subDays, subHours, subMinutes } from 'date-fns';

export interface MonitoringConfig {
  grafana: {
    url: string;
    token?: string;
    username?: string;
    password?: string;
    orgId?: number;
  };
  prometheus: {
    url: string;
    enabled: boolean;
  };
  jaeger: {
    url: string;
    enabled: boolean;
  };
  alertmanager?: {
    url: string;
    enabled: boolean;
  };
}

export interface ServiceMetrics {
  service: string;
  namespace: string;
  metrics: {
    requests: MetricSeries;
    errors: MetricSeries;
    latency: MetricSeries;
    availability: number;
    errorRate: number;
    throughput: number;
  };
  alerts?: Alert[];
  dashboards?: Dashboard[];
}

export interface MetricSeries {
  name: string;
  values: Array<{
    timestamp: number;
    value: number;
  }>;
  unit: string;
}

export interface Alert {
  id: string;
  name: string;
  state: 'firing' | 'pending' | 'inactive';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt?: string;
  generatorURL?: string;
}

export interface Dashboard {
  id: string;
  uid: string;
  title: string;
  url: string;
  tags: string[];
  folderTitle?: string;
  isStarred: boolean;
}

export interface TraceData {
  traceID: string;
  spanID: string;
  operationName: string;
  duration: number;
  startTime: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    fields: Record<string, any>;
  }>;
  processes: Record<
    string,
    {
      serviceName: string;
      tags: Record<string, any>;
    }
  >;
  warnings?: string[];
}

export interface ServiceHealthSummary {
  service: string;
  namespace: string;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    score: number; // 0-100
    lastCheck: string;
  };
  sli: {
    availability: number;
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
    errorRate: number;
    throughput: number;
  };
  trends: {
    availability: 'improving' | 'stable' | 'degrading';
    latency: 'improving' | 'stable' | 'degrading';
    errorRate: 'improving' | 'stable' | 'degrading';
  };
}

export class MonitoringProvider {
  private config: MonitoringConfig;
  private logger: Logger;
  private grafanaClient: any;
  private prometheusClient: any;
  private jaegerClient: any;

  constructor(config: Config, logger: Logger) {
    const monitoringConfig = config.getOptionalConfig('monitoring');
    if (!monitoringConfig) {
      throw new Error('Monitoring configuration not found');
    }

    this.config = {
      grafana: {
        url: monitoringConfig.getString('grafana.url'),
        token: monitoringConfig.getOptionalString('grafana.token'),
        username: monitoringConfig.getOptionalString('grafana.username'),
        password: monitoringConfig.getOptionalString('grafana.password'),
        orgId: monitoringConfig.getOptionalNumber('grafana.orgId') ?? 1,
      },
      prometheus: {
        url: monitoringConfig.getString('prometheus.url'),
        enabled:
          monitoringConfig.getOptionalBoolean('prometheus.enabled') ?? true,
      },
      jaeger: {
        url: monitoringConfig.getString('jaeger.url'),
        enabled: monitoringConfig.getOptionalBoolean('jaeger.enabled') ?? true,
      },
      alertmanager: {
        url: monitoringConfig.getOptionalString('alertmanager.url') || '',
        enabled:
          monitoringConfig.getOptionalBoolean('alertmanager.enabled') ?? false,
      },
    };

    this.logger = logger;
    this.setupClients();
  }

  private setupClients() {
    // Setup Grafana client
    const grafanaHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.grafana.token) {
      grafanaHeaders.Authorization = `Bearer ${this.config.grafana.token}`;
    } else if (this.config.grafana.username && this.config.grafana.password) {
      const credentials = Buffer.from(
        `${this.config.grafana.username}:${this.config.grafana.password}`,
      ).toString('base64');
      grafanaHeaders.Authorization = `Basic ${credentials}`;
    }

    this.grafanaClient = {
      baseURL: this.config.grafana.url.replace(/\/$/, ''),
      headers: grafanaHeaders,
      orgId: this.config.grafana.orgId,
    };

    // Setup Prometheus client
    this.prometheusClient = {
      baseURL: this.config.prometheus.url.replace(/\/$/, ''),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Setup Jaeger client
    this.jaegerClient = {
      baseURL: this.config.jaeger.url.replace(/\/$/, ''),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  async getServiceMetrics(
    serviceName: string,
    namespace: string,
    timeRange: string = '1h',
  ): Promise<ServiceMetrics> {
    try {
      const [requests, errors, latency, dashboards, alerts] =
        await Promise.allSettled([
          this.getRequestMetrics(serviceName, namespace, timeRange),
          this.getErrorMetrics(serviceName, namespace, timeRange),
          this.getLatencyMetrics(serviceName, namespace, timeRange),
          this.getServiceDashboards(serviceName),
          this.getServiceAlerts(serviceName, namespace),
        ]);

      const requestData =
        requests.status === 'fulfilled'
          ? requests.value
          : this.createEmptyMetric('requests');
      const errorData =
        errors.status === 'fulfilled'
          ? errors.value
          : this.createEmptyMetric('errors');
      const latencyData =
        latency.status === 'fulfilled'
          ? latency.value
          : this.createEmptyMetric('latency');

      // Calculate derived metrics
      const availability = this.calculateAvailability(requestData, errorData);
      const errorRate = this.calculateErrorRate(requestData, errorData);
      const throughput = this.calculateThroughput(requestData);

      return {
        service: serviceName,
        namespace,
        metrics: {
          requests: requestData,
          errors: errorData,
          latency: latencyData,
          availability,
          errorRate,
          throughput,
        },
        dashboards: dashboards.status === 'fulfilled' ? dashboards.value : [],
        alerts: alerts.status === 'fulfilled' ? alerts.value : [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to get service metrics for ${serviceName}`,
        error,
      );
      throw error;
    }
  }

  private async getRequestMetrics(
    serviceName: string,
    namespace: string,
    timeRange: string,
  ): Promise<MetricSeries> {
    const query = `sum(rate(http_requests_total{service="${serviceName}",namespace="${namespace}"}[5m]))`;
    const result = await this.queryPrometheus(query, timeRange);

    return {
      name: 'HTTP Requests per Second',
      values: this.parsePrometheusResult(result),
      unit: 'req/s',
    };
  }

  private async getErrorMetrics(
    serviceName: string,
    namespace: string,
    timeRange: string,
  ): Promise<MetricSeries> {
    const query = `sum(rate(http_requests_total{service="${serviceName}",namespace="${namespace}",status=~"5.."}[5m]))`;
    const result = await this.queryPrometheus(query, timeRange);

    return {
      name: 'HTTP Errors per Second',
      values: this.parsePrometheusResult(result),
      unit: 'err/s',
    };
  }

  private async getLatencyMetrics(
    serviceName: string,
    namespace: string,
    timeRange: string,
  ): Promise<MetricSeries> {
    const query = `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="${serviceName}",namespace="${namespace}"}[5m])) by (le))`;
    const result = await this.queryPrometheus(query, timeRange);

    return {
      name: 'HTTP Request Latency (95th percentile)',
      values: this.parsePrometheusResult(result),
      unit: 'seconds',
    };
  }

  private async queryPrometheus(
    query: string,
    timeRange: string,
  ): Promise<any> {
    try {
      const now = new Date();
      const start = this.getTimeRangeStart(now, timeRange);
      const step = this.calculateStep(timeRange);

      const params = new URLSearchParams({
        query,
        start: Math.floor(start.getTime() / 1000).toString(),
        end: Math.floor(now.getTime() / 1000).toString(),
        step: step.toString(),
      });

      const response = await fetch(
        `${this.prometheusClient.baseURL}/api/v1/query_range?${params}`,
        { headers: this.prometheusClient.headers },
      );

      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      this.logger.error('Failed to query Prometheus', error);
      return { result: [] };
    }
  }

  private parsePrometheusResult(
    result: any,
  ): Array<{ timestamp: number; value: number }> {
    if (!result.result || result.result.length === 0) {
      return [];
    }

    const series = result.result[0];
    if (!series.values) {
      return [];
    }

    return series.values.map(([timestamp, value]: [number, string]) => ({
      timestamp: timestamp * 1000, // Convert to milliseconds
      value: parseFloat(value),
    }));
  }

  private getTimeRangeStart(now: Date, timeRange: string): Date {
    switch (timeRange) {
      case '5m':
        return subMinutes(now, 5);
      case '15m':
        return subMinutes(now, 15);
      case '30m':
        return subMinutes(now, 30);
      case '1h':
        return subHours(now, 1);
      case '6h':
        return subHours(now, 6);
      case '12h':
        return subHours(now, 12);
      case '24h':
      case '1d':
        return subDays(now, 1);
      case '7d':
        return subDays(now, 7);
      case '30d':
        return subDays(now, 30);
      default:
        return subHours(now, 1);
    }
  }

  private calculateStep(timeRange: string): number {
    switch (timeRange) {
      case '5m':
      case '15m':
        return 15; // 15 seconds
      case '30m':
      case '1h':
        return 60; // 1 minute
      case '6h':
      case '12h':
        return 300; // 5 minutes
      case '24h':
      case '1d':
        return 900; // 15 minutes
      case '7d':
        return 3600; // 1 hour
      case '30d':
        return 14400; // 4 hours
      default:
        return 60;
    }
  }

  private calculateAvailability(
    requests: MetricSeries,
    errors: MetricSeries,
  ): number {
    if (requests.values.length === 0) return 100;

    const totalRequests = requests.values.reduce(
      (sum, point) => sum + point.value,
      0,
    );
    const totalErrors = errors.values.reduce(
      (sum, point) => sum + point.value,
      0,
    );

    if (totalRequests === 0) return 100;
    return Math.max(0, (1 - totalErrors / totalRequests) * 100);
  }

  private calculateErrorRate(
    requests: MetricSeries,
    errors: MetricSeries,
  ): number {
    if (requests.values.length === 0) return 0;

    const totalRequests = requests.values.reduce(
      (sum, point) => sum + point.value,
      0,
    );
    const totalErrors = errors.values.reduce(
      (sum, point) => sum + point.value,
      0,
    );

    if (totalRequests === 0) return 0;
    return (totalErrors / totalRequests) * 100;
  }

  private calculateThroughput(requests: MetricSeries): number {
    if (requests.values.length === 0) return 0;

    // Return average requests per second
    const totalRequests = requests.values.reduce(
      (sum, point) => sum + point.value,
      0,
    );
    return totalRequests / requests.values.length;
  }

  private createEmptyMetric(name: string): MetricSeries {
    return {
      name,
      values: [],
      unit: 'count',
    };
  }

  async getServiceDashboards(serviceName: string): Promise<Dashboard[]> {
    try {
      const response = await fetch(
        `${this.grafanaClient.baseURL}/api/search?query=${serviceName}&type=dash-db`,
        { headers: this.grafanaClient.headers },
      );

      if (!response.ok) {
        throw new Error(`Grafana API request failed: ${response.status}`);
      }

      const dashboards = await response.json();

      return dashboards.map((dashboard: any) => ({
        id: dashboard.id,
        uid: dashboard.uid,
        title: dashboard.title,
        url: `${this.grafanaClient.baseURL}/d/${dashboard.uid}`,
        tags: dashboard.tags || [],
        folderTitle: dashboard.folderTitle,
        isStarred: dashboard.isStarred || false,
      }));
    } catch (error) {
      this.logger.error('Failed to get Grafana dashboards', error);
      return [];
    }
  }

  async getServiceAlerts(
    serviceName: string,
    namespace: string,
  ): Promise<Alert[]> {
    if (!this.config.alertmanager?.enabled) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.config.alertmanager.url}/api/v1/alerts`,
        { headers: { 'Content-Type': 'application/json' } },
      );

      if (!response.ok) {
        throw new Error(`Alertmanager API request failed: ${response.status}`);
      }

      const data = await response.json();
      const alerts = data.data || [];

      // Filter alerts related to the service
      return alerts
        .filter(
          (alert: any) =>
            alert.labels?.service === serviceName ||
            alert.labels?.namespace === namespace ||
            alert.labels?.job?.includes(serviceName),
        )
        .map((alert: any) => ({
          id: alert.fingerprint,
          name: alert.labels?.alertname || 'Unknown Alert',
          state: alert.status?.state || 'unknown',
          severity: alert.labels?.severity || 'info',
          description:
            alert.annotations?.description || alert.annotations?.summary || '',
          labels: alert.labels || {},
          annotations: alert.annotations || {},
          startsAt: alert.startsAt,
          endsAt: alert.endsAt,
          generatorURL: alert.generatorURL,
        }));
    } catch (error) {
      this.logger.error('Failed to get alerts from Alertmanager', error);
      return [];
    }
  }

  async getDistributedTraces(
    serviceName: string,
    timeRange: string = '1h',
    limit: number = 50,
  ): Promise<TraceData[]> {
    if (!this.config.jaeger.enabled) {
      return [];
    }

    try {
      const lookback = this.convertTimeRangeToMicroseconds(timeRange);
      const params = new URLSearchParams({
        service: serviceName,
        limit: limit.toString(),
        lookback: lookback.toString(),
      });

      const response = await fetch(
        `${this.jaegerClient.baseURL}/api/traces?${params}`,
        { headers: this.jaegerClient.headers },
      );

      if (!response.ok) {
        throw new Error(`Jaeger API request failed: ${response.status}`);
      }

      const data = await response.json();
      const traces = data.data || [];

      return traces.map((trace: any) => ({
        traceID: trace.traceID,
        spanID: trace.spans?.[0]?.spanID || '',
        operationName: trace.spans?.[0]?.operationName || '',
        duration: trace.spans?.[0]?.duration || 0,
        startTime: trace.spans?.[0]?.startTime || 0,
        tags:
          trace.spans?.[0]?.tags?.reduce((acc: any, tag: any) => {
            acc[tag.key] = tag.value;
            return acc;
          }, {}) || {},
        logs: trace.spans?.[0]?.logs || [],
        processes: trace.processes || {},
        warnings: trace.warnings,
      }));
    } catch (error) {
      this.logger.error('Failed to get distributed traces', error);
      return [];
    }
  }

  private convertTimeRangeToMicroseconds(timeRange: string): number {
    const now = Date.now() * 1000; // Convert to microseconds
    const start =
      this.getTimeRangeStart(new Date(), timeRange).getTime() * 1000;
    return now - start;
  }

  async getServiceHealthSummary(
    serviceName: string,
    namespace: string,
  ): Promise<ServiceHealthSummary> {
    try {
      const metrics = await this.getServiceMetrics(
        serviceName,
        namespace,
        '1h',
      );

      // Calculate health score based on availability, error rate, and latency
      let healthScore = 100;

      // Deduct points for low availability
      if (metrics.metrics.availability < 99.9) {
        healthScore -= (99.9 - metrics.metrics.availability) * 10;
      }

      // Deduct points for high error rate
      if (metrics.metrics.errorRate > 1) {
        healthScore -= metrics.metrics.errorRate * 5;
      }

      // Determine health status
      let healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
      if (healthScore >= 95) {
        healthStatus = 'healthy';
      } else if (healthScore >= 80) {
        healthStatus = 'degraded';
      } else if (healthScore > 0) {
        healthStatus = 'unhealthy';
      } else {
        healthStatus = 'unknown';
      }

      // Calculate trends (simplified - would need historical data for real trends)
      const trends = {
        availability: 'stable' as const,
        latency: 'stable' as const,
        errorRate: 'stable' as const,
      };

      // Extract latency percentiles from latest metric values
      const latencyValues = metrics.metrics.latency.values;
      const latestLatency =
        latencyValues.length > 0
          ? latencyValues[latencyValues.length - 1].value
          : 0;

      return {
        service: serviceName,
        namespace,
        health: {
          status: healthStatus,
          score: Math.max(0, Math.min(100, healthScore)),
          lastCheck: new Date().toISOString(),
        },
        sli: {
          availability: metrics.metrics.availability,
          latency: {
            p50: latestLatency * 0.6, // Simplified calculation
            p95: latestLatency,
            p99: latestLatency * 1.2,
          },
          errorRate: metrics.metrics.errorRate,
          throughput: metrics.metrics.throughput,
        },
        trends,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get service health summary for ${serviceName}`,
        error,
      );

      return {
        service: serviceName,
        namespace,
        health: {
          status: 'unknown',
          score: 0,
          lastCheck: new Date().toISOString(),
        },
        sli: {
          availability: 0,
          latency: { p50: 0, p95: 0, p99: 0 },
          errorRate: 0,
          throughput: 0,
        },
        trends: {
          availability: 'stable',
          latency: 'stable',
          errorRate: 'stable',
        },
      };
    }
  }

  async getCustomMetrics(
    query: string,
    timeRange: string = '1h',
  ): Promise<MetricSeries[]> {
    try {
      const result = await this.queryPrometheus(query, timeRange);

      if (!result.result) {
        return [];
      }

      return result.result.map((series: any) => ({
        name: this.buildSeriesName(series.metric),
        values: this.parsePrometheusResult({ result: [series] }),
        unit: 'count',
      }));
    } catch (error) {
      this.logger.error('Failed to get custom metrics', error);
      return [];
    }
  }

  private buildSeriesName(metric: Record<string, string>): string {
    const { __name__, ...labels } = metric;
    const labelString = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(', ');

    return `${__name__ || 'metric'}{${labelString}}`;
  }

  async validateConnections(): Promise<{
    grafana: boolean;
    prometheus: boolean;
    jaeger: boolean;
    alertmanager: boolean;
  }> {
    const results = await Promise.allSettled([
      this.validateGrafanaConnection(),
      this.validatePrometheusConnection(),
      this.validateJaegerConnection(),
      this.validateAlertmanagerConnection(),
    ]);

    return {
      grafana: results[0].status === 'fulfilled' && results[0].value,
      prometheus: results[1].status === 'fulfilled' && results[1].value,
      jaeger: results[2].status === 'fulfilled' && results[2].value,
      alertmanager: results[3].status === 'fulfilled' && results[3].value,
    };
  }

  private async validateGrafanaConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.grafanaClient.baseURL}/api/health`, {
        headers: this.grafanaClient.headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async validatePrometheusConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.prometheusClient.baseURL}/api/v1/query?query=up`,
        { headers: this.prometheusClient.headers },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private async validateJaegerConnection(): Promise<boolean> {
    if (!this.config.jaeger.enabled) return false;

    try {
      const response = await fetch(
        `${this.jaegerClient.baseURL}/api/services`,
        { headers: this.jaegerClient.headers },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private async validateAlertmanagerConnection(): Promise<boolean> {
    if (!this.config.alertmanager?.enabled) return false;

    try {
      const response = await fetch(
        `${this.config.alertmanager.url}/api/v1/status`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 3. Create Monitoring Backend Plugin

Create `packages/backend/src/plugins/monitoring.ts`:

```typescript
import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { MonitoringProvider } from './monitoring/monitoringProvider';

export const monitoringPlugin = createBackendPlugin({
  pluginId: 'monitoring',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        auth: coreServices.auth,
      },
      async init({ httpRouter, logger, config, auth }) {
        const monitoringProvider = new MonitoringProvider(config, logger);
        const router = Router();

        // Get service metrics
        router.get('/metrics/:namespace/:service', async (req, res) => {
          try {
            const { namespace, service } = req.params;
            const { timeRange = '1h' } = req.query;

            const metrics = await monitoringProvider.getServiceMetrics(
              service,
              namespace,
              timeRange as string,
            );

            res.json(metrics);
          } catch (error) {
            logger.error('Failed to get service metrics', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get service health summary
        router.get('/health/:namespace/:service', async (req, res) => {
          try {
            const { namespace, service } = req.params;

            const healthSummary =
              await monitoringProvider.getServiceHealthSummary(
                service,
                namespace,
              );

            res.json(healthSummary);
          } catch (error) {
            logger.error('Failed to get service health summary', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get distributed traces
        router.get('/traces/:service', async (req, res) => {
          try {
            const { service } = req.params;
            const { timeRange = '1h', limit = 50 } = req.query;

            const traces = await monitoringProvider.getDistributedTraces(
              service,
              timeRange as string,
              parseInt(limit as string, 10),
            );

            res.json(traces);
          } catch (error) {
            logger.error('Failed to get distributed traces', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get service dashboards
        router.get('/dashboards/:service', async (req, res) => {
          try {
            const { service } = req.params;

            const dashboards = await monitoringProvider.getServiceDashboards(
              service,
            );
            res.json(dashboards);
          } catch (error) {
            logger.error('Failed to get service dashboards', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get service alerts
        router.get('/alerts/:namespace/:service', async (req, res) => {
          try {
            const { namespace, service } = req.params;

            const alerts = await monitoringProvider.getServiceAlerts(
              service,
              namespace,
            );
            res.json(alerts);
          } catch (error) {
            logger.error('Failed to get service alerts', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Execute custom Prometheus query
        router.post('/query', async (req, res) => {
          try {
            const { query, timeRange = '1h' } = req.body;

            if (!query) {
              return res.status(400).json({ error: 'Query is required' });
            }

            const metrics = await monitoringProvider.getCustomMetrics(
              query,
              timeRange,
            );
            res.json(metrics);
          } catch (error) {
            logger.error('Failed to execute custom query', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Validate monitoring connections
        router.get('/connections', async (req, res) => {
          try {
            const connections = await monitoringProvider.validateConnections();
            res.json(connections);
          } catch (error) {
            logger.error('Failed to validate connections', error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Health check
        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/monitoring', router);
      },
    });
  },
});
```

### 4. Create Monitoring Frontend Component

Create `packages/app/src/components/monitoring/MonitoringPage.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  Page,
  Header,
  Content,
  ContentHeader,
  Progress,
  ErrorBoundary,
  SupportButton,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusPending,
} from '@backstage/core-components';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Tab,
  Tabs,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Timeline,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Error,
  Warning,
  Info,
  CheckCircle,
  Dashboard as DashboardIcon,
  Launch,
  Refresh,
  QueryBuilder,
} from '@material-ui/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

const useStyles = makeStyles(theme => ({
  metricCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  chartContainer: {
    height: 300,
    marginTop: theme.spacing(2),
  },
  healthStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  healthScore: {
    fontWeight: 'bold',
    fontSize: '1.2rem',
  },
  trendIcon: {
    fontSize: '1rem',
  },
  alertCard: {
    marginBottom: theme.spacing(1),
    borderLeft: `4px solid ${theme.palette.error.main}`,
  },
  warningCard: {
    marginBottom: theme.spacing(1),
    borderLeft: `4px solid ${theme.palette.warning.main}`,
  },
  infoCard: {
    marginBottom: theme.spacing(1),
    borderLeft: `4px solid ${theme.palette.info.main}`,
  },
  timeRangeSelector: {
    minWidth: 120,
    marginLeft: theme.spacing(2),
  },
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`monitoring-tabpanel-${index}`}
      aria-labelledby={`monitoring-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

export const MonitoringPage = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const [metrics, setMetrics] = useState<any>(null);
  const [healthSummary, setHealthSummary] = useState<any>(null);
  const [traces, setTraces] = useState<any[]>([]);
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [connections, setConnections] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [timeRange, setTimeRange] = useState('1h');

  const namespace = entity.metadata.namespace || 'default';
  const serviceName = entity.metadata.name;
  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchMonitoringData();
  }, [namespace, serviceName, timeRange]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        metricsResponse,
        healthResponse,
        tracesResponse,
        dashboardsResponse,
        alertsResponse,
        connectionsResponse,
      ] = await Promise.allSettled([
        fetch(
          `${backendUrl}/api/monitoring/metrics/${namespace}/${serviceName}?timeRange=${timeRange}`,
        ),
        fetch(
          `${backendUrl}/api/monitoring/health/${namespace}/${serviceName}`,
        ),
        fetch(
          `${backendUrl}/api/monitoring/traces/${serviceName}?timeRange=${timeRange}&limit=20`,
        ),
        fetch(`${backendUrl}/api/monitoring/dashboards/${serviceName}`),
        fetch(
          `${backendUrl}/api/monitoring/alerts/${namespace}/${serviceName}`,
        ),
        fetch(`${backendUrl}/api/monitoring/connections`),
      ]);

      if (metricsResponse.status === 'fulfilled' && metricsResponse.value.ok) {
        setMetrics(await metricsResponse.value.json());
      }

      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        setHealthSummary(await healthResponse.value.json());
      }

      if (tracesResponse.status === 'fulfilled' && tracesResponse.value.ok) {
        setTraces(await tracesResponse.value.json());
      }

      if (
        dashboardsResponse.status === 'fulfilled' &&
        dashboardsResponse.value.ok
      ) {
        setDashboards(await dashboardsResponse.value.json());
      }

      if (alertsResponse.status === 'fulfilled' && alertsResponse.value.ok) {
        setAlerts(await alertsResponse.value.json());
      }

      if (
        connectionsResponse.status === 'fulfilled' &&
        connectionsResponse.value.ok
      ) {
        setConnections(await connectionsResponse.value.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

  const handleTimeRangeChange = (event: any) => {
    setTimeRange(event.target.value);
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <StatusOK />;
      case 'degraded':
        return <StatusWarning />;
      case 'unhealthy':
        return <StatusError />;
      default:
        return <StatusPending />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return (
          <TrendingUp
            className={classes.trendIcon}
            style={{ color: 'green' }}
          />
        );
      case 'degrading':
        return (
          <TrendingDown
            className={classes.trendIcon}
            style={{ color: 'red' }}
          />
        );
      default:
        return (
          <TrendingFlat
            className={classes.trendIcon}
            style={{ color: 'gray' }}
          />
        );
    }
  };

  const getAlertSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Error color="error" />;
      case 'warning':
        return <Warning style={{ color: 'orange' }} />;
      default:
        return <Info color="primary" />;
    }
  };

  const formatMetricData = (metricSeries: any) => {
    if (!metricSeries?.values) return [];

    return metricSeries.values.map((point: any) => ({
      timestamp: new Date(point.timestamp).toLocaleTimeString(),
      value: point.value,
    }));
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Monitoring & Observability" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Monitoring & Observability" />
        <Content>
          <Typography color="error">Error: {error}</Typography>
        </Content>
      </Page>
    );
  }

  return (
    <ErrorBoundary>
      <Page themeId="tool">
        <Header
          title="Monitoring & Observability"
          subtitle={`${serviceName} in ${namespace}`}
        >
          <Box display="flex" alignItems="center">
            <Button
              startIcon={<Refresh />}
              onClick={fetchMonitoringData}
              disabled={loading}
            >
              Refresh
            </Button>
            <FormControl className={classes.timeRangeSelector}>
              <InputLabel>Time Range</InputLabel>
              <Select value={timeRange} onChange={handleTimeRangeChange}>
                <MenuItem value="5m">5 minutes</MenuItem>
                <MenuItem value="15m">15 minutes</MenuItem>
                <MenuItem value="30m">30 minutes</MenuItem>
                <MenuItem value="1h">1 hour</MenuItem>
                <MenuItem value="6h">6 hours</MenuItem>
                <MenuItem value="12h">12 hours</MenuItem>
                <MenuItem value="24h">24 hours</MenuItem>
                <MenuItem value="7d">7 days</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <SupportButton>
            Monitor application performance with Grafana, Prometheus, and
            Jaeger.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="Monitoring Dashboard">
            <Typography variant="body1">
              Comprehensive observability with metrics, traces, and alerts
            </Typography>
          </ContentHeader>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Health Overview" />
              <Tab label="Metrics" />
              <Tab label="Distributed Tracing" />
              <Tab label="Alerts" />
              <Tab label="Dashboards" />
              <Tab label="System Status" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <HealthOverview
              healthSummary={healthSummary}
              getHealthIcon={getHealthIcon}
              getTrendIcon={getTrendIcon}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <MetricsPanel
              metrics={metrics}
              formatMetricData={formatMetricData}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <DistributedTracingPanel traces={traces} classes={classes} />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <AlertsPanel
              alerts={alerts}
              getAlertSeverityIcon={getAlertSeverityIcon}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <DashboardsPanel dashboards={dashboards} classes={classes} />
          </TabPanel>

          <TabPanel value={tabValue} index={5}>
            <SystemStatusPanel connections={connections} classes={classes} />
          </TabPanel>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};

const HealthOverview = ({
  healthSummary,
  getHealthIcon,
  getTrendIcon,
  classes,
}: any) => {
  if (!healthSummary) {
    return (
      <Card>
        <CardContent>
          <Typography color="textSecondary">
            No health data available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card className={classes.metricCard}>
          <CardContent>
            <Box className={classes.healthStatus} mb={2}>
              {getHealthIcon(healthSummary.health.status)}
              <Typography variant="h6">Service Health</Typography>
            </Box>
            <Typography
              variant="h3"
              className={classes.healthScore}
              color="primary"
            >
              {healthSummary.health.score}%
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Last checked:{' '}
              {new Date(healthSummary.health.lastCheck).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card className={classes.metricCard}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Service Level Indicators (SLI)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {healthSummary.sli.availability.toFixed(2)}%
                  </Typography>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Typography variant="body2">Availability</Typography>
                    {getTrendIcon(healthSummary.trends.availability)}
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {healthSummary.sli.latency.p95.toFixed(0)}ms
                  </Typography>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Typography variant="body2">P95 Latency</Typography>
                    {getTrendIcon(healthSummary.trends.latency)}
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {healthSummary.sli.errorRate.toFixed(2)}%
                  </Typography>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Typography variant="body2">Error Rate</Typography>
                    {getTrendIcon(healthSummary.trends.errorRate)}
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {healthSummary.sli.throughput.toFixed(1)}
                  </Typography>
                  <Typography variant="body2">Requests/sec</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

const MetricsPanel = ({ metrics, formatMetricData, classes }: any) => {
  if (!metrics) {
    return (
      <Card>
        <CardContent>
          <Typography color="textSecondary">
            No metrics data available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card className={classes.metricCard}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              HTTP Requests
            </Typography>
            <Box className={classes.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formatMetricData(metrics.metrics.requests)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#1f77b4"
                    fill="#1f77b4"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card className={classes.metricCard}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Error Rate
            </Typography>
            <Box className={classes.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formatMetricData(metrics.metrics.errors)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#d62728"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card className={classes.metricCard}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Response Time (95th percentile)
            </Typography>
            <Box className={classes.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formatMetricData(metrics.metrics.latency)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#ff7f0e"
                    fill="#ff7f0e"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

const DistributedTracingPanel = ({ traces, classes }: any) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Recent Traces
      </Typography>
      {traces.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Trace ID</TableCell>
                <TableCell>Operation</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Start Time</TableCell>
                <TableCell>Service</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {traces.slice(0, 10).map((trace: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>
                    <Typography
                      variant="body2"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {trace.traceID?.slice(0, 16)}...
                    </Typography>
                  </TableCell>
                  <TableCell>{trace.operationName}</TableCell>
                  <TableCell>{(trace.duration / 1000).toFixed(2)}μs</TableCell>
                  <TableCell>
                    {new Date(trace.startTime / 1000).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    {Object.values(trace.processes)?.[0]?.serviceName ||
                      'Unknown'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="textSecondary">No trace data available</Typography>
      )}
    </CardContent>
  </Card>
);

const AlertsPanel = ({ alerts, getAlertSeverityIcon, classes }: any) => (
  <Grid container spacing={3}>
    <Grid item xs={12}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Active Alerts
          </Typography>
          {alerts.length > 0 ? (
            alerts.map((alert: any, index: number) => (
              <Card
                key={index}
                className={
                  alert.severity === 'critical'
                    ? classes.alertCard
                    : alert.severity === 'warning'
                    ? classes.warningCard
                    : classes.infoCard
                }
              >
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    {getAlertSeverityIcon(alert.severity)}
                    <Typography variant="h6" style={{ marginLeft: 8 }}>
                      {alert.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={alert.state}
                      style={{ marginLeft: 'auto' }}
                      color={alert.state === 'firing' ? 'secondary' : 'default'}
                    />
                  </Box>
                  <Typography variant="body2" gutterBottom>
                    {alert.description}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Started: {new Date(alert.startsAt).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            ))
          ) : (
            <Typography color="textSecondary">No active alerts</Typography>
          )}
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const DashboardsPanel = ({ dashboards, classes }: any) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Grafana Dashboards
      </Typography>
      {dashboards.length > 0 ? (
        <List>
          {dashboards.map((dashboard: any, index: number) => (
            <ListItem key={index}>
              <ListItemIcon>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText
                primary={dashboard.title}
                secondary={dashboard.tags?.join(', ')}
              />
              <Tooltip title="Open in Grafana">
                <IconButton
                  onClick={() => window.open(dashboard.url, '_blank')}
                  edge="end"
                >
                  <Launch />
                </IconButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography color="textSecondary">No dashboards found</Typography>
      )}
    </CardContent>
  </Card>
);

const SystemStatusPanel = ({ connections, classes }: any) => {
  if (!connections) {
    return (
      <Card>
        <CardContent>
          <Typography color="textSecondary">
            Connection status not available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const getConnectionStatus = (connected: boolean) => {
    return connected ? (
      <Chip
        icon={<CheckCircle />}
        label="Connected"
        color="primary"
        size="small"
      />
    ) : (
      <Chip
        icon={<Error />}
        label="Disconnected"
        color="secondary"
        size="small"
      />
    );
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Connections
            </Typography>
            <List>
              <ListItem>
                <ListItemText primary="Grafana" />
                {getConnectionStatus(connections.grafana)}
              </ListItem>
              <ListItem>
                <ListItemText primary="Prometheus" />
                {getConnectionStatus(connections.prometheus)}
              </ListItem>
              <ListItem>
                <ListItemText primary="Jaeger" />
                {getConnectionStatus(connections.jaeger)}
              </ListItem>
              <ListItem>
                <ListItemText primary="Alertmanager" />
                {getConnectionStatus(connections.alertmanager)}
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};
```

### 5. Register Monitoring Plugin

Update `packages/backend/src/index.ts`:

```typescript
import { monitoringPlugin } from './plugins/monitoring';

// Add Monitoring plugin
backend.add(monitoringPlugin);
```

### 6. Add Monitoring Tab to Entity Page

Update `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import { MonitoringPage } from '../monitoring/MonitoringPage';

// In the service entity case
const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {/* Existing overview content */}
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/monitoring" title="Monitoring">
      <MonitoringPage />
    </EntityLayout.Route>

    {/* Other existing routes */}
  </EntityLayout>
);
```

### 7. Configure Monitoring in app-config.yaml

```yaml
monitoring:
  grafana:
    url: ${GRAFANA_URL}
    token: ${GRAFANA_TOKEN}
    # Alternative: username/password auth
    # username: ${GRAFANA_USERNAME}
    # password: ${GRAFANA_PASSWORD}
    orgId: 1

  prometheus:
    url: ${PROMETHEUS_URL}
    enabled: true

  jaeger:
    url: ${JAEGER_URL}
    enabled: true

  alertmanager:
    url: ${ALERTMANAGER_URL}
    enabled: true
```

## Environment Variables Required

```bash
# Grafana Configuration
GRAFANA_URL=https://grafana.idp-platform.local
GRAFANA_TOKEN=<grafana-service-account-token>

# Prometheus Configuration
PROMETHEUS_URL=https://prometheus.idp-platform.local

# Jaeger Configuration
JAEGER_URL=https://jaeger.idp-platform.local

# Alertmanager Configuration (optional)
ALERTMANAGER_URL=https://alertmanager.idp-platform.local
```

### 8. Entity Annotations for Monitoring

```yaml
# In catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    # Existing annotations
    backstage.io/kubernetes-id: my-service

    # Monitoring annotations
    prometheus.io/scrape: 'true'
    prometheus.io/path: '/metrics'
    prometheus.io/port: '8080'

    # Grafana annotations
    grafana.com/dashboard-selector: 'my-service'
    grafana.com/folder: 'Services'

    # Jaeger annotations
    jaeger.io/service-name: 'my-service'

    # Custom metric labels
    monitoring.coreos.com/service-level: 'gold'
spec:
  type: service
  lifecycle: production
  owner: platform-team
  system: idp-platform
```

## Expected Outcomes

### ✅ **Comprehensive Metrics Integration**

- Real-time Prometheus metrics visualization
- Custom metric queries and dashboards
- Historical trend analysis and alerting

### ✅ **Distributed Tracing Visibility**

- Jaeger trace integration and analysis
- Request flow visualization across services
- Performance bottleneck identification

### ✅ **Unified Dashboard Experience**

- Embedded Grafana dashboard links
- Service-specific monitoring views
- Cross-platform observability correlation

### ✅ **Proactive Alert Management**

- Real-time alert status and history
- Service-level indicator tracking
- Automated health scoring and trends

## Troubleshooting

### Common Issues

1. **Grafana API Authentication Issues**

   - Verify service account token permissions
   - Check organization ID configuration
   - Ensure API access is enabled

2. **Prometheus Query Issues**

   - Verify metric names and labels
   - Check time range and step calculations
   - Ensure Prometheus accessibility

3. **Jaeger Trace Data Issues**
   - Verify service name configuration
   - Check trace sampling rates
   - Ensure Jaeger collector connectivity

### Debug Commands

```bash
# Check Grafana health
curl -H "Authorization: Bearer <token>" https://grafana.example.com/api/health

# Test Prometheus query
curl "https://prometheus.example.com/api/v1/query?query=up"

# Check Jaeger services
curl "https://jaeger.example.com/api/services"

# Verify Alertmanager
curl "https://alertmanager.example.com/api/v1/status"
```

## Next Steps

1. **Deploy Monitoring Stack**: Ensure Grafana, Prometheus, and Jaeger are properly deployed
2. **Configure Service Discovery**: Set up Prometheus service discovery for applications
3. **Create Dashboards**: Build service-specific Grafana dashboards
4. **Set up Alerting**: Configure meaningful alerts and notification channels
5. **Team Training**: Onboard team on observability best practices

---

**Dependencies**: Grafana, Prometheus, Jaeger, Alertmanager (optional)  
**Estimated Effort**: 4-5 days  
**Owner**: Platform Team  
**Status**: Ready for implementation
