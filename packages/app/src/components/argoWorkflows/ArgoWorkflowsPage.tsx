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
  StatusPending,
  StatusWarning,
} from '@backstage/core-components';
import {
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Stop, Refresh, Delete, ViewList } from '@material-ui/icons';

const useStyles = makeStyles(theme => ({
  workflowCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  statusIcon: {
    marginRight: theme.spacing(1),
  },
  actionButton: {
    marginRight: theme.spacing(1),
  },
  logContainer: {
    backgroundColor: theme.palette.grey[900],
    color: theme.palette.common.white,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: 400,
    overflow: 'auto',
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
      id={`workflows-tabpanel-${index}`}
      aria-labelledby={`workflows-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

export const ArgoWorkflowsPage = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const configApi = useApi(configApiRef);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<any[]>([]);
  const [clusterTemplates, setClusterTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [workflowLogs, setWorkflowLogs] = useState<string>('');
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateParameters, setTemplateParameters] = useState<
    Record<string, string>
  >({});

  const namespace = entity.metadata.namespace || 'default';
  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchWorkflowsData();
  }, [namespace]);

  const fetchWorkflowsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [workflowsResponse, templatesResponse, clusterTemplatesResponse] =
        await Promise.allSettled([
          fetch(
            `${backendUrl}/api/argo-workflows/workflows?namespace=${namespace}`,
          ),
          fetch(
            `${backendUrl}/api/argo-workflows/workflow-templates?namespace=${namespace}`,
          ),
          fetch(`${backendUrl}/api/argo-workflows/cluster-workflow-templates`),
        ]);

      if (
        workflowsResponse.status === 'fulfilled' &&
        workflowsResponse.value.ok
      ) {
        setWorkflows(await workflowsResponse.value.json());
      }

      if (
        templatesResponse.status === 'fulfilled' &&
        templatesResponse.value.ok
      ) {
        setWorkflowTemplates(await templatesResponse.value.json());
      }

      if (
        clusterTemplatesResponse.status === 'fulfilled' &&
        clusterTemplatesResponse.value.ok
      ) {
        setClusterTemplates(await clusterTemplatesResponse.value.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

  const getWorkflowStatus = (workflow: any) => {
    const phase = workflow.status?.phase;
    switch (phase) {
      case 'Succeeded':
        return <StatusOK>Succeeded</StatusOK>;
      case 'Failed':
      case 'Error':
        return <StatusError>{phase}</StatusError>;
      case 'Running':
        return <StatusWarning>Running</StatusWarning>;
      default:
        return <StatusPending>Pending</StatusPending>;
    }
  };

  const handleWorkflowAction = async (action: string, workflow: any) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/argo-workflows/workflows/${workflow.metadata.namespace}/${workflow.metadata.name}/${action}`,
        { method: 'PUT' },
      );

      if (response.ok) {
        await fetchWorkflowsData();
      }
    } catch (error) {
      console.error(`Failed to ${action} workflow:`, error);
    }
  };

  const handleDeleteWorkflow = async (workflow: any) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/argo-workflows/workflows/${workflow.metadata.namespace}/${workflow.metadata.name}`,
        { method: 'DELETE' },
      );

      if (response.ok) {
        await fetchWorkflowsData();
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  const handleViewLogs = async (workflow: any) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/argo-workflows/workflows/${workflow.metadata.namespace}/${workflow.metadata.name}/logs`,
      );

      if (response.ok) {
        const { logs } = await response.json();
        setWorkflowLogs(logs);
        setSelectedWorkflow(workflow);
        setLogsDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to get workflow logs:', error);
    }
  };

  const handleSubmitWorkflow = async () => {
    try {
      const response = await fetch(
        `${backendUrl}/api/argo-workflows/workflows/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateName: selectedTemplate,
            parameters: templateParameters,
            namespace,
          }),
        },
      );

      if (response.ok) {
        await fetchWorkflowsData();
        setSubmitDialogOpen(false);
        setSelectedTemplate('');
        setTemplateParameters({});
      }
    } catch (error) {
      console.error('Failed to submit workflow:', error);
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="CI/CD Workflows" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="CI/CD Workflows" />
        <Content>
          <Typography color="error">Error: {error}</Typography>
        </Content>
      </Page>
    );
  }

  return (
    <ErrorBoundary>
      <Page themeId="tool">
        <Header title="CI/CD Workflows" subtitle={`Namespace: ${namespace}`}>
          <SupportButton>
            Manage and monitor Argo Workflows for continuous integration and
            deployment.
          </SupportButton>
        </Header>
        <Content>
          <ContentHeader title="Argo Workflows Dashboard">
            <Button
              variant="contained"
              color="primary"
              onClick={() => setSubmitDialogOpen(true)}
              disabled={
                workflowTemplates.length === 0 && clusterTemplates.length === 0
              }
            >
              Submit Workflow
            </Button>
          </ContentHeader>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Active Workflows" />
              <Tab label="Workflow Templates" />
              <Tab label="Cluster Templates" />
              <Tab label="Workflow History" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <WorkflowsTable
              workflows={workflows.filter(
                w =>
                  w.status?.phase === 'Running' ||
                  w.status?.phase === 'Pending',
              )}
              getWorkflowStatus={getWorkflowStatus}
              onAction={handleWorkflowAction}
              onDelete={handleDeleteWorkflow}
              onViewLogs={handleViewLogs}
              classes={classes}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <WorkflowTemplatesTable templates={workflowTemplates} />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <WorkflowTemplatesTable templates={clusterTemplates} />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <WorkflowsTable
              workflows={workflows}
              getWorkflowStatus={getWorkflowStatus}
              onAction={handleWorkflowAction}
              onDelete={handleDeleteWorkflow}
              onViewLogs={handleViewLogs}
              classes={classes}
              showAll
            />
          </TabPanel>

          {/* Workflow Logs Dialog */}
          <Dialog
            open={logsDialogOpen}
            onClose={() => setLogsDialogOpen(false)}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              Workflow Logs - {selectedWorkflow?.metadata?.name}
            </DialogTitle>
            <DialogContent>
              <Box className={classes.logContainer}>
                <pre>{workflowLogs || 'No logs available'}</pre>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setLogsDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Submit Workflow Dialog */}
          <Dialog
            open={submitDialogOpen}
            onClose={() => setSubmitDialogOpen(false)}
          >
            <DialogTitle>Submit Workflow</DialogTitle>
            <DialogContent>
              <FormControl fullWidth margin="normal">
                <InputLabel>Template</InputLabel>
                <Select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value as string)}
                >
                  {workflowTemplates.map(template => (
                    <MenuItem
                      key={template.metadata.name}
                      value={template.metadata.name}
                    >
                      {template.metadata.name} (Namespace)
                    </MenuItem>
                  ))}
                  {clusterTemplates.map(template => (
                    <MenuItem
                      key={template.metadata.name}
                      value={template.metadata.name}
                    >
                      {template.metadata.name} (Cluster)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                margin="normal"
                label="Parameters (JSON)"
                multiline
                rows={4}
                value={JSON.stringify(templateParameters, null, 2)}
                onChange={e => {
                  try {
                    setTemplateParameters(JSON.parse(e.target.value));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmitWorkflow}
                color="primary"
                disabled={!selectedTemplate}
              >
                Submit
              </Button>
            </DialogActions>
          </Dialog>
        </Content>
      </Page>
    </ErrorBoundary>
  );
};

const WorkflowsTable = ({
  workflows,
  getWorkflowStatus,
  onAction,
  onDelete,
  onViewLogs,
  classes,
}: any) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Started</TableCell>
          <TableCell>Duration</TableCell>
          <TableCell>Progress</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {workflows.map((workflow: any) => (
          <TableRow key={workflow.metadata.name}>
            <TableCell>{workflow.metadata.name}</TableCell>
            <TableCell>{getWorkflowStatus(workflow)}</TableCell>
            <TableCell>
              {workflow.status?.startedAt
                ? new Date(workflow.status.startedAt).toLocaleString()
                : 'Not started'}
            </TableCell>
            <TableCell>
              {workflow.status?.startedAt && workflow.status?.finishedAt
                ? `${Math.round(
                    (new Date(workflow.status.finishedAt).getTime() -
                      new Date(workflow.status.startedAt).getTime()) /
                      1000,
                  )}s`
                : workflow.status?.startedAt
                ? `${Math.round(
                    (Date.now() -
                      new Date(workflow.status.startedAt).getTime()) /
                      1000,
                  )}s`
                : '-'}
            </TableCell>
            <TableCell>{workflow.status?.progress || '-'}</TableCell>
            <TableCell>
              <Button
                size="small"
                className={classes.actionButton}
                onClick={() => onViewLogs(workflow)}
                startIcon={<ViewList />}
              >
                Logs
              </Button>
              {workflow.status?.phase === 'Running' && (
                <Button
                  size="small"
                  className={classes.actionButton}
                  onClick={() => onAction('stop', workflow)}
                  startIcon={<Stop />}
                >
                  Stop
                </Button>
              )}
              {(workflow.status?.phase === 'Failed' ||
                workflow.status?.phase === 'Error') && (
                <Button
                  size="small"
                  className={classes.actionButton}
                  onClick={() => onAction('retry', workflow)}
                  startIcon={<Refresh />}
                >
                  Retry
                </Button>
              )}
              <Button
                size="small"
                color="secondary"
                onClick={() => onDelete(workflow)}
                startIcon={<Delete />}
              >
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const WorkflowTemplatesTable = ({ templates }: any) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Entrypoint</TableCell>
          <TableCell>Templates</TableCell>
          <TableCell>Parameters</TableCell>
          <TableCell>Created</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {templates.map((template: any) => (
          <TableRow key={template.metadata.name}>
            <TableCell>{template.metadata.name}</TableCell>
            <TableCell>
              <Chip label={template.spec.entrypoint} size="small" />
            </TableCell>
            <TableCell>{template.spec.templates?.length || 0}</TableCell>
            <TableCell>
              {template.spec.arguments?.parameters?.length || 0}
            </TableCell>
            <TableCell>
              {template.metadata.creationTimestamp
                ? new Date(
                    template.metadata.creationTimestamp,
                  ).toLocaleDateString()
                : 'Unknown'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);