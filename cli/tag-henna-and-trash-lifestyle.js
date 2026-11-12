import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// 1. Tags & protects Real Henna and Brahm Art Packers under Business/D-VA
// 2. Trashes Lifestyle, Resort, and Retail brand newsletters

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

  console.log('=== Step 1: Protecting Real Henna & Brahm Art under Business/D-VA ===\n');
  const labelsRes = await withRetry(() => gmail.users.labels.list({ userId: 'me' }));
  const dvaLabel = labelsRes.data.labels.find((l) => l.name === 'Business/D-VA');
  if (!dvaLabel) {
    throw new Error('Business/D-VA label not found!');
  }

  const hennaQuery = 'realheena68@gmail.com OR "real henna" OR realheena OR brahmart.design@gmail.com OR "Brahmart Packers" OR "brahm art" OR brahmart';

  let hennaIds = [];
  let pageToken;
  do {
    const res = await withRetry(() =>
      gmail.users.messages.list({
        userId: 'me',
        q: hennaQuery,
        maxResults: 500,
        pageToken,
        fields: 'nextPageToken,messages(id)',
      })
    );
    const msgs = res.data.messages || [];
    hennaIds.push(...msgs.map((m) => m.id));
    pageToken = res.data.nextPageToken;
    await sleep(80);
  } while (pageToken);

  console.log(`Found ${hennaIds.length} messages for Real Henna and Brahm Art Packers.`);
  if (hennaIds.length > 0 && !isDryRun) {
    const BATCH = 1000;
    for (let i = 0; i < hennaIds.length; i += BATCH) {
      const chunk = hennaIds.slice(i, i + BATCH);
      await withRetry(() =>
        gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: chunk,
            addLabelIds: [dvaLabel.id],
          },
        })
      );
      console.log(`  [Tagged] ${Math.min(i + BATCH, hennaIds.length)} / ${hennaIds.length} with Business/D-VA`);
      await sleep(350);
    }
  }
  console.log('[✓] Real Henna and Brahm Art permanently tagged and protected under Business/D-VA!\n');

  console.log('=== Step 2: Trashing Lifestyle, Resort, and Retail Newsletters ===\n');

  const baseExclusions = '-label:Legal/Litigation-Trademarks -label:Business/D-VA -label:Business/Anamika-Trading -label:Business/MM-Consumer -label:Education-IIMA -label:Finance -is:starred -Hennex -madamser -"UA Overseas" -"Shailen" -"real henna" -realheena -brahmart';

  const lifestyleQuery = `in:inbox (from:(crownandchamparesorts.com OR zeel.com OR johnstonmurphy.com OR decathlon.in OR decathlon.com OR etihadguest.com OR clubmarriott.in OR "Crown & Champa" OR "Johnston & Murphy" OR "Club Marriott" OR "Club ITC") OR (from:(canva.com) subject:(design OR tips OR school OR templates))) ${baseExclusions} -subject:(invoice OR receipt OR "tax invoice" OR "booking confirmation")`;

  console.log(`Scanning [Lifestyle, Resort & Retail Newsletters] ...`);
  let trashIds = [];
  pageToken = undefined;

  do {
    const res = await withRetry(() =>
      gmail.users.messages.list({
        userId: 'me',
        q: lifestyleQuery,
        maxResults: 500,
        pageToken,
        fields: 'nextPageToken,messages(id)',
      })
    );
    const msgs = res.data.messages || [];
    trashIds.push(...msgs.map((m) => m.id));
    pageToken = res.data.nextPageToken;
    await sleep(80);
  } while (pageToken);

  console.log(`Found ${trashIds.length.toLocaleString()} messages to trash for Lifestyle, Resort, & Retail Newsletters.`);

  if (trashIds.length > 0 && !isDryRun) {
    const BATCH = 1000;
    let processed = 0;
    for (let i = 0; i < trashIds.length; i += BATCH) {
      const chunk = trashIds.slice(i, i + BATCH);
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
      console.log(`  [Trashed] ${processed.toLocaleString()} / ${trashIds.length.toLocaleString()}`);
      await sleep(350);
    }
    console.log(`[✓] SUCCESS: Moved ${processed.toLocaleString()} lifestyle/resort/retail newsletters to Trash!`);
  }
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
