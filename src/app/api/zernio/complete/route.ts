import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { code, state, platform } = await request.json();

    if (!code || !state || !platform) {
      return NextResponse.json({ error: 'Missing code, state, or platform' }, { status: 400 });
    }

    if (!process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ error: 'ZERNIO_API_KEY is not configured' }, { status: 500 });
    }

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
      throw new Error(`Failed to complete Zernio connection: ${errText}`);
    }

    const connectData = await connectResponse.json();

    return NextResponse.json({ success: true, account: connectData.account });

  } catch (err: any) {
    console.error('Zernio Connect Completion Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
