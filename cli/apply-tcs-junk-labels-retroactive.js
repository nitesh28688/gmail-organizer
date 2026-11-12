import { google } from 'googleapis';
import { getAuthTCS } from './auth-tcs.js';

const auth = await getAuthTCS();
const gmail = google.gmail({ version: 'v1', auth });

const categories = [
  { name: 'TCS/Junk-Promotions', query: 'subject:(sale OR "% off" OR discount OR deal OR coupon OR offer OR "limited time")' },
  { name: 'TCS/Junk-Newsletters', query: '(unsubscribe OR "manage preferences" OR "email preferences") from:(mailchimp.com OR sendgrid.net OR klaviyo.com OR constantcontact.com OR substack.com)' },
  { name: 'TCS/Junk-Notifications', query: 'from:(noreply OR no-reply OR donotreply OR notifications)' },
  { name: 'TCS/Junk-Social', query: 'from:(facebookmail.com OR instagram.com OR linkedin.com OR twitter.com OR pinterest.com)' },
  { name: 'TCS/Junk-Shopping-Promo', query: 'from:(amazon.in OR flipkart.com OR myntra.com OR ajio.com OR nykaa.com) subject:(sale OR off OR deal)' },
];

async function getAllMessageIds(query) {
  let ids = [];
  let pageToken;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 500,
      pageToken,
    });
    ids = ids.concat((res.data.messages || []).map(m => m.id));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return ids;
}

async function main() {
  console.log('=== Applying junk-scan labels to existing mail ===\n');

  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));

  for (const cat of categories) {
    const labelId = labelMap.get(cat.name);
    if (!labelId) {
      console.log('Label not found, skipping:', cat.name);
      continue;
    }

    console.log(`Searching: ${cat.name} (${cat.query})`);
    const ids = await getAllMessageIds(cat.query);
    console.log(`  Found ${ids.length} matching messages`);

    if (ids.length === 0) continue;

    // batchModify in chunks of 1000 (API limit)
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: chunk,
          addLabelIds: [labelId],
        },
      });
    }
    console.log(`  Labeled ${ids.length} messages as ${cat.name}`);
  }

  console.log('\n[✓] Retroactive labeling complete! Check each TCS/Junk-* label in Gmail.');
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
