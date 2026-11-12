import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

async function main() {
  const auth = await getAuthManish();
  const gmail = google.gmail({ version: 'v1', auth });

  const trashQuery = 'in:inbox from:upstox.com -subject:(login OR register OR registration OR credentials OR password OR "account opened" OR welcome OR statement OR contract OR trade OR KYC OR document OR client OR ledger OR funds OR OTP) -is:starred';

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: trashQuery,
    maxResults: 500,
  });

  const ids = (res.data.messages || []).map(m => m.id);
  console.log(`Found ${ids.length} Upstox daily digests/marketing to trash...`);

  if (ids.length > 0) {
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        addLabelIds: ['TRASH'],
        removeLabelIds: ['INBOX'],
      },
    });
    console.log(`[✓] Trashed ${ids.length} Upstox daily digests. Login & registration kept intact!`);
  }
}

main().catch(console.error);
