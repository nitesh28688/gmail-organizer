import { google } from 'googleapis';
import { getAuthTCS } from './auth-tcs.js';

const auth = await getAuthTCS();
const gmail = google.gmail({ version: 'v1', auth });

// Category definitions: label name, color, and Gmail search query to match
const categories = [
  {
    name: 'TCS/Payments',
    color: { backgroundColor: '#16a765', textColor: '#ffffff' }, // Green
    query: 'from:(razorpay.com OR payu.in OR instamojo.com OR cashfree.com)',
  },
  {
    name: 'TCS/Shipping',
    color: { backgroundColor: '#4a86e8', textColor: '#ffffff' }, // Blue
    query: 'from:(shiprocket.in OR delhivery.com OR bluedart.com OR dtdc.com OR ecomexpress.in OR xpressbees.com OR shadowfax.in)',
  },
  {
    name: 'TCS/Marketing',
    color: { backgroundColor: '#eaa041', textColor: '#ffffff' }, // Orange
    query: 'from:(ads.google.com OR googleads.com OR facebookmail.com OR mailchimp.com OR business.facebook.com)',
  },
  {
    name: 'TCS/Website-Hosting',
    color: { backgroundColor: '#a479e2', textColor: '#ffffff' }, // Purple
    query: 'from:(cloudflare.com OR godaddy.com OR namecheap.com OR github.com OR vercel.com)',
  },
  {
    name: 'TCS/Finance',
    color: { backgroundColor: '#fad165', textColor: '#000000' }, // Gold
    query: 'subject:(invoice OR GST OR "tax invoice" OR receipt) -from:(razorpay.com OR payu.in)',
  },
  {
    name: 'TCS/Social',
    color: { backgroundColor: '#f691b3', textColor: '#000000' }, // Pink
    query: 'from:(facebookmail.com OR instagram.com OR mail.instagram.com)',
  },
  {
    name: 'TCS/Google-Workspace',
    color: { backgroundColor: '#43d692', textColor: '#000000' }, // Teal
    query: 'from:(google.com OR googlemail.com) subject:(security OR verify OR sign-in OR alert)',
  },
];

async function main() {
  console.log('=== Organizing theclosetstory.in@gmail.com by category ===\n');

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

  console.log('\n[✓] Category organization complete!');
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
