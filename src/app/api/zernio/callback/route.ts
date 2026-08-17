import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const platform = searchParams.get('platform');
    const brandId = searchParams.get('brandId');
    const errorParam = searchParams.get('error');

    // The destination UI
    const redirectUrl = new URL('/agency/studio/accounts', request.url);

    if (errorParam) {
      redirectUrl.searchParams.set('error', errorParam);
      return NextResponse.redirect(redirectUrl);
    }

    if (!code || !state || !platform) {
      redirectUrl.searchParams.set('error', 'Missing code, state, or platform');
      return NextResponse.redirect(redirectUrl);
    }

    if (!process.env.ZERNIO_API_KEY) {
      redirectUrl.searchParams.set('error', 'Missing API key');
      return NextResponse.redirect(redirectUrl);
    }

    // Exchange the code and state to complete the connection
    const connectResponse = await fetch(`https://zernio.com/api/v1/connect/${platform}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, state })
    });

    if (!connectResponse.ok) {
      const errText = await connectResponse.text();
      console.error('Zernio OAuth Exchange Error:', errText);
      redirectUrl.searchParams.set('error', 'Exchange failed');
      return NextResponse.redirect(redirectUrl);
    }

    const data = await connectResponse.json();
    
    // Zernio returns the connected account
    const accountId = data.account?.id || data.account?._id;

    if (accountId) {
      redirectUrl.searchParams.set('success', 'true');
      redirectUrl.searchParams.set('zernio_account', accountId);
    }

    // The user is sent back to the Accounts dashboard where they can see the new connection
    return NextResponse.redirect(redirectUrl);

  } catch (err: any) {
    console.error('Zernio Callback Error:', err);
    return NextResponse.redirect(new URL('/agency/studio/accounts?error=zernio_callback_failed', request.url));
  }
}
