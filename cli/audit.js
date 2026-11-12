/**
 * audit.js — scans existing inbox/all-mail and applies labels retroactively.
 * Processes in batches. Safe to re-run (only adds labels, never removes).
 *
 * Usage: node audit.js [--dry-run]
 */
import { google } from 'googleapis';
import { getAuth } from './auth.js';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50; // messages per modify call (Gmail API limit: 1000)
const MAX_PAGES = 50;  // safety cap — remove to process full inbox

// ─── Matching rules ───────────────────────────────────────────────────────────
// Each rule: { match: fn(headers) => bool, labels: [labelName] }
function buildRules(labelMap) {
  const toMatch   = (addr) => (h) => (h.to || '').toLowerCase().includes(addr.toLowerCase());
  const fromMatch = (dom)  => (h) => (h.from || '').toLowerCase().includes(dom.toLowerCase());
  const subjMatch = (kw)   => (h) => (h.subject || '').toLowerCase().includes(kw.toLowerCase());

  const rule = (matchFn, ...labelNames) => ({
    match: matchFn,
    labelIds: labelNames.map(n => labelMap.get(n)).filter(Boolean),
  });

  return [
    // Custom domain addresses
    rule(toMatch('nitesh@linearventures.in'),   'LinearVentures/nitesh'),
    rule(toMatch('info@linearventures.in'),      'LinearVentures/info'),
    rule(toMatch('accounts@linearventures.in'),  'LinearVentures/accounts'),
    rule(toMatch('export@linearventures.in'),    'LinearVentures/export'),
    rule(toMatch('nitesh@nanoliss.com'),         'Nanoliss/nitesh'),
    rule(toMatch('hello@nanoliss.com'),          'Nanoliss/hello'),
    rule(toMatch('refunds@nanoliss.com'),        'Nanoliss/refunds'),
    rule(toMatch('marketing@nanoliss.com'),      'Nanoliss/marketing'),
    rule(toMatch('support@nanoliss.com'),        'Nanoliss/support'),
    // Services
    rule(fromMatch('vercel.com'),                'Services/Vercel'),
    rule(fromMatch('cloudflare.com'),            'Services/Cloudflare'),
    rule(fromMatch('facebookmail.com'),          'Services/Meta'),
    rule(fromMatch('meta.com'),                  'Services/Meta'),
    rule(fromMatch('razorpay.com'),              'Services/Razorpay'),
    rule(fromMatch('gst.gov.in'),                'Services/GST-Tax'),
    rule(fromMatch('google.com'),                'Services/Google'),
    rule(fromMatch('delhivery.com'),             'Services/Shipping'),
    rule(fromMatch('bluedart.com'),              'Services/Shipping'),
    rule(fromMatch('shiprocket.com'),            'Services/Shipping'),
    rule(fromMatch('dtdc.com'),                  'Services/Shipping'),
    rule(fromMatch('ecomexpress.in'),            'Services/Shipping'),
    // Finance
    rule(subjMatch('invoice'),                   'Finance/Invoices'),
    rule(subjMatch('tax invoice'),               'Finance/Invoices'),
    rule(fromMatch('hdfcbank.com'),              'Finance/Bank'),
    rule(fromMatch('axisbank.com'),              'Finance/Bank'),
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractHeaders(message) {
  const headers = {};
  for (const h of message.payload?.headers || []) {
    headers[h.name.toLowerCase()] = h.value;
  }
  return headers;
}

async function applyLabels(gmail, messageIds, labelIds) {
  if (!labelIds.length || !messageIds.length) return;
  if (DRY_RUN) { console.log(`  [dry-run] would label ${messageIds.length} messages: ${labelIds}`); return; }
  // Gmail batchModify supports up to 1000 ids at once
  for (let i = 0; i < messageIds.length; i += 1000) {
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds.slice(i, i + 1000),
        addLabelIds: labelIds,
      },
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const auth = await getAuth();
const gmail = google.gmail({ version: 'v1', auth });

// Load label map
const labelsRes = await gmail.users.labels.list({ userId: 'me' });
const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));
const rules = buildRules(labelMap);

console.log(`\n=== Inbox Audit ${DRY_RUN ? '[DRY RUN]' : ''} ===`);
console.log(`Scanning all mail — this may take a minute...\n`);

let pageToken;
let page = 0;
let total = 0;

// Accumulate per-label batches before applying
const labelBatches = new Map(); // labelId[] key → [messageId]

do {
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 500,
    pageToken,
    q: 'in:all', // scan everything
  });

  const messages = res.data.messages || [];
  if (!messages.length) break;

  // Fetch full metadata for this page in parallel (chunks of 10)
  const CHUNK = 10;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const detailed = await Promise.all(
      chunk.map(m => gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'To', 'Delivered-To', 'Subject'] }))
    );

    for (const msg of detailed) {
      const h = extractHeaders(msg.data);
      // Combine To + Delivered-To for routing matches
      h.to = [h.to, h['delivered-to']].filter(Boolean).join(' ');

      for (const rule of rules) {
        if (rule.match(h) && rule.labelIds.length) {
          const key = rule.labelIds.join(',');
          if (!labelBatches.has(key)) labelBatches.set(key, { labelIds: rule.labelIds, messageIds: [] });
          labelBatches.get(key).messageIds.push(msg.data.id);
        }
      }
      total++;
    }
  }

  console.log(`  Scanned ${total} messages so far...`);
  pageToken = res.data.nextPageToken;
  page++;
} while (pageToken && page < MAX_PAGES);

console.log(`\nScanned ${total} messages total. Applying labels...`);

let applied = 0;
for (const { labelIds, messageIds } of labelBatches.values()) {
  const names = labelIds.map(id => labelsRes.data.labels.find(l => l.id === id)?.name).join(', ');
  console.log(`  ${names}: ${messageIds.length} messages`);
  await applyLabels(gmail, messageIds, labelIds);
  applied += messageIds.length;
}

console.log(`\n✓ Done. Labelled ${applied} message-label assignments across ${total} emails.`);
if (DRY_RUN) console.log('  (dry-run — no changes made)');
