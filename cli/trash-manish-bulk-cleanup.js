import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Clears 4 bulk junk categories for mulchandani.manish@gmail.com:
// 1. Old Newsletters (>30d)
// 2. Expired Job Alerts (>90d)
// 3. Travel Marketing & Sales
// 4. Old No-Reply System Alerts (>1y, excluding finance, education, and government/tax)

const isDryRun = process.argv.includes('--dry-run');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 0) {
  try {
    return await fn();
  } catch (e) {
    if ([403, 429, 500, 503].includes(e?.code) && tries < 5) {
      console.log(`  [rate-limit/transient] waiting ${(tries + 1) * 3}s before retry...`);
      await sleep(3000 * (tries + 1));
      return withRetry(fn, tries + 1);
    }
    throw e;
  }
}

async function collectIds(gmail, query, name) {
  console.log(`Scanning [${name}] ...`);
  let ids = [];
  let pageToken;

  do {
    const res = await withRetry(() =>
      gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 500,
        pageToken,
        fields: 'nextPageToken,messages(id)',
      })
    );
    const msgs = res.data.messages || [];
    ids.push(...msgs.map((m) => m.id));
    pageToken = res.data.nextPageToken;
    if (ids.length % 2000 === 0 && ids.length > 0) {
      console.log(`  ...collected ${ids.length.toLocaleString()} messages`);
    }
    await sleep(80);
  } while (pageToken);

  console.log(`  Found: ${ids.length.toLocaleString()} messages for ${name}\n`);
  return ids;
}

async function main() {
  const auth = await getAuthManish();
  const gmail = google.gmail({ version: 'v1', auth });

  console.log(`=== Trash 4 Bulk Junk Categories ${isDryRun ? '(DRY RUN)' : '(LIVE MODE)'} ===\n`);

  const targets = [
    {
      name: '1. Old Newsletters (>30d)',
      q: 'label:Newsletters older_than:30d -is:starred -label:Finance -label:Education-IIMA',
    },
    {
      name: '2. Expired Job Alerts (>90d)',
      q: 'label:Jobs-HR older_than:90d -is:starred -label:Finance -label:Education-IIMA',
    },
    {
      name: '3. Travel Marketing & Promo Blasts',
      q: 'label:Travel (sale OR off OR promo OR deal OR discount OR marketing) -is:starred -label:Finance -label:Education-IIMA',
    },
    {
      name: '4. Old No-Reply System Alerts (>1y)',
      q: 'from:(noreply OR no-reply OR donotreply) older_than:1y -is:starred -label:Finance -label:Education-IIMA -from:(gov.in OR nic.in OR mca.gov.in OR gst.gov.in OR incometax.gov.in)',
    },
  ];

  const allIds = new Set();
  for (const t of targets) {
    const ids = await collectIds(gmail, t.q, t.name);
    ids.forEach((id) => allIds.add(id));
  }

  const uniqueIds = Array.from(allIds);
  console.log(`========================================`);
  console.log(`Total unique messages to trash across all 4 targets: ${uniqueIds.length.toLocaleString()}`);
  console.log(`========================================\n`);

  if (uniqueIds.length === 0) {
    console.log('[✓] No matching messages found.');
    return;
  }

  if (isDryRun) {
    console.log(`[DRY RUN] Would move ${uniqueIds.length.toLocaleString()} messages to Trash.`);
    return;
  }

  console.log(`Moving ${uniqueIds.length.toLocaleString()} messages to Trash in batches of 1,000...`);
  const BATCH_SIZE = 1000;
  let processed = 0;

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
    await withRetry(() =>
      gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: chunk,
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX'],
        },
      })
    );
    processed += chunk.length;
    console.log(`  [Trashed] ${processed.toLocaleString()} / ${uniqueIds.length.toLocaleString()} messages`);
    await sleep(400);
  }

  console.log(`\n========================================`);
  console.log(`[✓] SUCCESS: Moved ${processed.toLocaleString()} messages to Trash!`);
  console.log(`All 4 bulk categories cleared out cleanly.`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
