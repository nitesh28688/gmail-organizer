import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Clears 3 specific targeted junk categories for mulchandani.manish@gmail.com:
// 1. Old Lead & Loan Marketing Spam (>90d)
// 2. Dead Festival & Holiday Greetings (>60d)
// 3. Old Settled Payment Reminders (>180d)

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
    await sleep(80);
  } while (pageToken);

  console.log(`  Found: ${ids.length.toLocaleString()} messages for ${name}\n`);
  return ids;
}

async function main() {
  const auth = await getAuthManish();
  const gmail = google.gmail({ version: 'v1', auth });

  console.log(`=== Trash 3 Targeted Junk Categories ${isDryRun ? '(DRY RUN)' : '(LIVE MODE)'} ===\n`);

  const targets = [
    {
      name: '1. Old Lead & Loan Marketing Spam',
      q: 'in:inbox (from:(paisabazaar.com OR bankbazaar.com OR policybazaar.com OR "notifications@" OR info@) (subject:(loan OR "credit card" OR "credit score" OR "cibil" OR "pre-approved" OR "preapproved" OR "instant loan" OR "car loan" OR "sell car" OR "sell your car")) OR (subject:("credit report is available" OR "credit score" OR "pre-approved loan" OR "pre-approved credit" OR "sell your car" OR "car festival" OR "vehicIe" OR "AvaiIabIe")) older_than:90d -is:starred -label:Education-IIMA -subject:(confirmation OR certificate OR statement OR facility OR sanction OR schedule OR tax OR invoice)',
    },
    {
      name: '2. Dead Festival & Holiday Greetings (>60d)',
      q: 'in:inbox subject:(Diwali OR Deepavali OR Dussehra OR "Durga Puja" OR Holi OR "New Year" OR Eid OR Christmas OR Navratri OR "Independence Day" OR "Republic Day" OR "Ganesh Chaturthi" OR "Raksha Bandhan" OR "Season\'s Greetings" OR "Happy Dhanteras") older_than:60d -is:starred -label:Education-IIMA',
    },
    {
      name: '3. Old Settled Payment Reminders (>180d)',
      q: 'in:inbox subject:("Payment Reminder" OR "Bill Due" OR "Reminder: Bill" OR "Upcoming Due Date" OR "Payment is Due" OR "Reminder - Payment") older_than:180d -is:starred -label:Education-IIMA -subject:(Receipt OR Invoice OR "Tax Invoice" OR Statement OR Confirmation)',
    },
  ];

  const allIds = new Set();
  for (const t of targets) {
    const ids = await collectIds(gmail, t.q, t.name);
    ids.forEach((id) => allIds.add(id));
  }

  const uniqueIds = Array.from(allIds);
  console.log(`========================================`);
  console.log(`Total unique messages to trash across these 3 targets: ${uniqueIds.length.toLocaleString()}`);
  console.log(`========================================\n`);

  if (uniqueIds.length === 0) {
    console.log('[✓] No matching messages found.');
    return;
  }

  if (isDryRun) {
    console.log(`[DRY RUN] Would move ${uniqueIds.length.toLocaleString()} messages to Trash.`);
    return;
  }

  console.log(`Moving ${uniqueIds.length.toLocaleString()} messages to Trash...`);
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
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
