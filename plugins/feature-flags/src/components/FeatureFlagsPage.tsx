import React, { useState, useEffect } from 'react';
import { Content, Header, HeaderLabel, Page } from '@backstage/core-components';
import {
  IconButton,
  Tooltip,
  Chip,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  Fade,
  Slide,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  makeStyles,
} from '@material-ui/core';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Flag as FlagIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  Computer as ComputerIcon,
  Apps as AppsIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  searchBar: {
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  searchContainer: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchField: {
    minWidth: 250,
    flex: 1,
  },
  filterSelect: {
    minWidth: 150,
  },
  actionButtons: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(6),
  },
  flagsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: theme.spacing(3),
  },
  flagCard: {
    cursor: 'pointer',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.short,
    }),
    '&:hover': {
      transform: 'scale(1.02)',
    },
  },
  flagHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(2),
  },
  flagInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  flagActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  flagDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  statusContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing(2),
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(6),
  },
  emptyIcon: {
    fontSize: 64,
    color: theme.palette.grey[300],
    marginBottom: theme.spacing(2),
  },
  dialogHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  enabledFlag: {
    color: theme.palette.success.main,
  },
  disabledFlag: {
    color: theme.palette.grey[500],
  },
}));

interface FeatureFlag {
  name: string;
  enabled?: boolean;
  description?: string;
  tenant?: string;
  environment?: string;
  application?: string;
  flagName?: string;
  createdAt?: string;
  lastModified?: string;
}

interface CreateFlagForm {
  tenant: string;
  environment: string;
  application: string;
  flagName: string;
  description: string;
}

export const FeatureFlagsPage = () => {
  const classes = useStyles();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [filteredFlags, setFilteredFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [form, setForm] = useState<CreateFlagForm>({
    tenant: '',
    environment: '',
    application: '',
    flagName: '',
    description: '',
  });

  // Fetch feature flags
  const fetchFlags = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/feature-flags');
      const data = await response.json();
      const processedFlags = data.map((flag: any) => {
        const [tenant, environment, application, ...flagParts] = flag.name.split('.');
        return {
          name: flag.name,
          enabled: flag.enabled || false,
          description: flag.description || '',
          tenant,
          environment,
          application,
          flagName: flagParts.join('.'),
          createdAt: flag.createdAt || new Date().toISOString(),
          lastModified: flag.lastModified || new Date().toISOString(),
        };
      });
      setFlags(processedFlags);
      setFilteredFlags(processedFlags);
    } catch (error) {
      console.error('Error fetching flags:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter flags based on search and filters
  useEffect(() => {
    let filtered = flags;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(flag =>
        flag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flag.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flag.flagName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Environment filter
    if (environmentFilter) {
      filtered = filtered.filter(flag => flag.environment === environmentFilter);
    }

    // Tenant filter
    if (tenantFilter) {
      filtered = filtered.filter(flag => flag.tenant === tenantFilter);
    }

    setFilteredFlags(filtered);
  }, [flags, searchQuery, environmentFilter, tenantFilter]);

  useEffect(() => {
    fetchFlags();
  }, []);

  // Get unique values for filters
  const uniqueEnvironments = [...new Set(flags.map(flag => flag.environment).filter(Boolean))];
  const uniqueTenants = [...new Set(flags.map(flag => flag.tenant).filter(Boolean))];

  // Handle form input changes
  const handleInputChange = (field: keyof CreateFlagForm) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: event.target.value }));
  };

  // Create new feature flag
  const handleCreateFlag = async () => {
    try {
      const response = await fetch('/api/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        setForm({ tenant: '', environment: '', application: '', flagName: '', description: '' });
        setCreateDialogOpen(false);
        fetchFlags(); // Refresh the list
      } else {
        const error = await response.json();
        console.error('Error creating flag:', error.error);
      }
    } catch (error) {
      console.error('Error creating flag:', error);
    }
  };

  // Toggle flag status
  const handleToggleFlag = async (flagName: string) => {
    try {
      const response = await fetch(`/api/feature-flags/${encodeURIComponent(flagName)}/toggle`, {
        method: 'PATCH',
      });

      if (response.ok) {
        const updatedFlag = await response.json();
        console.log(`Toggled flag ${flagName} to ${updatedFlag.enabled}`);
        // Refresh the flags to show updated state
        fetchFlags();
      } else {
        const error = await response.json();
        console.error('Error toggling flag:', error.error);
      }
    } catch (error) {
      console.error('Error toggling flag:', error);
    }
  };

  // Delete feature flag
  const handleDeleteFlag = async (flagName: string) => {
    try {
      const response = await fetch(`/api/feature-flags/${encodeURIComponent(flagName)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log(`Deleted flag ${flagName}`);
        // Refresh the flags to show updated state
        fetchFlags();
      } else {
        const error = await response.json();
        console.error('Error deleting flag:', error.error);
      }
    } catch (error) {
      console.error('Error deleting flag:', error);
    }
    handleMenuClose();
  };

  // Handle menu actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, flag: FeatureFlag) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedFlag(flag);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedFlag(null);
  };

  // Get environment color
  const getEnvironmentColor = (environment: string): 'primary' | 'secondary' | 'default' => {
    switch (environment?.toLowerCase()) {
      case 'production': case 'prod': return 'secondary';
      case 'staging': case 'stage': return 'primary';
      case 'development': case 'dev': return 'default';
      default: return 'default';
    }
  };

  return (
    <Page themeId="tool">
      <Header
        title="Feature Flags"
        subtitle={`Manage feature flags across environments (${filteredFlags.length} flags)`}
      >
        <HeaderLabel label="Platform" value="IDP" />
        <HeaderLabel label="Type" value="Configuration" />
      </Header>

      <Content>
        {/* Search and Filter Bar */}
        <Box className={classes.searchBar}>
          <Box className={classes.searchContainer}>
            {/* Search Input */}
            <TextField
              placeholder="Search flags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              size="small"
              className={classes.searchField}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            {/* Environment Filter */}
            <FormControl variant="outlined" size="small" className={classes.filterSelect}>
              <InputLabel>Environment</InputLabel>
              <Select
                value={environmentFilter}
                onChange={(e) => setEnvironmentFilter(e.target.value as string)}
                label="Environment"
              >
                <MenuItem value="">All Environments</MenuItem>
                {uniqueEnvironments.map(env => (
                  <MenuItem key={env} value={env}>{env}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Tenant Filter */}
            <FormControl variant="outlined" size="small" className={classes.filterSelect}>
              <InputLabel>Tenant</InputLabel>
              <Select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value as string)}
                label="Tenant"
              >
                <MenuItem value="">All Tenants</MenuItem>
                {uniqueTenants.map(tenant => (
                  <MenuItem key={tenant} value={tenant}>{tenant}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Action Buttons */}
            <Box className={classes.actionButtons}>
              <Tooltip title="Refresh flags">
                <IconButton
                  onClick={fetchFlags}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Flag
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Loading State */}
        {loading && (
          <Box className={classes.loadingContainer}>
            <CircularProgress size={32} />
            <Typography variant="body1" style={{ marginLeft: 16 }}>
              Loading feature flags...
            </Typography>
          </Box>
        )}

        {/* Feature Flags Grid */}
        {!loading && (
          <Fade in={!loading} timeout={500}>
            <Box className={classes.flagsGrid}>
              {filteredFlags.map((flag, index) => (
                <Slide
                  in={true}
                  direction="up"
                  timeout={300 + index * 100}
                  key={flag.name}
                >
                  <Card className={classes.flagCard}>
                    <CardContent>
                      {/* Flag Header */}
                      <Box className={classes.flagHeader}>
                        <Box className={classes.flagInfo}>
                          <FlagIcon
                            className={flag.enabled ? classes.enabledFlag : classes.disabledFlag}
                          />
                          <Box>
                            <Typography variant="h6">
                              {flag.flagName || flag.name}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {flag.name}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Action Buttons */}
                        <Box className={classes.flagActions}>
                          <Tooltip title={`${flag.enabled ? 'Disable' : 'Enable'} flag`}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleFlag(flag.name)}
                            >
                              {flag.enabled ? (
                                <ToggleOnIcon className={classes.enabledFlag} />
                              ) : (
                                <ToggleOffIcon className={classes.disabledFlag} />
                              )}
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="More actions">
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, flag)}
                            >
                              <MoreVertIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      {/* Flag Details */}
                      <Box className={classes.flagDetails}>
                        {/* Description */}
                        {flag.description && (
                          <Typography variant="body2" className="text-gray-600 italic">
                            {flag.description}
                          </Typography>
                        )}

                        {/* Metadata Tags */}
                        <Box className={classes.tagsContainer}>
                          {flag.tenant && (
                            <Chip
                              size="small"
                              icon={<BusinessIcon />}
                              label={flag.tenant}
                              className="feature-badge-tenant text-xs"
                            />
                          )}

                          {flag.environment && (
                            <Chip
                              size="small"
                              icon={<ComputerIcon />}
                              label={flag.environment}
                              color={getEnvironmentColor(flag.environment)}
                              className="text-xs"
                            />
                          )}

                          {flag.application && (
                            <Chip
                              size="small"
                              icon={<AppsIcon />}
                              label={flag.application}
                              variant="outlined"
                              className="text-xs"
                            />
                          )}
                        </Box>

                        {/* Status Badge */}
                        <Box className={classes.statusContainer}>
                          <Chip
                            size="small"
                            label={flag.enabled ? 'Enabled' : 'Disabled'}
                            className={`feature-badge text-xs font-medium ${flag.enabled ? 'feature-badge-enabled' : 'feature-badge-disabled'
                              }`}
                          />

                          {flag.lastModified && (
                            <Typography variant="caption" className="text-gray-400">
                              Updated {new Date(flag.lastModified).toLocaleDateString()}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Slide>
              ))}
            </Box>
          </Fade>
        )}

        {/* Empty State */}
        {!loading && filteredFlags.length === 0 && (
          <Box className={classes.emptyState}>
            <FlagIcon className={classes.emptyIcon} />
            <Typography variant="h5" color="textSecondary" style={{ marginBottom: 16 }}>
              No feature flags found
            </Typography>
            <Typography variant="body1" color="textSecondary" style={{ marginBottom: 24 }}>
              {flags.length === 0
                ? "Create your first feature flag to get started"
                : "Try adjusting your search or filter criteria"}
            </Typography>
            {flags.length === 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create First Flag
              </Button>
            )}
          </Box>
        )}

        {/* Create Flag Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box className={classes.dialogHeader}>
              <FlagIcon />
              Create New Feature Flag
            </Box>
          </DialogTitle>
          <DialogContent className="space-y-4">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Tenant"
                  name="tenant"
                  value={form.tenant}
                  onChange={handleInputChange('tenant')}
                  fullWidth
                  variant="outlined"
                  required
                  placeholder="e.g., my-company"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Environment"
                  name="environment"
                  value={form.environment}
                  onChange={handleInputChange('environment')}
                  fullWidth
                  variant="outlined"
                  required
                  placeholder="e.g., development, staging, production"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Application"
                  name="application"
                  value={form.application}
                  onChange={handleInputChange('application')}
                  fullWidth
                  variant="outlined"
                  required
                  placeholder="e.g., web-app, api"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Flag Name"
                  name="flagName"
                  value={form.flagName}
                  onChange={handleInputChange('flagName')}
                  fullWidth
                  variant="outlined"
                  required
                  placeholder="e.g., new-checkout-flow"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  name="description"
                  value={form.description}
                  onChange={handleInputChange('description')}
                  fullWidth
                  variant="outlined"
                  multiline
                  rows={3}
                  placeholder="Describe what this feature flag controls..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFlag}
              variant="contained"
              color="primary"
              disabled={!form.tenant || !form.environment || !form.application || !form.flagName}
            >
              Create Flag
            </Button>
          </DialogActions>
        </Dialog>

        {/* Action Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem
            onClick={() => selectedFlag && handleDeleteFlag(selectedFlag.name)}
            className="text-red-600"
          >
            <ListItemIcon>
              <DeleteIcon className="text-red-600" />
            </ListItemIcon>
            <ListItemText>Delete Flag</ListItemText>
          </MenuItem>
        </Menu>
      </Content>
    </Page>
  );
};