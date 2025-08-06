import { Router } from 'express';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ArgoWorkflowsService } from './service';

export interface RouterOptions {
    logger: LoggerService;
    config: Config;
    argoService: ArgoWorkflowsService;
}

/**
 * Creates an Express router for Argo Workflows endpoints
 */
export async function createRouter(options: RouterOptions): Promise<Router> {
    const { logger, argoService } = options;
    const router = Router();

    /**
     * Health check endpoint
     */
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'argo-workflows',
        });
    });

    /**
     * Get all workflows
     */
    router.get('/workflows', async (req, res) => {
        try {
            const labelSelector = req.query.labelSelector as string;

            let workflows;
            if (labelSelector) {
                workflows = await argoService.getWorkflowsByLabel(labelSelector);
            } else {
                workflows = await argoService.getWorkflows();
            }

            res.json(workflows);
        } catch (error) {
            logger.error('Failed to get workflows', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to get workflows',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * Get a specific workflow
     */
    router.get('/workflows/:name', async (req, res) => {
        try {
            const { name } = req.params;
            const workflow = await argoService.getWorkflow(name);
            res.json(workflow);
        } catch (error) {
            logger.error('Failed to get workflow', error instanceof Error ? error : new Error(String(error)));

            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({
                    error: 'Workflow not found',
                    message: error.message,
                });
            } else {
                res.status(500).json({
                    error: 'Failed to get workflow',
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }
    });

    /**
     * Get workflow logs
     */
    router.get('/workflows/:name/logs', async (req, res) => {
        try {
            const { name } = req.params;
            const { step } = req.query;

            const logs = await argoService.getWorkflowLogs(name, step as string);
            res.json({ logs });
        } catch (error) {
            logger.error('Failed to get workflow logs', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to get workflow logs',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * Submit a new workflow
     */
    router.post('/workflows', async (req, res) => {
        try {
            const { templateName, parameters } = req.body;

            if (!templateName) {
                return res.status(400).json({
                    error: 'Missing required field: templateName',
                });
            }

            const workflow = await argoService.submitWorkflow(templateName, parameters);
            res.status(201).json(workflow);
        } catch (error) {
            logger.error('Failed to submit workflow', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to submit workflow',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * Delete a workflow
     */
    router.delete('/workflows/:name', async (req, res) => {
        try {
            const { name } = req.params;
            await argoService.deleteWorkflow(name);
            res.status(204).send();
        } catch (error) {
            logger.error('Failed to delete workflow', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to delete workflow',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * Get workflow templates
     */
    router.get('/templates', async (req, res) => {
        try {
            const templates = await argoService.getWorkflowTemplates();
            res.json(templates);
        } catch (error) {
            logger.error('Failed to get workflow templates', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to get workflow templates',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * Get workflow statistics
     */
    router.get('/statistics', async (req, res) => {
        try {
            const stats = await argoService.getWorkflowStatistics();
            res.json(stats);
        } catch (error) {
            logger.error('Failed to get workflow statistics', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                error: 'Failed to get workflow statistics',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });

    // Error handling middleware
    router.use((error: Error, req: any, res: any, next: any) => {
        logger.error('Argo Workflows router error', error);
        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString(),
        });
    });

    return router;
}
