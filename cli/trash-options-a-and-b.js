import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Executes Option A and Option B:
// Option A: Specific Brand & Weekly Blasts (Marriott promos, LUB newsletters, CRIF, Real Estate)
// Option B: Commercial Mailing Lists with Unsubscribe (>1y), strictly protecting statements, invoices, and VIP assets

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

  console.log(`=== Trash Option A & Option B ${isDryRun ? '(DRY RUN)' : '(LIVE MODE)'} ===\n`);

  const baseExclusions = '-label:Legal/Litigation-Trademarks -label:Business/D-VA -label:Business/Anamika-Trading -label:Business/MM-Consumer -label:Education-IIMA -label:Finance -is:starred -Hennex -madamser -"UA Overseas" -"Shailen" -"real henna" -realheena -brahmart -from:(gov.in OR nic.in OR mca.gov.in OR gst.gov.in OR incometax.gov.in) -subject:(invoice OR "tax invoice" OR statement OR "account statement" OR "e-statement" OR receipt OR confirmation OR certificate OR sanction OR facility OR KYC)';

  const targets = [
    {
      name: 'Option A: Specific Brand & Weekly Blasts (Marriott, LUB, CRIF, Real Estate)',
      q: `in:inbox (from:(marriott.com OR marriottbonvoy.com OR marriott-email.com OR "Marriott Bonvoy" OR lubindia.com OR "Laghu Udyog Bharati" OR crifhighmark.com OR magicbricks.com OR 99acres.com OR housing.com)) ${baseExclusions} -subject:(confirmation OR reservation OR folio OR receipt OR invoice)`,
    },
    {
      name: 'Option B: Obsolete Commercial Mailing Lists (>1y with Unsubscribe)',
      q: `in:inbox unsubscribe older_than:1y ${baseExclusions}`,
    },
  ];

  const allIds = new Set();
  for (const t of targets) {
    const ids = await collectIds(gmail, t.q, t.name);
    ids.forEach((id) => allIds.add(id));
  }

  const uniqueIds = Array.from(allIds);
  console.log(`========================================`);
  console.log(`Total unique messages to trash across Option A & B: ${uniqueIds.length.toLocaleString()}`);
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
  console.log(`Option A & Option B completed successfully.`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
