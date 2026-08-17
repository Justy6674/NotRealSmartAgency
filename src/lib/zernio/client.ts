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
