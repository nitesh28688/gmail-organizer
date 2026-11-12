import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Moves expired promotions to Trash for mulchandani.manish@gmail.com
// Query: category:promotions older_than:90d -is:starred -label:Finance -label:Education-IIMA

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

  const query = 'category:promotions older_than:90d -is:starred -label:Finance -label:Education-IIMA';
  console.log(`=== Trash Expired Promotions ${isDryRun ? '(DRY RUN)' : '(LIVE MODE)'} ===`);
  console.log(`Target query: ${query}\n`);

  console.log('Collecting message IDs to trash...');
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
      console.log(`  ...collected ${ids.length.toLocaleString()} matching messages`);
    }
    await sleep(80);
  } while (pageToken);

  console.log(`\nFound a total of ${ids.length.toLocaleString()} promotional emails older than 90 days.`);

  if (ids.length === 0) {
    console.log('[✓] No matching promotional messages found.');
    return;
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN] Would move ${ids.length.toLocaleString()} messages to Trash.`);
    return;
  }

  console.log(`\nMoving ${ids.length.toLocaleString()} messages to Trash in batches of 1,000...`);
  const BATCH_SIZE = 1000;
  let processed = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
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
    console.log(`  [Trashed] ${processed.toLocaleString()} / ${ids.length.toLocaleString()} messages`);
    await sleep(400); // polite pause between 1000-message batches
  }

  console.log(`\n========================================`);
  console.log(`[✓] SUCCESS: Moved ${processed.toLocaleString()} expired promotions to Trash!`);
  console.log(`They have been cleared from your Inbox & Promotions view.`);
  console.log(`They will remain in Trash for 30 days before permanent deletion.`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
