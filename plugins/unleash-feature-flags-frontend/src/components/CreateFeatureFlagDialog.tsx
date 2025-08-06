import React, { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Grid,
    Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { CreateFeatureFlagRequest, TenantEnvironmentApp, unleashFeatureFlagsApiRef } from '../api';

interface CreateFeatureFlagDialogProps {
    context: TenantEnvironmentApp;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateFeatureFlagDialog = ({
    context,
    open,
    onClose,
    onSuccess,
}: CreateFeatureFlagDialogProps) => {
    const api = useApi(unleashFeatureFlagsApiRef);
    const [formData, setFormData] = useState<CreateFeatureFlagRequest>({
        name: '',
        displayName: '',
        description: '',
        type: 'release',
        project: '',
        impressionData: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleInputChange = (field: keyof CreateFeatureFlagRequest, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            setError('Feature flag name is required');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await api.createFeatureFlag(context, {
                ...formData,
                project: `${context.tenant}-${context.environment}-${context.app}`,
            });

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create feature flag');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFormData({
                name: '',
                displayName: '',
                description: '',
                type: 'release',
                project: '',
                impressionData: false,
            });
            setError(null);
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Create Feature Flag</DialogTitle>

            <DialogContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                    Creating feature flag for: <strong>{context.tenant}.{context.environment}.{context.app}</strong>
                </Typography>

                {error && (
                    <Alert severity="error" style={{ marginBottom: 16 }}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Feature Flag Name"
                            placeholder="new-checkout-flow"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            required
                            helperText="Use kebab-case (lowercase with hyphens)"
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Display Name"
                            placeholder="New Checkout Flow"
                            value={formData.displayName}
                            onChange={(e) => handleInputChange('displayName', e.target.value)}
                            helperText="Human-readable name for the feature flag"
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Description"
                            placeholder="Enables the new checkout experience with improved UX"
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            helperText="Describe what this feature flag controls"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select
                                value={formData.type}
                                onChange={(e) => handleInputChange('type', e.target.value)}
                                label="Type"
                            >
                                <MenuItem value="release">Release</MenuItem>
                                <MenuItem value="experiment">Experiment</MenuItem>
                                <MenuItem value="operational">Operational</MenuItem>
                                <MenuItem value="kill-switch">Kill Switch</MenuItem>
                                <MenuItem value="permission">Permission</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.impressionData || false}
                                    onChange={(e) => handleInputChange('impressionData', e.target.checked)}
                                    color="primary"
                                />
                            }
                            label="Impression Data"
                        />
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    color="primary"
                    variant="contained"
                    disabled={loading || !formData.name.trim()}
                >
                    {loading ? 'Creating...' : 'Create Feature Flag'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
