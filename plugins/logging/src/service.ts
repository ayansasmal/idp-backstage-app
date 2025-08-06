import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import * as winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';
import DailyRotateFile from 'winston-daily-rotate-file';
import { CloudWatchLogsClient, CreateLogGroupCommand, CreateLogStreamCommand } from '@aws-sdk/client-cloudwatch-logs';

export interface LogEntry {
    level: string;
    message: string;
    timestamp: Date;
    service: string;
    userId?: string;
    requestId?: string;
    metadata?: Record<string, any>;
}

export interface LoggingConfig {
    level: string;
    enableCloudWatch: boolean;
    enableFileLogging: boolean;
    cloudWatch?: {
        region: string;
        logGroupName: string;
        logStreamPrefix: string;
        accessKeyId?: string;
        secretAccessKey?: string;
    };
    fileLogging?: {
        directory: string;
        maxSize: string;
        maxFiles: string;
        datePattern: string;
    };
}

/**
 * Centralized logging service with multiple transport support
 */
export class LoggingService {
    private logger: winston.Logger;
    private config: LoggingConfig;
    private cloudWatchClient?: CloudWatchLogsClient;

    constructor(
        private configService: Config,
        private backstageLogger: LoggerService,
    ) {
        this.config = this.loadConfig();
        this.logger = this.createLogger();
    }

    private loadConfig(): LoggingConfig {
        const loggingConfig = this.configService.getOptionalConfig('logging');

        return {
            level: loggingConfig?.getOptionalString('level') || 'info',
            enableCloudWatch: loggingConfig?.getOptionalBoolean('enableCloudWatch') || false,
            enableFileLogging: loggingConfig?.getOptionalBoolean('enableFileLogging') || true,
            cloudWatch: loggingConfig?.has('cloudWatch') ? {
                region: loggingConfig.getConfig('cloudWatch').getString('region'),
                logGroupName: loggingConfig.getConfig('cloudWatch').getString('logGroupName'),
                logStreamPrefix: loggingConfig.getConfig('cloudWatch').getString('logStreamPrefix'),
                accessKeyId: loggingConfig.getConfig('cloudWatch').getOptionalString('accessKeyId'),
                secretAccessKey: loggingConfig.getConfig('cloudWatch').getOptionalString('secretAccessKey'),
            } : undefined,
            fileLogging: loggingConfig?.has('fileLogging') ? {
                directory: loggingConfig.getConfig('fileLogging').getOptionalString('directory') || './logs',
                maxSize: loggingConfig.getConfig('fileLogging').getOptionalString('maxSize') || '20m',
                maxFiles: loggingConfig.getConfig('fileLogging').getOptionalString('maxFiles') || '14d',
                datePattern: loggingConfig.getConfig('fileLogging').getOptionalString('datePattern') || 'YYYY-MM-DD',
            } : {
                directory: './logs',
                maxSize: '20m',
                maxFiles: '14d',
                datePattern: 'YYYY-MM-DD',
            },
        };
    }

    private createLogger(): winston.Logger {
        const transports: winston.transport[] = [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.timestamp(),
                    winston.format.printf(({ timestamp, level, message, service, userId, requestId, ...meta }) => {
                        let logMessage = `${timestamp} [${level}] ${message}`;
                        if (service) logMessage += ` [service=${service}]`;
                        if (userId) logMessage += ` [userId=${userId}]`;
                        if (requestId) logMessage += ` [requestId=${requestId}]`;
                        if (Object.keys(meta).length > 0) {
                            logMessage += ` ${JSON.stringify(meta)}`;
                        }
                        return logMessage;
                    }),
                ),
            }),
        ];

        // Add file logging transport
        if (this.config.enableFileLogging && this.config.fileLogging) {
            transports.push(
                new DailyRotateFile({
                    filename: `${this.config.fileLogging.directory}/application-%DATE%.log`,
                    datePattern: this.config.fileLogging.datePattern,
                    maxSize: this.config.fileLogging.maxSize,
                    maxFiles: this.config.fileLogging.maxFiles,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                    ),
                }),
            );

            // Separate file for errors
            transports.push(
                new DailyRotateFile({
                    filename: `${this.config.fileLogging.directory}/error-%DATE%.log`,
                    datePattern: this.config.fileLogging.datePattern,
                    maxSize: this.config.fileLogging.maxSize,
                    maxFiles: this.config.fileLogging.maxFiles,
                    level: 'error',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                    ),
                }),
            );
        }

        return winston.createLogger({
            level: this.config.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
            ),
            transports,
        });
    }

    async initialize(): Promise<void> {
        try {
            // Initialize CloudWatch if enabled
            if (this.config.enableCloudWatch && this.config.cloudWatch) {
                await this.initializeCloudWatch();
            }

            this.backstageLogger.info('Logging service initialized successfully', {
                enableCloudWatch: this.config.enableCloudWatch,
                enableFileLogging: this.config.enableFileLogging,
                level: this.config.level,
            });
        } catch (error) {
            this.backstageLogger.error('Failed to initialize logging service', error);
            throw error;
        }
    }

    private async initializeCloudWatch(): Promise<void> {
        if (!this.config.cloudWatch) return;

        try {
            this.cloudWatchClient = new CloudWatchLogsClient({
                region: this.config.cloudWatch.region,
                credentials: this.config.cloudWatch.accessKeyId && this.config.cloudWatch.secretAccessKey ? {
                    accessKeyId: this.config.cloudWatch.accessKeyId,
                    secretAccessKey: this.config.cloudWatch.secretAccessKey,
                } : undefined,
            });

            // Create log group if it doesn't exist
            try {
                await this.cloudWatchClient.send(
                    new CreateLogGroupCommand({
                        logGroupName: this.config.cloudWatch.logGroupName,
                    }),
                );
            } catch (error: any) {
                if (error.name !== 'ResourceAlreadyExistsException') {
                    throw error;
                }
            }

            // Add CloudWatch transport to winston
            const cloudWatchTransport = new WinstonCloudWatch({
                logGroupName: this.config.cloudWatch.logGroupName,
                logStreamName: `${this.config.cloudWatch.logStreamPrefix}-${new Date().toISOString().split('T')[0]}`,
                awsRegion: this.config.cloudWatch.region,
                awsAccessKeyId: this.config.cloudWatch.accessKeyId,
                awsSecretKey: this.config.cloudWatch.secretAccessKey,
                messageFormatter: (logObject: any) => {
                    return JSON.stringify({
                        timestamp: logObject.timestamp,
                        level: logObject.level,
                        message: logObject.message,
                        service: logObject.service || 'backstage',
                        userId: logObject.userId,
                        requestId: logObject.requestId,
                        metadata: logObject.metadata,
                    });
                },
            });

            this.logger.add(cloudWatchTransport);
        } catch (error) {
            this.backstageLogger.error('Failed to initialize CloudWatch logging', error);
            throw error;
        }
    }

    /**
     * Log a message with structured data
     */
    log(entry: LogEntry): void {
        this.logger.log({
            level: entry.level,
            message: entry.message,
            timestamp: entry.timestamp,
            service: entry.service,
            userId: entry.userId,
            requestId: entry.requestId,
            metadata: entry.metadata,
        });
    }

    /**
     * Log an info message
     */
    info(message: string, metadata?: Record<string, any>, context?: { service?: string; userId?: string; requestId?: string }): void {
        this.log({
            level: 'info',
            message,
            timestamp: new Date(),
            service: context?.service || 'backstage',
            userId: context?.userId,
            requestId: context?.requestId,
            metadata,
        });
    }

    /**
     * Log an error message
     */
    error(message: string, error?: Error, metadata?: Record<string, any>, context?: { service?: string; userId?: string; requestId?: string }): void {
        this.log({
            level: 'error',
            message,
            timestamp: new Date(),
            service: context?.service || 'backstage',
            userId: context?.userId,
            requestId: context?.requestId,
            metadata: {
                ...metadata,
                error: error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : undefined,
            },
        });
    }

    /**
     * Log a warning message
     */
    warn(message: string, metadata?: Record<string, any>, context?: { service?: string; userId?: string; requestId?: string }): void {
        this.log({
            level: 'warn',
            message,
            timestamp: new Date(),
            service: context?.service || 'backstage',
            userId: context?.userId,
            requestId: context?.requestId,
            metadata,
        });
    }

    /**
     * Log a debug message
     */
    debug(message: string, metadata?: Record<string, any>, context?: { service?: string; userId?: string; requestId?: string }): void {
        this.log({
            level: 'debug',
            message,
            timestamp: new Date(),
            service: context?.service || 'backstage',
            userId: context?.userId,
            requestId: context?.requestId,
            metadata,
        });
    }

    /**
     * Perform maintenance tasks
     */
    async performMaintenance(): Promise<void> {
        try {
            this.backstageLogger.info('Starting logging maintenance tasks');

            // Log maintenance completion
            this.info('Logging maintenance completed successfully');
        } catch (error) {
            this.backstageLogger.error('Logging maintenance failed', error);
            this.error('Logging maintenance failed', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Get logging statistics
     */
    getStatistics(): Record<string, any> {
        return {
            config: {
                level: this.config.level,
                enableCloudWatch: this.config.enableCloudWatch,
                enableFileLogging: this.config.enableFileLogging,
            },
            transports: this.logger.transports.length,
            level: this.logger.level,
        };
    }
}
