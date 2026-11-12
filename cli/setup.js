/**
 * setup.js — creates all Gmail labels, filters, and Send As aliases.
 * Run ONCE after auth.js. Safe to re-run — skips existing labels/filters.
 */
import { google } from 'googleapis';
import { getAuth } from './auth.js';

// ─── Label definitions ────────────────────────────────────────────────────────
// Format: { name, bgColor, textColor }
// Nested labels use "/" separator (Gmail creates parents automatically)
const LABEL_DEFS = [
  // Only Gmail API allowed palette colors (verified):
  // #4a86e8 #16a766 #e66550 #ffad47 #f691b3 #8e63ce #cc3a21 #149e60
  // #0d3472 #b65775 #98d7e4 #711a36 #1c4587 #6d9eeb #c9daf8 #fce8b2

  // --- Linear Ventures domain ---
  { name: 'LinearVentures',            bg: '#4a86e8', fg: '#ffffff' },
  { name: 'LinearVentures/nitesh',     bg: '#4a86e8', fg: '#ffffff' },
  { name: 'LinearVentures/info',       bg: '#4a86e8', fg: '#ffffff' },
  { name: 'LinearVentures/accounts',   bg: '#4a86e8', fg: '#ffffff' },
  { name: 'LinearVentures/export',     bg: '#4a86e8', fg: '#ffffff' },

  // --- Nanoliss domain ---
  { name: 'Nanoliss',                  bg: '#16a766', fg: '#ffffff' },
  { name: 'Nanoliss/nitesh',           bg: '#16a766', fg: '#ffffff' },
  { name: 'Nanoliss/hello',            bg: '#16a766', fg: '#ffffff' },
  { name: 'Nanoliss/refunds',          bg: '#e66550', fg: '#ffffff' },
  { name: 'Nanoliss/marketing',        bg: '#f691b3', fg: '#000000' },
  { name: 'Nanoliss/support',          bg: '#ffad47', fg: '#000000' },

  // --- Services ---
  { name: 'Services',                  bg: '#8e63ce', fg: '#ffffff' },
  { name: 'Services/Vercel',           bg: '#0d3472', fg: '#ffffff' },
  { name: 'Services/Cloudflare',       bg: '#ffad47', fg: '#000000' },
  { name: 'Services/Meta',             bg: '#1c4587', fg: '#ffffff' },
  { name: 'Services/Razorpay',         bg: '#6d9eeb', fg: '#000000' },
  { name: 'Services/GST-Tax',          bg: '#cc3a21', fg: '#ffffff' },
  { name: 'Services/Shipping',         bg: '#e66550', fg: '#ffffff' },
  { name: 'Services/Google',           bg: '#cc3a21', fg: '#ffffff' },
  { name: 'Services/ERP',              bg: '#149e60', fg: '#ffffff' },

  // --- Finance (no color = Gmail default) ---
  { name: 'Finance' },
  { name: 'Finance/Invoices' },
  { name: 'Finance/Payments' },
  { name: 'Finance/Bank' },
];

// ─── Filter definitions ───────────────────────────────────────────────────────
// Each entry maps a Gmail filter criteria to one or more label names.
// addLabel: label name(s) to apply. markRead: auto-mark-read. skipInbox: archive.
const FILTER_DEFS = [
  // --- Custom domain routing (Cloudflare email routing sends to this Gmail) ---
  { to: 'nitesh@linearventures.in',  labels: ['LinearVentures/nitesh'] },
  { to: 'info@linearventures.in',    labels: ['LinearVentures/info'] },
  { to: 'accounts@linearventures.in',labels: ['LinearVentures/accounts'] },
  { to: 'export@linearventures.in',  labels: ['LinearVentures/export'] },

  { to: 'nitesh@nanoliss.com',       labels: ['Nanoliss/nitesh'] },
  { to: 'hello@nanoliss.com',        labels: ['Nanoliss/hello'] },
  { to: 'refunds@nanoliss.com',      labels: ['Nanoliss/refunds'] },
  { to: 'marketing@nanoliss.com',    labels: ['Nanoliss/marketing'] },
  { to: 'support@nanoliss.com',      labels: ['Nanoliss/support'] },

  // --- Service senders ---
  { from: 'vercel.com',              labels: ['Services/Vercel'],    markRead: false, skipInbox: true },
  { from: 'cloudflare.com',          labels: ['Services/Cloudflare'],markRead: false, skipInbox: true },
  { from: 'facebookmail.com',        labels: ['Services/Meta'] },
  { from: 'meta.com',                labels: ['Services/Meta'] },
  { from: 'razorpay.com',            labels: ['Services/Razorpay'] },
  { from: 'gst.gov.in',              labels: ['Services/GST-Tax'] },
  { from: 'icegate.gov.in',          labels: ['Services/GST-Tax'] },
  { from: 'google.com',              labels: ['Services/Google'],    markRead: false, skipInbox: true },
  { from: 'noreply@google.com',      labels: ['Services/Google'],    markRead: true,  skipInbox: true },
  { from: 'search.google.com',       labels: ['Services/Google'],    markRead: false, skipInbox: true },
  { from: 'delhivery.com',           labels: ['Services/Shipping'] },
  { from: 'bluedart.com',            labels: ['Services/Shipping'] },
  { from: 'shiprocket.com',          labels: ['Services/Shipping'] },
  { from: 'dtdc.com',                labels: ['Services/Shipping'] },
  { from: 'ecomexpress.in',          labels: ['Services/Shipping'] },

  // --- Finance keywords ---
  { subject: 'invoice',              labels: ['Finance/Invoices'] },
  { subject: 'tax invoice',          labels: ['Finance/Invoices'] },
  { from: 'noreply@hdfcbank.com',    labels: ['Finance/Bank'],       markRead: false },
  { from: 'alerts@axisbank.com',     labels: ['Finance/Bank'],       markRead: false },
];

// ─── Send As aliases ──────────────────────────────────────────────────────────
// These require the alias email to be a real address that can receive a
// verification email. Gmail will send a verification code — you confirm it once.
const SEND_AS_ALIASES = [
  { sendAsEmail: 'nitesh@linearventures.in', displayName: 'Nitesh | Linear Ventures', replyToAddress: 'nitesh@linearventures.in' },
  { sendAsEmail: 'hello@nanoliss.com',        displayName: 'Nanoliss',                 replyToAddress: 'hello@nanoliss.com' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function ensureLabels(gmail) {
  const res = await gmail.users.labels.list({ userId: 'me' });
  const existing = new Map(res.data.labels.map(l => [l.name, l.id]));

  const created = new Map(existing);
  for (const def of LABEL_DEFS) {
    if (existing.has(def.name)) {
      console.log(`  [exists] ${def.name}`);
      continue;
    }
    const body = { name: def.name, labelListVisibility: 'labelShow', messageListVisibility: 'show' };
    if (def.bg) body.color = { backgroundColor: def.bg, textColor: def.fg };
    const r = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        ...body,
      },
    });
    created.set(def.name, r.data.id);
    console.log(`  [created] ${def.name}`);
  }
  return created;
}

async function ensureFilters(gmail, labelMap) {
  const existing = await gmail.users.settings.filters.list({ userId: 'me' });
  const existingFilters = existing.data.filter || [];

  for (const def of FILTER_DEFS) {
    const criteria = {};
    if (def.to)      criteria.to      = def.to;
    if (def.from)    criteria.from    = def.from;
    if (def.subject) criteria.subject = def.subject;

    // Skip if an identical to/from/subject filter already exists
    const alreadyExists = existingFilters.some(f =>
      f.criteria?.to === criteria.to &&
      f.criteria?.from === criteria.from &&
      f.criteria?.subject === criteria.subject
    );
    if (alreadyExists) {
      console.log(`  [exists] filter for ${JSON.stringify(criteria)}`);
      continue;
    }

    const addLabelIds = def.labels
      .map(name => labelMap.get(name))
      .filter(Boolean);

    const action = { addLabelIds };
    if (def.markRead)  action.removeLabelIds = ['UNREAD'];
    if (def.skipInbox) {
      action.removeLabelIds = [...(action.removeLabelIds || []), 'INBOX'];
    }

    await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: { criteria, action },
    });
    console.log(`  [created] filter → ${def.labels.join(', ')} for ${JSON.stringify(criteria)}`);
  }
}

async function ensureSendAs(gmail) {
  const res = await gmail.users.settings.sendAs.list({ userId: 'me' });
  const existing = new Set(res.data.sendAs.map(s => s.sendAsEmail));

  for (const alias of SEND_AS_ALIASES) {
    if (existing.has(alias.sendAsEmail)) {
      console.log(`  [exists] sendAs ${alias.sendAsEmail}`);
      continue;
    }
    try {
      await gmail.users.settings.sendAs.create({
        userId: 'me',
        requestBody: alias,
      });
      console.log(`  [created] sendAs ${alias.sendAsEmail} — CHECK EMAIL for verification link!`);
    } catch (e) {
      console.warn(`  [warn] sendAs ${alias.sendAsEmail}: ${e.message}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const auth = await getAuth();
const gmail = google.gmail({ version: 'v1', auth });

console.log('\n=== 1. Labels ===');
const labelMap = await ensureLabels(gmail);

console.log('\n=== 2. Filters ===');
await ensureFilters(gmail, labelMap);

console.log('\n=== 3. Send As Aliases ===');
await ensureSendAs(gmail);

console.log('\n✓ Setup complete. Run `node audit.js` to label existing inbox mail.');
