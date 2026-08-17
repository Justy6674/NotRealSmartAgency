import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const brandId = searchParams.get('brandId');

    if (!platform || !brandId) {
      return NextResponse.json({ error: 'Missing platform or brandId' }, { status: 400 });
    }

    if (!process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ error: 'ZERNIO_API_KEY is not configured' }, { status: 500 });
    }

    const supabase = createAdminClient();

    // First, check if this brand already has a Zernio Profile ID
    const { data: brand } = await supabase.from('brands')
      .select('id, name, user_id, social_urls')
      .eq('id', brandId)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    let zernioProfileId = brand.social_urls?.zernio_profile_id;

    // If no Zernio profile exists for this brand, create one
    if (!zernioProfileId) {
      const profileResponse = await fetch('https://zernio.com/api/v1/profiles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: brand.name,
          description: `NRS Brand: ${brand.name}`
        })
      });

      if (!profileResponse.ok) {
        const errText = await profileResponse.text();
        throw new Error(`Failed to create Zernio profile: ${errText}`);
      }

      const profileData = await profileResponse.json();
      zernioProfileId = profileData.profile?._id || profileData._id;

      if (!zernioProfileId) {
        throw new Error('Could not parse Zernio profile ID from response');
      }

      // Save it back to the brand
      const newSocialUrls = { ...(brand.social_urls || {}), zernio_profile_id: zernioProfileId };
      await supabase.from('brands')
        .update({ social_urls: newSocialUrls })
        .eq('id', brandId);
    }

    // Now request the connect URL
    // Redirect URL points to our callback route and carries the platform and brandId
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/zernio/callback?platform=${platform}&brandId=${brandId}`;
    
    const connectResponse = await fetch(`https://zernio.com/api/v1/connect/${platform}?profileId=${zernioProfileId}&redirect_url=${encodeURIComponent(redirectUrl)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`
      }
    });

    if (!connectResponse.ok) {
      const errText = await connectResponse.text();
      throw new Error(`Failed to generate Zernio connect URL: ${errText}`);
    }

    const connectData = await connectResponse.json();

    // Store state in DB/cookie to verify on callback, linking it to the brand
    // For simplicity, we can store it in a generic states table or pass via cookie
    // Here we'll pass brandId in the response and the frontend can handle storing it if needed.
    
    return NextResponse.json({
      authUrl: connectData.authUrl,
      state: connectData.state,
      brandId
    });

  } catch (err: any) {
    console.error('Zernio Connect Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
