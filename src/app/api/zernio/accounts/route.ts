import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchZernioAccounts } from '@/lib/zernio/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'Missing brandId' }, { status: 400 });
    }

    if (!process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ accounts: [] });
    }

    const supabase = createAdminClient();
    const { data: brand } = await supabase.from('brands')
      .select('id, social_urls')
      .eq('id', brandId)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const zernioProfileId = brand.social_urls?.zernio_profile_id;
    if (!zernioProfileId) {
      return NextResponse.json({ accounts: [] });
    }

    const accounts = await fetchZernioAccounts(zernioProfileId);
    
    return NextResponse.json({ accounts });
  } catch (err: any) {
    console.error('Zernio API fetch accounts error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
