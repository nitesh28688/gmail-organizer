import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Clears the 5 "Non-Financial Crap" categories selected by the user:
// 1. Ancient Delivery & Tracking Logs (>1y)
// 2. Expired Calendar & Meeting Invites (>1y)
// 3. Terms of Service & Privacy Policy Updates (>1y)
// 4. Automated Feedback & Survey Requests (>180d)
// 5. One-Way App System Pings & Forum Notifications (>1y, Quora, etc.)

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

  console.log(`=== Trash Non-Financial Crap Categories ${isDryRun ? '(DRY RUN)' : '(LIVE MODE)'} ===\n`);

  const baseExclusions = '-label:Finance -label:Education-IIMA -label:Legal/Litigation-Trademarks -label:Business/D-VA -label:Business/Anamika-Trading -label:Business/MM-Consumer -is:starred -Hennex -madamser -"UA Overseas" -"Shailen" -from:(gov.in OR nic.in OR mca.gov.in OR gst.gov.in OR incometax.gov.in)';

  const targets = [
    {
      name: '1. Ancient Delivery & Tracking Logs (>1y)',
      q: `in:inbox (from:(amazon.in OR amazon.com OR flipkart.com OR myntra.com OR swiggy.in OR zomato.com OR uber.com OR olacabs.com OR delhivery.com OR bluedart.com OR shiprocket.in OR shiprocket.co OR dtdc.com) (subject:(delivery OR delivered OR shipped OR dispatched OR tracking OR arriving OR "order confirmed" OR "ride with" OR "trip with"))) older_than:1y ${baseExclusions} -subject:(invoice OR "tax invoice")`,
    },
    {
      name: '2. Expired Calendar & Meeting Invites (>1y)',
      q: `in:inbox (filename:invite.ics OR filename:ical OR subject:("Invitation:" OR "Accepted:" OR "Declined:" OR "Tentative:" OR "Updated invitation:" OR "Canceled invitation:")) older_than:1y ${baseExclusions}`,
    },
    {
      name: '3. Terms of Service & Privacy Policy Updates (>1y)',
      q: `in:inbox subject:("Terms of Service" OR "Privacy Policy" OR "Terms of Use" OR "User Agreement" OR "Terms & Conditions" OR "updated our Terms" OR "updating our Terms" OR "Terms of Service Update") older_than:1y ${baseExclusions}`,
    },
    {
      name: '4. Automated Feedback & Survey Requests (>180d)',
      q: `in:inbox subject:("How did we do" OR "Rate your" OR "How was your" OR "Give us your feedback" OR "Feedback on" OR "Take our survey" OR "Tell us what you think" OR "Your feedback matters" OR "Share your experience") older_than:180d ${baseExclusions}`,
    },
    {
      name: '5. One-Way App Pings, Quora & Forum Notifications (>1y)',
      q: `in:inbox (from:(quora.com OR helium10.com) OR subject:("Security alert" OR "New login" OR "Sign-in from" OR "Password changed" OR "Password reset" OR "Verify your email" OR "Email verification" OR "Welcome to")) older_than:1y ${baseExclusions}`,
    },
  ];

  const allIds = new Set();
  for (const t of targets) {
    const ids = await collectIds(gmail, t.q, t.name);
    ids.forEach((id) => allIds.add(id));
  }

  const uniqueIds = Array.from(allIds);
  console.log(`========================================`);
  console.log(`Total unique messages to trash across these 5 targets: ${uniqueIds.length.toLocaleString()}`);
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
  console.log(`[✓] SUCCESS: Moved ${processed.toLocaleString()} non-financial crap messages to Trash!`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
