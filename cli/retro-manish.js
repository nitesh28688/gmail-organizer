import { google } from 'googleapis';
import { getAuthManish } from './auth-manish.js';

// Retroactive pass for mulchandani.manish@gmail.com
// Labels existing mail matching our rules and archives high-volume bulk mail out of INBOX.
// Usage:
//   node retro-manish.js --dry-run
//   node retro-manish.js

const isDryRun = process.argv.includes('--dry-run');

const jobs = {
  'Real-Estate': {
    domains: [
      'magicbricks.com',
      'apartmentlist.com',
      'emp.apartmentlist.com',
      '99acres.com',
      'housing.com',
      'nobroker.in',
    ],
    archive: true,
  },
  'Newsletters': {
    domains: [
      'hindustantimes.com',
      'marketing.hindustantimes.com',
      'yourstory.com',
      'forbes.com',
      'email.forbes.com',
      'etbfsi.com',
      'economictimes.com',
      'livemint.com',
      'substack.com',
      'medium.com',
      'beehiiv.com',
    ],
    archive: true,
  },
  'Travel': {
    domains: [
      'goindigo.in',
      'marketing.goindigo.in',
      'airindiaexpress.com',
      'promo.airindiaexpress.com',
      'trip.com',
      'newsletter.trip.com',
      'makemytrip.com',
      'zen-makemytrip.com',
      'zen2-makemytrip.com',
      'goibibo.com',
      'content.goibibo.com',
      'tajhotels.com',
      'all.com',
      'mail.all.com',
      'stayvista.com',
      'emails.stayvista.com',
      'spicejet.com',
      'web-spicejet.com',
      'airindia.com',
      'booking.com',
      'airbnb.com',
    ],
    archive: true,
  },
  'Jobs-HR': {
    domains: [
      'jasglobalhr.com',
      'mailboxcv.com',
      'naukri.com',
      'linkedin.com',
      'foundit.in',
      'indeed.com',
    ],
    archive: true,
  },
  'Finance': {
    domains: [
      'hdfcbank.bank.in',
      'mailers.hdfcbank.bank.in',
      'hdfcbank.com',
      'upstox.com',
      'campaigns.upstox.com',
      'paytm.com',
      'info.paytm.com',
      'zerodha.net',
      'reportsmailer.zerodha.net',
      'zerodha.com',
      'adcb.com',
      'rakbank.ae',
      'cbd.ae',
      'flexiloans.com',
      'icicibank.com',
      'axisbank.com',
      'sbicard.com',
      'cred.club',
    ],
    archive: false, // Keep in inbox
  },
  'Services': {
    domains: [
      'google.com',
      'jio.com',
      'openai.com',
      'tm.openai.com',
      'adobe.com',
      'mail.adobe.com',
      'apple.com',
      'microsoft.com',
      'amazon.in',
      'amazon.com',
    ],
    archive: false, // Keep in inbox
  },
  'Education-IIMA': {
    domains: [
      'iima.ac.in',
    ],
    archive: false, // Keep in inbox
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 0) {
  try {
    return await fn();
  } catch (e) {
    if ([403, 429, 500, 503].includes(e?.code) && tries < 5) {
      console.log(`  [rate-limit/transient] waiting ${(tries + 1) * 5}s before retry...`);
      await sleep(5000 * (tries + 1));
      return withRetry(fn, tries + 1);
    }
    throw e;
  }
}

async function main() {
  const auth = await getAuthManish();
  const gmail = google.gmail({ version: 'v1', auth });

  console.log(`=== Retroactive Email Organizer ${isDryRun ? '(DRY RUN — NO CHANGES)' : '(LIVE MODE)'} ===\n`);

  const labelsRes = await withRetry(() => gmail.users.labels.list({ userId: 'me' }));
  const labelMap = new Map((labelsRes.data.labels || []).map((l) => [l.name, l.id]));

  let totalFound = 0;
  let totalArchived = 0;

  for (const [labelName, { domains, archive }] of Object.entries(jobs)) {
    const labelId = labelMap.get(labelName);
    if (!labelId) {
      console.error(`[skip] MISSING LABEL: ${labelName}`);
      continue;
    }

    const q = domains.map((d) => `from:${d}`).join(' OR ');
    console.log(`\nScanning category: ${labelName} (archive: ${archive}) ...`);

    let ids = [];
    let pageToken;

    do {
      const res = await withRetry(() =>
        gmail.users.messages.list({
          userId: 'me',
          q,
          maxResults: 500,
          pageToken,
        }),
      );
      const messages = res.data.messages || [];
      ids.push(...messages.map((m) => m.id));
      pageToken = res.data.nextPageToken;
      if (ids.length && ids.length % 1000 === 0) {
        console.log(`  ...found ${ids.length} messages matching ${labelName}`);
      }
      await sleep(200);
    } while (pageToken);

    console.log(`  Found: ${ids.length} messages for ${labelName}`);
    totalFound += ids.length;
    if (archive) totalArchived += ids.length;

    if (isDryRun || ids.length === 0) {
      continue;
    }

    // Apply batch updates in chunks of 1000
    const body = { addLabelIds: [labelId] };
    if (archive) {
      body.removeLabelIds = ['INBOX'];
    }

    for (let i = 0; i < ids.length; i += 1000) {
      const batchIds = ids.slice(i, i + 1000);
      await withRetry(() =>
        gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batchIds,
            ...body,
          },
        }),
      );
      console.log(`  [applied] ${Math.min(i + 1000, ids.length)} / ${ids.length} messages`);
      await sleep(350);
    }
    console.log(`  [✓] ${labelName} complete.`);
  }

  console.log(`\n========================================`);
  console.log(`Total messages processed: ${totalFound}`);
  if (!isDryRun) {
    console.log(`Total bulk messages archived out of inbox: ${totalArchived}`);
  }
  console.log(`========================================`);
  console.log(isDryRun ? `[✓] Dry run finished. Run without --dry-run to apply.` : `[✓] Retroactive organization complete!`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
