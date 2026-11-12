import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

async function countQuery(gmail, q) {
  let count = 0;
  let pageToken;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 500,
      pageToken,
      fields: 'nextPageToken,messages(id)'
    });
    if (res.data.messages) {
      count += res.data.messages.length;
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return count;
}

async function run() {
  const auth = await getAuthManish();
  const gmail = google.gmail({ version: 'v1', auth });

  const categories = [
    { label: 'Active Emails (<= 1 year old)', q: 'in:inbox newer_than:1y' },
    { label: 'Legal / Litigation / Trademarks', q: 'in:inbox label:Legal/Litigation-Trademarks' },
    { label: 'Business / D-VA (incl. Real Henna, Brahm Art)', q: 'in:inbox label:Business/D-VA' },
    { label: 'Business / Anamika Trading', q: 'in:inbox label:Business/Anamika-Trading' },
    { label: 'Business / MM Consumer', q: 'in:inbox label:Business/MM-Consumer' },
    { label: 'Starred Emails', q: 'in:inbox is:starred' },
    { label: 'Historical (>1y) Protected / Remaining', q: 'in:inbox older_than:1y' }
  ];

  console.log('=== Exact Inbox Breakdown (Total: 8,824) ===');
  for (const c of categories) {
    const count = await countQuery(gmail, c.q);
    console.log(`- ${c.label}: ${count}`);
  }

  // Sample the older than 1 year remaining emails to see what they are
  console.log('\nSampling older_than:1y in INBOX:');
  const sampleRes = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox older_than:1y',
    maxResults: 10,
    fields: 'messages(id)'
  });

  if (sampleRes.data.messages) {
    for (const m of sampleRes.data.messages) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });
      const headers = msg.data.payload.headers;
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
      const labels = msg.data.labelIds.join(', ');
      console.log(`  [${date.slice(0, 16)}] From: ${from.slice(0, 35)} | Subj: ${subject.slice(0, 45)} | Labels: ${labels}`);
    }
  }
}

run().catch(console.error);
