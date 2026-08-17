import { tool } from 'ai';
import { z } from 'zod/v3';
import Zernio from '@zernio/node';
import { SupabaseClient } from '@supabase/supabase-js';

export function getZernioReplyTool(supabase: SupabaseClient, userId: string, brandId?: string) {
  return tool({
    description: 'Reply to a customer DM or comment via Zernio Inbox. Only use this if you have a conversationId and accountId from an incoming message task.',
    inputSchema: z.object({
      accountId: z.string().describe('The Zernio connected account ID (acc_...)'),
      conversationId: z.string().describe('The Zernio conversation ID to reply to'),
      text: z.string().describe('The text message to send to the customer')
    }),
    execute: async ({ accountId, conversationId, text }) => {
      try {
        if (!process.env.ZERNIO_API_KEY) {
          return { success: false, error: 'ZERNIO_API_KEY is not configured' };
        }

        const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });
        
        // Use the generic fetch method for now if the SDK doesn't expose inbox directly yet
        // The REST path is POST /v1/inbox/conversations/{conversationId}/messages
        const response = await fetch(`https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId,
            text
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Zernio API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();

        // Log the successful reply in our output library
        if (brandId) {
          await supabase.from('outputs').insert({
            user_id: userId,
            brand_id: brandId,
            agent_id: 'overall',
            content_type: 'dm_reply',
            content: text,
            metadata: {
              zernio_conversation_id: conversationId,
              status: 'sent'
            }
          });
        }

        return { 
          success: true, 
          message: 'Reply sent successfully',
          data 
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  });
}
