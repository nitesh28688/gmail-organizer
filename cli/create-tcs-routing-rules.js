import fetch from 'node-fetch';

// Never hardcode: GitHub Push Protection rejected the 2026-11-13 move commit
// for exactly this. The token (Cloudflare, theclosetstory.com zone) lives in
// the vault; pass it per-run:  CF_API_TOKEN=cfat_... node create-tcs-routing-rules.js
const CF_API_TOKEN = process.env.CF_API_TOKEN;
if (!CF_API_TOKEN) {
  console.error('Set CF_API_TOKEN (Cloudflare API token for theclosetstory.com) before running.');
  process.exit(1);
}
const DOMAIN = 'theclosetstory.com';
const PRIMARY_EMAIL = 'theclosetstory.in@gmail.com';

const addresses = [
  'support@theclosetstory.com',
  'orders@theclosetstory.com',
  'namrata@theclosetstory.com',
  'samridhi@theclosetstory.com',
];

async function getZoneId() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}`, {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });
  const data = await res.json();
  if (!data.success || data.result.length === 0) {
    throw new Error(`Zone not found for ${DOMAIN}`);
  }
  return data.result[0].id;
}

async function createRoutingRules() {
  console.log('Creating routing rules for', DOMAIN);
  const zoneId = await getZoneId();
  console.log('Zone ID:', zoneId);

  // Get existing routing rules
  const rulesRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`,
    { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } }
  );
  const rulesData = await rulesRes.json();

  if (!rulesData.success) {
    console.error('Error fetching rules:', rulesData.errors);
    return;
  }

  const existingRules = new Set((rulesData.result || []).map(r => r.matchers?.[0]?.value));
  console.log('Existing rules:', Array.from(existingRules));

  // Create routing rules for each address
  for (const addr of addresses) {
    if (existingRules.has(addr)) {
      console.log('✓ Rule already exists:', addr);
      continue;
    }

    console.log('Creating rule for:', addr);
    const createRes = await fetch(
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

    const createData = await createRes.json();
    if (!createData.success) {
      console.error(`✗ Failed for ${addr}:`, createData.errors[0].message);
    } else {
      console.log(`✓ Created rule for ${addr}`);
    }
  }

  console.log('\n[✓] All routing rules created!');
}

createRoutingRules().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
