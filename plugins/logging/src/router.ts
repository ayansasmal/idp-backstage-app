import { Router } from 'express';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { LoggingService } from './service';

export interface RouterOptions {
    logger: LoggerService;
    config: Config;
    loggingService: LoggingService;
}

/**
 * Creates an Express router for logging endpoints
 */
export async function createRouter(options: RouterOptions): Promise<Router> {
    const { logger, loggingService } = options;
    const router = Router();

    router.use((req, res, next) => {
        // Add request ID for tracing
        req.headers['x-request-id'] = req.headers['x-request-id'] || generateRequestId();
        next();
    });

    /**
     * Health check endpoint
     */
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'logging',
        });
    });

    /**
     * Get logging configuration and statistics
     */
    router.get('/stats', (req, res) => {
        try {
            const stats = loggingService.getStatistics();
            res.json({
                ...stats,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Failed to get logging statistics', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to get logging statistics',
                timestamp: new Date().toISOString(),
            });
        }
    });

    /**
     * Log a custom message via API
     */
    router.post('/log', (req, res) => {
        try {
            const { level, message, service, metadata } = req.body;
            const requestId = req.headers['x-request-id'] as string;

            if (!level || !message) {
                return res.status(400).json({
                    error: 'Missing required fields: level and message',
                    timestamp: new Date().toISOString(),
                });
            }

            // Validate log level
            const validLevels = ['error', 'warn', 'info', 'debug'];
            if (!validLevels.includes(level)) {
                return res.status(400).json({
                    error: `Invalid log level. Must be one of: ${validLevels.join(', ')}`,
                    timestamp: new Date().toISOString(),
                });
            }

            loggingService.log({
                level,
                message,
                timestamp: new Date(),
                service: service || 'api',
                requestId,
                metadata,
            });

            res.json({
                status: 'logged',
                timestamp: new Date().toISOString(),
                requestId,
            });
        } catch (error) {
            logger.error('Failed to log message via API', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to log message',
                timestamp: new Date().toISOString(),
            });
        }
    });

    /**
     * Trigger maintenance tasks
     */
    router.post('/maintenance', async (req, res) => {
        try {
            await loggingService.performMaintenance();
            res.json({
                status: 'maintenance completed',
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Failed to perform maintenance', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to perform maintenance',
                timestamp: new Date().toISOString(),
            });
        }
    });

    // Error handling middleware
    router.use((error: Error, req: any, res: any, next: any) => {
        logger.error('Router error', error);
        loggingService.error('Router error', error, {
            url: req.url,
            method: req.method,
            headers: req.headers,
        }, {
            service: 'logging-router',
            requestId: req.headers['x-request-id'],
        });

        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'],
        });
    });

    return router;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
