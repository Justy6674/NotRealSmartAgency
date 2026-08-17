import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchZernioAnalytics } from '@/lib/zernio/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const platform = searchParams.get('platform') ?? undefined;
    const fromDate = searchParams.get('fromDate') ?? undefined;
    const toDate = searchParams.get('toDate') ?? undefined;

    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: brand } = await supabase.from('brands')
      .select('id, social_urls')
      .eq('id', brandId)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const profileId = brand.social_urls?.zernio_profile_id;
    if (!profileId) {
      return NextResponse.json({ configured: false, metrics: null });
    }

    const metrics = await fetchZernioAnalytics({ profileId, platform, fromDate, toDate });

    return NextResponse.json({ configured: true, metrics });
  } catch (err: any) {
    console.error('Zernio analytics route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
