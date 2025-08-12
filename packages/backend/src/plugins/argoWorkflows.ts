import {
  createBackendPlugin,
  coreServices,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { ArgoWorkflowsProvider } from './argoWorkflows/argoWorkflowsProvider';

export default createBackendPlugin({
  pluginId: 'argo-workflows',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        const argoWorkflowsProvider = new ArgoWorkflowsProvider(
          config,
          logger,
        );
        const router = Router();

        // Get all workflows
        router.get('/workflows', async (req, res) => {
          try {
            const { namespace, labelSelector } = req.query;

            let workflows;
            if (labelSelector) {
              workflows = await argoWorkflowsProvider.getWorkflowsByLabel(
                labelSelector as string,
                namespace as string,
              );
            } else {
              workflows = await argoWorkflowsProvider.getWorkflows(
                namespace as string,
              );
            }

            res.json(workflows);
          } catch (error) {
            logger.error('Failed to get workflows', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get specific workflow
        router.get('/workflows/:namespace/:name', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const workflow = await argoWorkflowsProvider.getWorkflow(
              name,
              namespace,
            );

            if (!workflow) {
              return res.status(404).json({ error: 'Workflow not found' });
            }

            return res.json(workflow);
          } catch (error) {
            logger.error('Failed to get workflow', { error });
            return res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Create workflow
        router.post('/workflows', async (req, res) => {
          try {
            const { namespace } = req.query;
            const workflow = await argoWorkflowsProvider.createWorkflow(
              req.body,
              namespace as string,
            );
            res.status(201).json(workflow);
          } catch (error) {
            logger.error('Failed to create workflow', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Submit workflow from template
        router.post('/workflows/submit', async (req, res) => {
          try {
            const { templateName, parameters, namespace } = req.body;
            const workflow =
              await argoWorkflowsProvider.submitWorkflowFromTemplate(
                templateName,
                parameters,
                namespace,
              );
            res.status(201).json(workflow);
          } catch (error) {
            logger.error('Failed to submit workflow', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Retry workflow
        router.put('/workflows/:namespace/:name/retry', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const workflow = await argoWorkflowsProvider.retryWorkflow(
              name,
              namespace,
            );
            res.json(workflow);
          } catch (error) {
            logger.error('Failed to retry workflow', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Stop workflow
        router.put('/workflows/:namespace/:name/stop', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const workflow = await argoWorkflowsProvider.stopWorkflow(
              name,
              namespace,
            );
            res.json(workflow);
          } catch (error) {
            logger.error('Failed to stop workflow', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Delete workflow
        router.delete('/workflows/:namespace/:name', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            await argoWorkflowsProvider.deleteWorkflow(name, namespace);
            res.status(204).send();
          } catch (error) {
            logger.error('Failed to delete workflow', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get workflow logs
        router.get('/workflows/:namespace/:name/logs', async (req, res) => {
          try {
            const { namespace, name } = req.params;
            const { podName } = req.query;
            const logs = await argoWorkflowsProvider.getWorkflowLogs(
              name,
              namespace,
              podName as string,
            );
            res.json({ logs });
          } catch (error) {
            logger.error('Failed to get workflow logs', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get workflow templates
        router.get('/workflow-templates', async (req, res) => {
          try {
            const { namespace } = req.query;
            const templates = await argoWorkflowsProvider.getWorkflowTemplates(
              namespace as string,
            );
            res.json(templates);
          } catch (error) {
            logger.error('Failed to get workflow templates', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Get cluster workflow templates
        router.get('/cluster-workflow-templates', async (req, res) => {
          try {
            const templates =
              await argoWorkflowsProvider.getClusterWorkflowTemplates();
            res.json(templates);
          } catch (error) {
            logger.error('Failed to get cluster workflow templates', { error });
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        // Health check
        router.get('/health', (req, res) => {
          res.json({ status: 'healthy' });
        });

        httpRouter.use('/api/argo-workflows', router);
      },
    });
  },
});