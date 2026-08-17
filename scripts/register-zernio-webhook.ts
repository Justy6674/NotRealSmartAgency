import { config } from 'dotenv';
import Zernio from '@zernio/node';

config({ path: '.env.local' });

async function registerWebhook() {
  try {
    if (!process.env.ZERNIO_API_KEY) {
      throw new Error('Missing ZERNIO_API_KEY');
    }

    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });
    
    console.log('Registering Zernio webhook...');
    
    // Fallback to fetch for webhook settings as per the LLM spec
    const response = await fetch('https://zernio.com/api/v1/webhooks/settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'NRS Webhook Receiver',
        url: 'https://www.notrealsmart.com.au/api/webhooks/zernio',
        events: ['message.received', 'comment.received']
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed: ${response.status} - ${errText}`);
    }

    const result = await response.json();
    console.log('Webhook registered successfully:', result);

  } catch (error: any) {
    console.error('Error registering webhook:', error.message);
  }
}

registerWebhook();