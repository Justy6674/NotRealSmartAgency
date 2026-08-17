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

export async function createZernioPost(params: {
  content: string;
  accounts: { platform: string; accountId: string }[];
  mediaIds?: string[];
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
    
    if (params.mediaIds && params.mediaIds.length > 0) {
      body.media = params.mediaIds;
    }

    const { data } = await zernio.posts.createPost({ body });
    return data.post;
  } catch (err: any) {
    console.error('Failed to create Zernio post:', err.message);
    throw err;
  }
}

export async function uploadZernioMedia(fileUrl: string): Promise<string | null> {
  // In a full integration, we'd pull the file buffer and send it to Zernio's /v1/media endpoint
  // For the trial, we assume text-only or we rely on Zernio's URL upload if supported.
  // Zernio's media endpoint typically expects multipart/form-data.
  console.warn('Zernio media upload is a stub for the trial - returning null');
  return null;
}
