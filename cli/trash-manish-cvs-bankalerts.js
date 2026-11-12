import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Moves unsolicited job applicant resumes and ephemeral bank/UPI transaction alerts to Trash
// Preserves:
// - All bank statements, e-statements, interest/TDS certificates, balance confirmations, sanction letters
// - All Starred emails
// - All Hennex, UA Overseas, Madamser & Co, Shailen Bhatia, D-VA, Anamika Trading, MM Consumer emails
// - Education (IIMA) and tech tools (Claude/Anthropic, OpenAI, GitHub)

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

  console.log(`=== Trash Job Applicants & Ephemeral Bank Alerts ${isDryRun ? '(DRY RUN)' : '(LIVE MODE)'} ===\n`);

  const baseExclusions = '-label:Legal/Litigation-Trademarks -label:Business/D-VA -label:Business/Anamika-Trading -label:Business/MM-Consumer -label:Education-IIMA -is:starred -Hennex -madamser -"UA Overseas" -"Shailen" -from:(gov.in OR nic.in OR mca.gov.in OR gst.gov.in OR incometax.gov.in)';

  const targets = [
    {
      name: '1. Unsolicited Job Applicants & CVs',
      q: `in:inbox (subject:(CV OR Resume OR "Curriculum Vitae" OR "UAE Experience" OR "Husbands Visa" OR "Husband Visa" OR "Driving License" OR "Job Application" OR "Application for" OR "Applying for" OR "Job Seeker") OR from:(mailboxcv.com OR jasglobalhr.com OR gulfcandidates.com) OR (filename:resume OR filename:cv)) ${baseExclusions} -from:(anthropic.com OR openai.com OR github.com OR google.com)`,
    },
    {
      name: '2. Ephemeral Bank & UPI Alerts (UPI notifications, debit/credit swipe pings)',
      q: `in:inbox (from:(alerts@hdfcbank.bank.in OR alerts.hdfcbank.net OR hdfcbank.net) OR (from:(hdfcbank.com OR icicibank.com OR axisbank.com OR sbicard.com OR rakbank.ae OR cbd.ae OR adcb.com) subject:("UPI txn" OR "done a UPI" OR "Account update for your" OR "InstaAlert" OR "ATM Withdrawal" OR "debited for" OR "credited for" OR "Transaction Alert"))) ${baseExclusions} -subject:(Statement OR eStatement OR "E-Statement" OR Certificate OR Interest OR TDS OR "Form 16" OR "Form 26AS" OR Sanction OR Facility OR Balance OR Tax OR Confirmation OR Invoice OR Receipt)`,
    },
  ];

  const allIds = new Set();
  for (const t of targets) {
    const ids = await collectIds(gmail, t.q, t.name);
    ids.forEach((id) => allIds.add(id));
  }

  const uniqueIds = Array.from(allIds);
  console.log(`========================================`);
  console.log(`Total unique messages to trash across both targets: ${uniqueIds.length.toLocaleString()}`);
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
  console.log(`Job applicant CVs and ephemeral bank alerts have been cleared from your Inbox.`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
