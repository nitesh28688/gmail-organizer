import { google } from 'googleapis';
import { getAuthSohini } from './auth-sohini.js';

// Retroactive pass: label (+ archive for categories) all EXISTING mail
// matching our rules. Filters only apply to new arrivals, so the backlog
// needs this one-time sweep. Safe to re-run (additive only).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 0) {
  try {
    return await fn();
  } catch (e) {
    if ([403, 429, 500, 503].includes(e?.code) && tries < 5) {
      await sleep(15000 * (tries + 1));
      return withRetry(fn, tries + 1);
    }
    throw e;
  }
}

// label → { q, archive }
const jobs = {
  'Sohini/LinkedIn': { q: 'from:linkedin.com', archive: true },
  'Sohini/Newsletters': { q: 'from:mail.beehiiv.com OR from:insider.theloom.in OR from:brut.media OR from:raptormediastudio.com OR from:riseworldwide.in OR from:maashha.com OR from:ecommercedoctor.in OR from:reminder.theloom.in', archive: true },
  'Sohini/Spotify': { q: 'from:spotify.com OR from:alerts.spotify.com', archive: true },
  'Sohini/Travel': { q: 'from:tripadvisor.com OR from:tdacservices.immigration.go.th', archive: true },
  'Sohini/Shopping': { q: 'from:hm.com OR from:bookmyshow.com OR from:bookmyshow.info', archive: true },
  'Sohini/Zoom': { q: 'from:zoom.us', archive: true },
  'Sohini/Google': { q: 'from:google.com OR from:youtube.com', archive: true },
  'Sohini/Cloudflare': { q: 'from:cloudflare.com OR from:cloudflare.net', archive: true },
  'Sohini/AI-Tools': { q: 'from:fathom.video OR from:prezi.com OR from:gamma.app OR from:anthropic.com', archive: true },
  'Sohini/Personal': { q: 'from:gmail.com', archive: false },
  'Sohini/Misc': { q: 'from:astrojudge.com OR from:rightselection.com OR from:godaddy.com OR from:pinterest.com', archive: false },
  'Sohini/info': { q: 'to:info@sohinirohra.com', archive: false },
  'Sohini/appointments': { q: 'to:appointments@sohinirohra.com', archive: false },
  'Sohini/sohini': { q: 'to:sohini@sohinirohra.com', archive: false },
  'Sohini/press': { q: 'to:press@sohinirohra.com', archive: false },
};

async function main() {
  const auth = await getAuthSohini();
  const gmail = google.gmail({ version: 'v1', auth });

  const labelsRes = await withRetry(() => gmail.users.labels.list({ userId: 'me' }));
  const labelMap = new Map(labelsRes.data.labels.map((l) => [l.name, l.id]));

  for (const [labelName, { q, archive }] of Object.entries(jobs)) {
    const labelId = labelMap.get(labelName);
    if (!labelId) {
      console.error(`MISSING LABEL: ${labelName}`);
      continue;
    }
    // Collect all matching ids
    let ids = [];
    let pageToken;
    do {
      const res = await withRetry(() =>
        gmail.users.messages.list({ userId: 'me', q, maxResults: 500, pageToken }),
      );
      ids.push(...(res.data.messages || []).map((m) => m.id));
      pageToken = res.data.nextPageToken;
      await sleep(400);
    } while (pageToken);

    if (!ids.length) {
      console.log(`[skip] ${labelName}: no matches`);
      continue;
    }
    const body = { ids, addLabelIds: [labelId] };
    if (archive) body.removeLabelIds = ['INBOX'];
    for (let i = 0; i < ids.length; i += 1000) {
      await withRetry(() =>
        gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: { ...body, ids: ids.slice(i, i + 1000) },
        }),
      );
      await sleep(400);
    }
    console.log(`[done] ${labelName}: ${ids.length} messages${archive ? ' (archived)' : ''}`);
  }
  console.log('\n[✓] Retroactive pass complete.');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
