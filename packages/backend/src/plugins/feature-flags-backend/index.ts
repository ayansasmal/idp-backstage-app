import { Router } from 'express';
import fetch from 'node-fetch';

const unleashUrl = process.env.UNLEASH_URL;
const unleashApiToken = process.env.UNLEASH_API_TOKEN;

export const featureFlagsRouter = Router();


featureFlagsRouter.get('/', async (_req, res) => {
    const headers: Record<string, string> = {};
    if (unleashApiToken) {
        headers.Authorization = unleashApiToken;
    }
    const response = await fetch(`${unleashUrl}/api/client/features`, {
        headers,
    });
    const data = await response.json() as { features?: Array<{ name: string }> };
    res.json(data.features || []);
});

// Create a new feature flag
featureFlagsRouter.post('/', async (req, res) => {
    const { tenant, environment, application, flagName } = req.body;
    if (!tenant || !environment || !application || !flagName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const name = `${tenant}.${environment}.${application}.${flagName}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (unleashApiToken) {
        headers.Authorization = unleashApiToken;
    }
    const response = await fetch(`${unleashUrl}/api/admin/features`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, enabled: false }),
    });
    if (!response.ok) {
        const error = await response.text();
        return res.status(response.status).json({ error });
    }
    const data = await response.json();
    return res.status(201).json(data);
});




export default {
    register({ router }: { router: Router }) {
        router.use('/feature-flags', featureFlagsRouter);
    },
};
