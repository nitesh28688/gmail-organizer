import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Option C Archival Sweep:
// Archives historical backlog older than 1 year out of the INBOX.
// Preserves:
// - All Starred emails
// - All Legal & Trademark emails (Hennex, UA Overseas, Madamser & Co, Shailen Bhatia)
// - All Business VIP emails (D-VA, Real Henna, Brahm Art Packers, Anamika Trading, MM Consumer)
// - All Education (IIMA)
//
// Action: Removes 'INBOX' label. Does NOT delete. All emails remain 100% intact and searchable in "All Mail".

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

async function main() {
  const auth = await getAuthManish();
  const gmail = google.gmail({ version: 'v1', auth });

  const query = 'in:inbox older_than:1y -is:starred -label:Legal/Litigation-Trademarks -label:Business/D-VA -label:Business/Anamika-Trading -label:Business/MM-Consumer -label:Education-IIMA -Hennex -madamser -"UA Overseas" -"Shailen" -"real henna" -realheena -brahmart';

  console.log(`=== Option C: Historical Backlog Archival Sweep ${isDryRun ? '(DRY RUN)' : '(LIVE MODE)'} ===`);
  console.log(`Query: ${query}\n`);

  console.log('Collecting historical message IDs to archive out of Inbox...');
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
    if (ids.length % 2500 === 0 && ids.length > 0) {
      console.log(`  ...collected ${ids.length.toLocaleString()} messages`);
    }
    await sleep(80);
  } while (pageToken);

  console.log(`\nFound ${ids.length.toLocaleString()} historical emails (>1y old) to archive out of Inbox.`);

  if (ids.length === 0) {
    console.log('[✓] No matching historical inbox emails found.');
    return;
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN] Would archive ${ids.length.toLocaleString()} messages out of Inbox.`);
    return;
  }

  console.log(`\nArchiving ${ids.length.toLocaleString()} messages out of Inbox in batches of 1,000...`);
  const BATCH_SIZE = 1000;
  let processed = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    await withRetry(() =>
      gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: chunk,
          removeLabelIds: ['INBOX'],
        },
      })
    );
    processed += chunk.length;
    console.log(`  [Archived] ${processed.toLocaleString()} / ${ids.length.toLocaleString()} messages`);
    await sleep(400);
  }

  console.log(`\n========================================`);
  console.log(`[✓] SUCCESS: Archived ${processed.toLocaleString()} historical messages out of your Inbox!`);
  console.log(`Your Inbox now only contains recent active emails.`);
  console.log(`All ${processed.toLocaleString()} archived emails remain 100% safe and searchable in "All Mail".`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
