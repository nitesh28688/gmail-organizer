import { google } from 'googleapis';
import fetch from 'node-fetch';
import { getAuthTCS } from './auth-tcs.js';

// Never hardcode (GitHub Push Protection, 2026-11-13). Pass per-run:
//   CF_API_TOKEN=cfat_... node setup-tcs-email.js
const CF_API_TOKEN = process.env.CF_API_TOKEN;
if (!CF_API_TOKEN) {
  console.error('Set CF_API_TOKEN (Cloudflare API token for theclosetstory.com) before running.');
  process.exit(1);
}
const CF_ACCOUNT_ID = 'f6453600938a7b28a01492d32863d6ca'; // From Access Key ID
const DOMAIN = 'theclosetstory.com';
const PRIMARY_EMAIL = 'theclosetstory.in@gmail.com';

const addresses = [
  'hello@theclosetstory.com',
  'support@theclosetstory.com',
  'orders@theclosetstory.com',
  'namrata@theclosetstory.com',
  'samridhi@theclosetstory.com',
];

async function getCFZoneId() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}`, {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });
  const data = await res.json();
  if (!data.success || data.result.length === 0) {
    throw new Error(`Zone not found for ${DOMAIN}`);
  }
  return data.result[0].id;
}

async function setupCloudflareEmailRouting() {
  console.log('[CF] Setting up email routing for', DOMAIN);
  const zoneId = await getCFZoneId();
  console.log('[CF] Zone ID:', zoneId);

  // Get existing destination addresses
  const destRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/address`,
    { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } }
  );
  const destData = await destRes.json();
  const existingDests = new Map(destData.result.map(d => [d.email, d.id]));
  console.log('[CF] Existing destinations:', Array.from(existingDests.keys()));

  // Create destination if not exists
  let destId = existingDests.get(PRIMARY_EMAIL);
  if (!destId) {
    console.log('[CF] Creating destination:', PRIMARY_EMAIL);
    const createRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/address`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: PRIMARY_EMAIL }),
      }
    );
    const createData = await createRes.json();
    if (!createData.success) {
      throw new Error(`Failed to create destination: ${JSON.stringify(createData.errors)}`);
    }
    destId = createData.result.id;
    console.log('[CF] Created destination:', destId);
  }

  // Get existing routing rules
  const rulesRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`,
    { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } }
  );
  const rulesData = await rulesRes.json();
  const existingRules = new Set(rulesData.result.map(r => r.matchers?.[0]?.value));
  console.log('[CF] Existing rules:', Array.from(existingRules));

  // Create routing rules for each address
  for (const addr of addresses) {
    if (existingRules.has(addr)) {
      console.log('[CF] Rule already exists:', addr);
      continue;
    }
    console.log('[CF] Creating rule for:', addr);
    const ruleRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchers: [{ type: 'to', value: addr }],
          actions: [{ type: 'forward', values: [PRIMARY_EMAIL] }],
          enabled: true,
        }),
      }
    );
    const ruleData = await ruleRes.json();
    if (!ruleData.success) {
      console.error(`[CF] Failed to create rule for ${addr}:`, ruleData.errors);
    } else {
      console.log('[CF] Created rule:', addr);
    }
  }
}

async function setupGmailLabelsAndFilters() {
  console.log('[Gmail] Setting up labels and filters');
  const auth = await getAuthTCS();
  const gmail = google.gmail({ version: 'v1', auth });

  // Label colors
  const colors = {
    hello: { backgroundColor: '#e66550', textColor: '#ffffff' }, // Red
    support: { backgroundColor: '#fad165', textColor: '#000000' }, // Gold
    orders: { backgroundColor: '#16a765', textColor: '#ffffff' }, // Green
    namrata: { backgroundColor: '#4a86e8', textColor: '#ffffff' }, // Blue
    samridhi: { backgroundColor: '#a479e2', textColor: '#ffffff' }, // Purple
  };

  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));

  const filtersRes = await gmail.users.settings.filters.list({ userId: 'me' });
  const existingFilterAddrs = new Set(
    (filtersRes.data.filter || []).map(f => f.criteria?.to).filter(Boolean)
  );

  for (const addr of addresses) {
    const [localPart] = addr.split('@');
    const labelName = `TCS/${localPart}`;

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

    // Create filter
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

async function setupSendAs() {
  console.log('[Gmail] Setting up send-as addresses');
  const auth = await getAuthTCS();
  const gmail = google.gmail({ version: 'v1', auth });

  const sendAsRes = await gmail.users.settings.sendAs.list({ userId: 'me' });
  const existingSendAs = new Set(sendAsRes.data.sendAs.map(s => s.sendAsEmail));
  console.log('[Gmail] Existing send-as:', Array.from(existingSendAs));

  const displayNames = {
    hello: 'The Closet Story',
    support: 'The Closet Story Support',
    orders: 'The Closet Story Orders',
    namrata: 'Namrata',
    samridhi: 'Samridhi',
  };

  for (const addr of addresses) {
    if (existingSendAs.has(addr)) {
      console.log('[Gmail] Send-as already exists:', addr);
      continue;
    }
    const [localPart] = addr.split('@');
    console.log('[Gmail] Adding send-as:', addr);
    try {
      await gmail.users.settings.sendAs.create({
        userId: 'me',
        requestBody: {
          sendAsEmail: addr,
          displayName: displayNames[localPart] || 'The Closet Story',
        },
      });
      console.log('[Gmail] Send-as added (verification email sent):', addr);
    } catch (e) {
      console.error(`[Gmail] Failed to add send-as ${addr}:`, e.message);
    }
  }
}

async function main() {
  try {
    console.log('=== The Closet Story Email Setup ===\n');
    console.log('[✓] Cloudflare routing rules — configure manually via dashboard\n');
    await setupGmailLabelsAndFilters();
    console.log('\n');
    await setupSendAs();
    console.log('\n[✓] Gmail setup complete!');
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  }
}

main();
