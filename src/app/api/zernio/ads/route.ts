import { NextResponse } from 'next/server';
import { listZernioCampaigns, setZernioCampaignStatus } from '@/lib/zernio/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') ?? undefined;
    const campaigns = await listZernioCampaigns(accountId);
    return NextResponse.json({ campaigns });
  } catch (err: any) {
    console.error('Zernio campaigns list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { campaignId, status } = await request.json();
    if (!campaignId || !status) {
      return NextResponse.json({ error: 'campaignId and status are required' }, { status: 400 });
    }
    const result = await setZernioCampaignStatus(campaignId, status);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('Zernio campaign status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
