/**
 * audit-sohini.js — read-only inbox scan for sohinirohra1@gmail.com.
 * Aggregates sender domains + volumes (headers only, no bodies) so we can
 * propose label/filter categories. Makes zero changes.
 *
 * Usage: node audit-sohini.js [--max 500]
 */
import { google } from 'googleapis';
import { getAuthSohini } from './auth-sohini.js';

const maxArg = process.argv.find((a) => a.startsWith('--max'));
const MAX_MESSAGES = maxArg ? Number(maxArg.split('=')[1]) || 500 : 500;

function domainOf(from) {
  const m = (from || '').match(/@([^>\s,;]+)/);
  return (m ? m[1] : '(unknown)').toLowerCase();
}

const auth = await getAuthSohini();
const gmail = google.gmail({ version: 'v1', auth });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getMeta(id, tries = 0) {
  try {
    return await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'metadata',
      metadataHeaders: ['From'],
    });
  } catch (e) {
    const retryable = [403, 429, 500, 503].includes(e?.code);
    if (retryable && tries < 5) {
      await sleep(15000 * (tries + 1));
      return getMeta(id, tries + 1);
    }
    throw e;
  }
}

const profile = await gmail.users.getProfile({ userId: 'me' });
console.log(`\n=== Inbox scan: ${profile.data.emailAddress} (${profile.data.messagesTotal} total) ===\n`);

const byDomain = new Map();
const byLabel = new Map();
let scanned = 0;
let pageToken;

do {
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: Math.min(500, MAX_MESSAGES - scanned),
    pageToken,
  });
  const messages = res.data.messages || [];
  if (!messages.length) break;

  for (const m of messages) {
    const msg = await getMeta(m.id);
    await sleep(800);
    {
      const from = (msg.data.payload?.headers || []).find(
        (h) => h.name.toLowerCase() === 'from',
      )?.value;
      const d = domainOf(from);
      byDomain.set(d, (byDomain.get(d) || 0) + 1);
      for (const lid of msg.data.labelIds || []) {
        byLabel.set(lid, (byLabel.get(lid) || 0) + 1);
      }
      scanned++;
      if (scanned % 25 === 0) console.log(`  ...${scanned} headers read`);
    }
  }
  pageToken = res.data.nextPageToken;
} while (pageToken && scanned < MAX_MESSAGES);

console.log(`Scanned ${scanned} most-recent messages. Top senders by domain:\n`);
for (const [d, n] of [...byDomain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  console.log(`  ${String(n).padStart(4)}  ${d}`);
}
if (byDomain.size > 40) console.log(`  ... +${byDomain.size - 40} more domains`);

const labelsRes = await gmail.users.labels.list({ userId: 'me' });
const nameOf = (id) => labelsRes.data.labels.find((l) => l.id === id)?.name || id;
console.log(`\nExisting label distribution (top 20):\n`);
for (const [lid, n] of [...byLabel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(n).padStart(4)}  ${nameOf(lid)}`);
}
console.log(`\n✓ Read-only scan complete. No changes made.`);
