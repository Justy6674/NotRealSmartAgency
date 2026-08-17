import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-zernio-signature');
    const rawBody = await request.text();
    
    // Verify signature if secret is configured
    const secret = process.env.ZERNIO_WEBHOOK_SECRET;
    if (secret && signature) {
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (signature !== expected) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const { event, message, conversation, account } = payload;

    // Process incoming DMs and comments
    if (event === 'message.received' || event === 'comment.received') {
      const supabase = createAdminClient();
      
      // For the ScentSell trial, we attach this to the first available user.
      // In production (multi-tenant), we would look up the user by account.profileId
      const { data: brands } = await supabase.from('brands')
        .select('id, name, user_id')
        .ilike('name', '%scentsell%')
        .limit(1);
        
      const brand = brands?.[0];
      
      if (brand) {
        // Create a task for the Director to handle the DM
        await supabase.from('tasks').insert({
          user_id: brand.user_id,
          brand_id: brand.id,
          assigned_agent_id: 'overall',
          title: `New ${event === 'comment.received' ? 'Comment' : 'DM'} on ${account?.platform || 'Social'}`,
          description: `A customer sent a message.\n\nMessage: "${message?.text}"\n\nPlease formulate an answer based on our brand knowledge and reply to the customer using the zernio_reply tool.`,
          context: {
            source: 'zernio_inbox',
            conversationId: conversation?.id,
            accountId: account?.id,
            platform: account?.platform,
            rawMessage: message?.text
          },
          status: 'pending',
          priority: 'high'
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Zernio Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
