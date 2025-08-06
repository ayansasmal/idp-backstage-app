# Centralized Logging Plugin

A comprehensive logging plugin for Backstage with CloudWatch integration and structured logging capabilities.

## Features

- **Structured Logging**: JSON-formatted logs with consistent metadata
- **Multiple Transports**: Console, file rotation, and AWS CloudWatch
- **Request Tracing**: Automatic request ID generation and correlation
- **Log Levels**: Configurable log levels (error, warn, info, debug)
- **File Rotation**: Daily log rotation with configurable retention
- **CloudWatch Integration**: Optional AWS CloudWatch Logs support
- **HTTP API**: REST endpoints for logging and monitoring
- **Maintenance Tasks**: Automated log cleanup and optimization

## Installation

```bash
# Install the plugin
yarn add @internal/plugin-logging

# Install peer dependencies
yarn add winston winston-cloudwatch winston-daily-rotate-file @aws-sdk/client-cloudwatch-logs
```

## Configuration

Add the following to your `app-config.yaml`:

```yaml
logging:
  level: info
  enableCloudWatch: true
  enableFileLogging: true
  
  # CloudWatch configuration (optional)
  cloudWatch:
    region: us-east-1
    logGroupName: /backstage/application
    logStreamPrefix: backstage-app
    # Optional: Use specific AWS credentials
    accessKeyId: ${AWS_ACCESS_KEY_ID}
    secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
  
  # File logging configuration (optional)
  fileLogging:
    directory: ./logs
    maxSize: 20m
    maxFiles: 14d
    datePattern: YYYY-MM-DD
```

## Backend Integration

Add the logging plugin to your backend:

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';
import { loggingPlugin } from '@internal/plugin-logging';

const backend = createBackend();

// Register the logging plugin
backend.add(loggingPlugin);

backend.start();
```

## Usage

### Service Integration

```typescript
import { LoggingService } from '@internal/plugin-logging';

class MyService {
  constructor(private loggingService: LoggingService) {}

  async processData(userId: string, data: any) {
    const requestId = generateRequestId();
    
    this.loggingService.info('Processing data started', {
      dataSize: data.length,
      processingType: 'batch',
    }, {
      service: 'data-processor',
      userId,
      requestId,
    });

    try {
      // Process data
      const result = await this.process(data);
      
      this.loggingService.info('Data processing completed', {
        resultCount: result.length,
        duration: Date.now() - startTime,
      }, {
        service: 'data-processor',
        userId,
        requestId,
      });
      
      return result;
    } catch (error) {
      this.loggingService.error('Data processing failed', error, {
        dataSize: data.length,
        stage: 'processing',
      }, {
        service: 'data-processor',
        userId,
        requestId,
      });
      throw error;
    }
  }
}
```

### HTTP API

The plugin provides REST endpoints for logging and monitoring:

```bash
# Health check
curl http://localhost:7007/api/logging/health

# Get logging statistics
curl http://localhost:7007/api/logging/stats

# Log a custom message
curl -X POST http://localhost:7007/api/logging/log \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "message": "Custom application event",
    "service": "my-service",
    "metadata": {
      "eventType": "user_action",
      "actionId": "123"
    }
  }'

# Trigger maintenance
curl -X POST http://localhost:7007/api/logging/maintenance
```

### Middleware Integration

```typescript
import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '@internal/plugin-logging';

export function createLoggingMiddleware(loggingService: LoggingService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    const startTime = Date.now();
    
    // Log request start
    loggingService.info('HTTP request started', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }, {
      service: 'http-server',
      requestId: requestId as string,
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      
      loggingService.info('HTTP request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length'),
      }, {
        service: 'http-server',
        requestId: requestId as string,
      });
      
      originalEnd.apply(res, args);
    };

    next();
  };
}
```

## AWS CloudWatch Setup

### 1. Create Log Group

```bash
# Using AWS CLI
aws logs create-log-group \
  --log-group-name /backstage/application \
  --region us-east-1
```

### 2. IAM Permissions

Create an IAM policy for CloudWatch Logs access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/backstage/*"
    }
  ]
}
```

### 3. Environment Variables

```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
```

## Log Format

### Structured Log Entry

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "User authentication successful",
  "service": "auth-service",
  "userId": "user123",
  "requestId": "req_1705312200000_abc123def",
  "metadata": {
    "authMethod": "oauth",
    "provider": "github",
    "loginDuration": 1250
  }
}
```

### Error Log Entry

```json
{
  "timestamp": "2024-01-15T10:31:00.000Z",
  "level": "error",
  "message": "Database connection failed",
  "service": "catalog-service",
  "requestId": "req_1705312260000_xyz789abc",
  "metadata": {
    "error": {
      "name": "ConnectionError",
      "message": "ECONNREFUSED 127.0.0.1:5432",
      "stack": "Error: ECONNREFUSED 127.0.0.1:5432\n    at ..."
    },
    "database": "postgresql",
    "host": "localhost",
    "port": 5432
  }
}
```

## Monitoring and Alerting

### CloudWatch Metrics

Create custom metrics from log data:

```bash
# Create metric filter for error logs
aws logs put-metric-filter \
  --log-group-name /backstage/application \
  --filter-name ErrorCount \
  --filter-pattern '[timestamp, level="error", ...]' \
  --metric-transformations \
    metricName=BackstageErrors,metricNamespace=Backstage,metricValue=1
```

### Log Insights Queries

```sql
-- Find all errors in the last hour
fields @timestamp, service, message, metadata.error.message
| filter level = "error"
| filter @timestamp > @timestamp - 1h
| sort @timestamp desc

-- Request duration analysis
fields @timestamp, service, metadata.duration
| filter level = "info" and message like /request completed/
| stats avg(metadata.duration), max(metadata.duration), min(metadata.duration) by service
```

## Performance Considerations

1. **Log Level Management**: Use appropriate log levels in production
2. **Sampling**: Implement log sampling for high-volume services
3. **Async Logging**: Winston handles async logging automatically
4. **Buffer Management**: CloudWatch transport includes automatic batching
5. **File Rotation**: Configure appropriate retention policies

## Troubleshooting

### Common Issues

1. **CloudWatch Permission Denied**: Verify IAM permissions and AWS credentials
2. **File Permission Issues**: Ensure write permissions for log directory
3. **High Memory Usage**: Adjust log levels and file rotation settings
4. **Missing Logs**: Check transport configuration and network connectivity

### Debug Mode

Enable debug logging:

```yaml
logging:
  level: debug
```

### Health Check

Monitor plugin health:

```bash
curl http://localhost:7007/api/logging/health
```

## Development

```bash
# Install dependencies
yarn install

# Build the plugin
yarn build

# Run tests
yarn test

# Type checking
yarn tsc
```

## License

Copyright © 2024 Your Organization. All rights reserved.
