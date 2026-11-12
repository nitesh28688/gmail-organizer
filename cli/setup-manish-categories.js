import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Gmail API palette-safe colors
const categories = {
  'Real-Estate': {
    color: { backgroundColor: '#e66550', textColor: '#ffffff' },
    archive: true,
    domains: [
      'magicbricks.com',
      'apartmentlist.com',
      'emp.apartmentlist.com',
      '99acres.com',
      'housing.com',
      'nobroker.in',
    ],
  },
  'Newsletters': {
    color: { backgroundColor: '#fad165', textColor: '#000000' },
    archive: true,
    domains: [
      'hindustantimes.com',
      'marketing.hindustantimes.com',
      'yourstory.com',
      'forbes.com',
      'email.forbes.com',
      'etbfsi.com',
      'economictimes.com',
      'livemint.com',
      'substack.com',
      'medium.com',
      'beehiiv.com',
    ],
  },
  'Travel': {
    color: { backgroundColor: '#ffad46', textColor: '#000000' },
    archive: true,
    domains: [
      'goindigo.in',
      'marketing.goindigo.in',
      'airindiaexpress.com',
      'promo.airindiaexpress.com',
      'trip.com',
      'newsletter.trip.com',
      'makemytrip.com',
      'zen-makemytrip.com',
      'zen2-makemytrip.com',
      'goibibo.com',
      'content.goibibo.com',
      'tajhotels.com',
      'all.com',
      'mail.all.com',
      'stayvista.com',
      'emails.stayvista.com',
      'spicejet.com',
      'web-spicejet.com',
      'airindia.com',
      'booking.com',
      'airbnb.com',
    ],
  },
  'Jobs-HR': {
    color: { backgroundColor: '#a479e2', textColor: '#ffffff' },
    archive: true,
    domains: [
      'jasglobalhr.com',
      'mailboxcv.com',
      'naukri.com',
      'linkedin.com',
      'foundit.in',
      'indeed.com',
    ],
  },
  'Finance': {
    color: { backgroundColor: '#16a765', textColor: '#ffffff' },
    archive: false, // Keep in inbox
    domains: [
      'hdfcbank.bank.in',
      'mailers.hdfcbank.bank.in',
      'hdfcbank.com',
      'upstox.com',
      'campaigns.upstox.com',
      'paytm.com',
      'info.paytm.com',
      'zerodha.net',
      'reportsmailer.zerodha.net',
      'zerodha.com',
      'adcb.com',
      'rakbank.ae',
      'cbd.ae',
      'flexiloans.com',
      'icicibank.com',
      'axisbank.com',
      'sbicard.com',
      'cred.club',
    ],
  },
  'Services': {
    color: { backgroundColor: '#4a86e8', textColor: '#ffffff' },
    archive: false, // Keep in inbox
    domains: [
      'google.com',
      'jio.com',
      'openai.com',
      'tm.openai.com',
      'adobe.com',
      'mail.adobe.com',
      'apple.com',
      'microsoft.com',
      'amazon.in',
      'amazon.com',
    ],
  },
  'Education-IIMA': {
    color: { backgroundColor: '#285bac', textColor: '#ffffff' },
    archive: false, // Keep in inbox
    domains: [
      'iima.ac.in',
    ],
  },
};

async function main() {
  const auth = await getAuthManish();
  const gmail = google.gmail({ version: 'v1', auth });

  console.log('--- Step 1: Creating Labels ---');
  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map((labelsRes.data.labels || []).map((l) => [l.name, l.id]));

  for (const [name, config] of Object.entries(categories)) {
    if (labelMap.has(name)) {
      console.log(`[label] exists: ${name}`);
      continue;
    }
    const res = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        color: config.color,
      },
    });
    labelMap.set(name, res.data.id);
    console.log(`[label] created: ${name}`);
  }

  console.log('\n--- Step 2: Creating Filters ---');
  const filtersRes = await gmail.users.settings.filters.list({ userId: 'me' });
  const existingFilters = filtersRes.data.filter || [];

  for (const [name, config] of Object.entries(categories)) {
    const labelId = labelMap.get(name);
    if (!labelId) {
      console.error(`[filter] missing label ID for: ${name}`);
      continue;
    }

    const fromQuery = config.domains.map((d) => `from:${d}`).join(' OR ');

    // Check if filter exists
    const existing = existingFilters.find((f) => f.criteria?.from === fromQuery);
    if (existing) {
      console.log(`[filter] already exists: ${name}`);
      continue;
    }

    const action = {
      addLabelIds: [labelId],
    };
    if (config.archive) {
      action.removeLabelIds = ['INBOX'];
    }

    await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: { from: fromQuery },
        action,
      },
    });

    console.log(`[filter] created: ${name} (archive: ${config.archive})`);
  }

  console.log('\n[✓] All labels and incoming filters successfully set up for mulchandani.manish@gmail.com.');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
