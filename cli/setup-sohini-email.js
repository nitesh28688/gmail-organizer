import { google } from 'googleapis';
import { getAuthSohini } from './auth-sohini.js';

const DOMAIN = 'sohinirohra.com';

const addresses = [
  'info@sohinirohra.com',
  'appointments@sohinirohra.com',
  'sohini@sohinirohra.com',
  'press@sohinirohra.com',
];

// Gmail label palette only — arbitrary hex is rejected by the API.
const colors = {
  info: { backgroundColor: '#4a86e8', textColor: '#ffffff' }, // Blue
  appointments: { backgroundColor: '#16a765', textColor: '#ffffff' }, // Green
  sohini: { backgroundColor: '#a479e2', textColor: '#ffffff' }, // Purple
  press: { backgroundColor: '#fad165', textColor: '#000000' }, // Gold
};

async function setupGmailLabelsAndFilters() {
  console.log('[Gmail] Setting up labels and filters for', DOMAIN);
  const auth = await getAuthSohini();
  const gmail = google.gmail({ version: 'v1', auth });

  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));

  const filtersRes = await gmail.users.settings.filters.list({ userId: 'me' });
  const existingFilterAddrs = new Set(
    (filtersRes.data.filter || []).map(f => f.criteria?.to).filter(Boolean)
  );

  for (const addr of addresses) {
    const [localPart] = addr.split('@');
    const labelName = `Sohini/${localPart}`;

    let labelId = labelMap.get(labelName);
    if (!labelId) {
      console.log('[Gmail] Creating label:', labelName);
      const createRes = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          color: colors[localPart] || { backgroundColor: '#cccccc', textColor: '#000000' },
        },
      });
      labelId = createRes.data.id;
      console.log('[Gmail] Created label:', labelName, labelId);
    } else {
      console.log('[Gmail] Label exists:', labelName);
    }

    if (existingFilterAddrs.has(addr)) {
      console.log('[Gmail] Filter already exists:', addr);
      continue;
    }
    console.log('[Gmail] Creating filter for:', addr);
    await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: { to: addr },
        action: { addLabelIds: [labelId] },
      },
    });
    console.log('[Gmail] Filter created:', addr);
  }
}

async function main() {
  try {
    console.log('=== Sohini Rohra Email Organization ===\n');
    console.log('[i] Send-as aliases already added + verified manually (Gmail API blocks sendAs.create for non-Workspace accounts).\n');
    await setupGmailLabelsAndFilters();
    console.log('\n[✓] Gmail labels + filters complete!');
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  }
}

main();
