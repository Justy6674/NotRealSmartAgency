import { config } from 'dotenv';
import Zernio from '@zernio/node';

config({ path: '.env.local' });

async function verify() {
  try {
    const zernio = new Zernio();
    console.log('Fetching Zernio accounts...');
    const { data } = await zernio.accounts.listAccounts();
    console.log('Connected successfully. Accounts found:');
    if (data.accounts && data.accounts.length > 0) {
      data.accounts.forEach((acc: any) => {
        console.log(`- ${acc.platform} (${acc.id})`);
      });
    } else {
      console.log('No accounts connected yet. Connect them in the Zernio dashboard.');
    }
  } catch (error: any) {
    console.error('Failed to connect to Zernio:', error.message);
  }
}

verify();