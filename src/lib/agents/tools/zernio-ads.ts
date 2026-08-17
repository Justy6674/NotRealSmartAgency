import { tool } from 'ai';
import { z } from 'zod/v3';

export function getZernioAdsTool() {
  return tool({
    description: 'Manage Zernio paid ad campaigns. List campaigns, or pause/activate/resume a campaign by ID.',
    inputSchema: z.object({
      action: z.enum(['list', 'set_status']).describe('list campaigns, or change a campaign status'),
      campaignId: z.string().optional().describe('Required when action is set_status'),
      status: z.enum(['PAUSED', 'ACTIVE', 'DELETED']).optional().describe('Target status when action is set_status'),
      accountId: z.string().optional().describe('Optional account filter when listing campaigns')
    }),
    execute: async ({ action, campaignId, status, accountId }) => {
      try {
        if (!process.env.ZERNIO_API_KEY) {
          return { success: false, error: 'ZERNIO_API_KEY is not configured' };
        }
        if (action === 'list') {
          const qs = accountId ? `?accountId=${accountId}` : '';
          const res = await fetch(`https://zernio.com/api/v1/ads/campaigns${qs}`, {
            headers: { 'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}` }
          });
          if (!res.ok) throw new Error(`Zernio ads ${res.status}: ${await res.text()}`);
          const data = await res.json();
          return { success: true, campaigns: data.campaigns || data || [] };
        }
        // set_status
        if (!campaignId || !status) {
          return { success: false, error: 'campaignId and status are required for set_status' };
        }
        const res = await fetch(`https://zernio.com/api/v1/ads/campaigns/${campaignId}/status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error(`Zernio ads status ${res.status}: ${await res.text()}`);
        return { success: true, result: await res.json() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  });
}

export function getZernioAnalyticsTool() {
  return tool({
    description: 'Query Zernio aggregated social analytics (impressions, reach, likes, comments, shares, views) for a profile.',
    inputSchema: z.object({
      profileId: z.string().optional().describe('Zernio profile ID (workspace)'),
      platform: z.string().optional().describe('Filter by platform, e.g. instagram or tiktok'),
      fromDate: z.string().optional().describe('Inclusive start date ISO 8601'),
      toDate: z.string().optional().describe('Inclusive end date ISO 8601')
    }),
    execute: async ({ profileId, platform, fromDate, toDate }) => {
      try {
        if (!process.env.ZERNIO_API_KEY) {
          return { success: false, error: 'ZERNIO_API_KEY is not configured' };
        }
        const query: Record<string, string> = {};
        if (profileId) query.profileId = profileId;
        if (platform) query.platform = platform;
        if (fromDate) query.fromDate = fromDate;
        if (toDate) query.toDate = toDate;
        const qs = new URLSearchParams(query).toString();
        const res = await fetch(`https://zernio.com/api/v1/analytics/daily-metrics${qs ? `?${qs}` : ''}`, {
          headers: { 'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}` }
        });
        if (!res.ok) throw new Error(`Zernio analytics ${res.status}: ${await res.text()}`);
        return { success: true, metrics: await res.json() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  });
}
