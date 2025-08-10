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
