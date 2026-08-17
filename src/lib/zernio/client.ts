import Zernio from '@zernio/node';

export interface ZernioAccount {
  id: string;
  platform: string;
  profileId?: string;
  username?: string;
  displayName?: string;
}

export async function fetchZernioAccounts(profileId?: string): Promise<ZernioAccount[]> {
  try {
    if (!process.env.ZERNIO_API_KEY) return [];
    
    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });
    
    // The Zernio API accepts profileId as a filter
    const { data } = await zernio.accounts.listAccounts(profileId ? { profileId } : undefined);
    
    return data.accounts || [];
  } catch (err) {
    console.error('Failed to fetch Zernio accounts:', err);
    return [];
  }
}

function getMediaType(url: string): 'image' | 'video' | 'gif' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.mov') || lowerUrl.endsWith('.webm')) return 'video';
  if (lowerUrl.endsWith('.gif')) return 'gif';
  return 'image';
}

export async function createZernioPost(params: {
  content: string;
  accounts: { platform: string; accountId: string }[];
  mediaUrls?: string[];
  scheduledFor?: string;
  publishNow?: boolean;
}) {
  try {
    if (!process.env.ZERNIO_API_KEY) throw new Error('Missing ZERNIO_API_KEY');
    
    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });
    
    const body: any = {
      content: params.content,
      platforms: params.accounts
    };

    if (params.scheduledFor) {
      body.scheduledFor = params.scheduledFor;
    } else if (params.publishNow) {
      body.publishNow = true;
    }
    
    if (params.mediaUrls && params.mediaUrls.length > 0) {
      body.mediaItems = params.mediaUrls.map(url => ({
        type: getMediaType(url),
        url: url
      }));
    }

    const { data } = await zernio.posts.createPost({ body });
    return data.post;
  } catch (err: any) {
    console.error('Failed to create Zernio post:', err.message);
    throw err;
  }
}

export async function fetchZernioAnalytics(params: {
  profileId?: string;
  accountId?: string;
  platform?: string;
  fromDate?: string;
  toDate?: string;
}) {
  try {
    if (!process.env.ZERNIO_API_KEY) return null;
    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });
    const query: Record<string, string> = {};
    if (params.profileId) query.profileId = params.profileId;
    if (params.accountId) query.accountId = params.accountId;
    if (params.platform) query.platform = params.platform;
    if (params.fromDate) query.fromDate = params.fromDate;
    if (params.toDate) query.toDate = params.toDate;
    
    // Zernio's analytics surface uses a generic GET helper; fall back to REST for reliability
    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`https://zernio.com/api/v1/analytics/daily-metrics${qs ? `?${qs}` : ''}`, {
      headers: { 'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}` }
    });
    if (!res.ok) throw new Error(`Zernio analytics ${res.status}: ${await res.text()}`);
    return await res.json();
  } catch (err: any) {
    console.error('Failed to fetch Zernio analytics:', err.message);
    return null;
  }
}

export async function listZernioCampaigns(accountId?: string) {
  try {
    if (!process.env.ZERNIO_API_KEY) return [];
    const qs = accountId ? `?accountId=${accountId}` : '';
    const res = await fetch(`https://zernio.com/api/v1/ads/campaigns${qs}`, {
      headers: { 'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}` }
    });
    if (!res.ok) throw new Error(`Zernio ads ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.campaigns || data || [];
  } catch (err: any) {
    console.error('Failed to list Zernio campaigns:', err.message);
    return [];
  }
}

export async function setZernioCampaignStatus(campaignId: string, status: string) {
  try {
    if (!process.env.ZERNIO_API_KEY) throw new Error('Missing ZERNIO_API_KEY');
    const res = await fetch(`https://zernio.com/api/v1/ads/campaigns/${campaignId}/status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error(`Zernio ads status ${res.status}: ${await res.text()}`);
    return await res.json();
  } catch (err: any) {
    console.error('Failed to set Zernio campaign status:', err.message);
    throw err;
  }
}
