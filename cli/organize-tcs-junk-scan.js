import { google } from 'googleapis';
import { getAuthTCS } from './auth-tcs.js';

const auth = await getAuthTCS();
const gmail = google.gmail({ version: 'v1', auth });

// Junk-scanning categories — for browsing/manual deletion, not standing organization
const categories = [
  {
    name: 'TCS/Junk-Promotions',
    color: { backgroundColor: '#eaa041', textColor: '#ffffff' }, // Orange
    query: 'subject:(sale OR "% off" OR discount OR deal OR coupon OR offer OR "limited time")',
  },
  {
    name: 'TCS/Junk-Newsletters',
    color: { backgroundColor: '#a479e2', textColor: '#ffffff' }, // Purple
    query: '(unsubscribe OR "manage preferences" OR "email preferences") from:(mailchimp.com OR sendgrid.net OR klaviyo.com OR constantcontact.com OR substack.com)',
  },
  {
    name: 'TCS/Junk-Notifications',
    color: { backgroundColor: '#999999', textColor: '#ffffff' }, // Gray
    query: 'from:(noreply OR no-reply OR donotreply OR notifications)',
  },
  {
    name: 'TCS/Junk-Social',
    color: { backgroundColor: '#f691b3', textColor: '#000000' }, // Pink
    query: 'from:(facebookmail.com OR instagram.com OR linkedin.com OR twitter.com OR pinterest.com)',
  },
  {
    name: 'TCS/Junk-Shopping-Promo',
    color: { backgroundColor: '#fad165', textColor: '#000000' }, // Gold
    query: 'from:(amazon.in OR flipkart.com OR myntra.com OR ajio.com OR nykaa.com) subject:(sale OR off OR deal)',
  },
];

async function main() {
  console.log('=== Setting up junk-scan labels for theclosetstory.in@gmail.com ===\n');

  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));

  const filtersRes = await gmail.users.settings.filters.list({ userId: 'me' });
  const existingFilterQueries = new Set(
    (filtersRes.data.filter || []).map(f => f.criteria?.query).filter(Boolean)
  );

  for (const cat of categories) {
    let labelId = labelMap.get(cat.name);
    if (!labelId) {
      console.log('Creating label:', cat.name);
      const createRes = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: cat.name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          color: cat.color,
        },
      });
      labelId = createRes.data.id;
      console.log('Created label:', cat.name, labelId);
    } else {
      console.log('Label exists:', cat.name);
    }

    if (existingFilterQueries.has(cat.query)) {
      console.log('Filter already exists for:', cat.name);
      continue;
    }

    console.log('Creating filter for:', cat.name);
    try {
      await gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: { query: cat.query },
          action: { addLabelIds: [labelId] },
        },
      });
      console.log('Filter created for:', cat.name);
    } catch (e) {
      console.error(`Failed to create filter for ${cat.name}:`, e.message);
    }
  }

  console.log('\n[✓] Junk-scan labels ready. Check each label in Gmail to review and bulk-delete manually.');
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
