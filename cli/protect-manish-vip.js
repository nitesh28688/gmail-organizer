import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Dedicated script to label, filter, and permanently protect Manish's core legal & business entities:
// 1. Legal / Trademarks & Litigation: Hennex India, UA Overseas, Madamser & Co, Shailen Bhatia
// 2. D-VA
// 3. Anamika Trading
// 4. MM Consumer

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

const protectedConfigs = [
  {
    name: 'Legal/Litigation-Trademarks',
    color: { backgroundColor: '#e66550', textColor: '#ffffff' }, // Bold Red / Coral
    query: 'Hennex OR "UA Overseas" OR "U.A Overseas" OR "U.A. Overseas" OR madamser OR "Shailen Bhatia" OR "madamsertmrdept@gmail.com" OR "madamserbills@gmail.com" OR "madamser@gmail.com"',
  },
  {
    name: 'Business/D-VA',
    color: { backgroundColor: '#285bac', textColor: '#ffffff' }, // Deep Blue
    query: '"D-VA" OR "DVA" OR from:d-va.in OR from:dva.in OR realheena68@gmail.com OR "real henna" OR realheena OR brahmart.design@gmail.com OR "Brahmart Packers" OR "brahm art" OR brahmart',
  },
  {
    name: 'Business/Anamika-Trading',
    color: { backgroundColor: '#16a765', textColor: '#ffffff' }, // Green
    query: '"Anamika Trading" OR "Anamika" OR from:anamikatrading.com',
  },
  {
    name: 'Business/MM-Consumer',
    color: { backgroundColor: '#8e63ce', textColor: '#ffffff' }, // Purple
    query: '"MM Consumer" OR "MMConsumer" OR "M.M. Consumer" OR from:mmconsumer.com',
  },
];

async function main() {
  const auth = await getAuthManish();
  const gmail = google.gmail({ version: 'v1', auth });

  console.log('=== Step 1: Creating Labels in Gmail ===\n');
  const labelsRes = await withRetry(() => gmail.users.labels.list({ userId: 'me' }));
  const labelMap = new Map((labelsRes.data.labels || []).map((l) => [l.name, l.id]));

  for (const item of protectedConfigs) {
    if (labelMap.has(item.name)) {
      console.log(`[label exists] ${item.name}`);
      continue;
    }
    const created = await withRetry(() =>
      gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: item.name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
          color: item.color,
        },
      })
    );
    labelMap.set(item.name, created.data.id);
    console.log(`[label created] ${item.name} (${created.data.id})`);
  }

  console.log('\n=== Step 2: Creating Automated Incoming Filters ===\n');
  const filtersRes = await withRetry(() => gmail.users.settings.filters.list({ userId: 'me' }));
  const existingFilters = filtersRes.data.filter || [];

  for (const item of protectedConfigs) {
    const labelId = labelMap.get(item.name);
    const existing = existingFilters.find(
      (f) => f.criteria?.query === item.query && f.action?.addLabelIds?.includes(labelId)
    );
    if (existing) {
      console.log(`[filter exists] ${item.name}`);
      continue;
    }

    await withRetry(() =>
      gmail.users.settings.filters.create({
        userId: 'me',
        requestBody: {
          criteria: { query: item.query },
          action: {
            addLabelIds: [labelId],
            // Never archive: keeps it prominently in Inbox!
          },
        },
      })
    );
    console.log(`[filter created] ${item.name} (Incoming mail will be automatically tagged)`);
  }

  console.log('\n=== Step 3: Retroactive Backfill for All Historical Messages ===\n');
  let grandTotalTagged = 0;

  for (const item of protectedConfigs) {
    const labelId = labelMap.get(item.name);
    console.log(`Scanning for: ${item.name} ...`);

    let ids = [];
    let pageToken;
    do {
      const res = await withRetry(() =>
        gmail.users.messages.list({
          userId: 'me',
          q: item.query,
          maxResults: 500,
          pageToken,
          fields: 'nextPageToken,messages(id)',
        })
      );
      const msgs = res.data.messages || [];
      ids.push(...msgs.map((m) => m.id));
      pageToken = res.data.nextPageToken;
      await sleep(100);
    } while (pageToken);

    console.log(`  Found ${ids.length.toLocaleString()} matching messages for ${item.name}`);
    grandTotalTagged += ids.length;

    if (ids.length > 0) {
      const BATCH = 1000;
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        await withRetry(() =>
          gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: chunk,
              addLabelIds: [labelId],
            },
          })
        );
        console.log(`  [Tagged] ${Math.min(i + BATCH, ids.length)} / ${ids.length}`);
        await sleep(350);
      }
    }
    console.log(`  [✓] ${item.name} complete.\n`);
  }

  console.log(`========================================`);
  console.log(`[✓] SUCCESS: Protected & labeled ${grandTotalTagged.toLocaleString()} total messages!`);
  console.log(`All emails for Hennex, UA Overseas, Madamser, Shailen Bhatia, D-VA, Anamika Trading, and MM Consumer are tagged and safe.`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
