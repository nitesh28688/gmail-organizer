import { google } from 'googleapis';
import { getAuth } from './auth.js';

const auth = await getAuth();
const gmail = google.gmail({ version: 'v1', auth });

// Create LinearVentures/ERP label
const r = await gmail.users.labels.create({
  userId: 'me',
  requestBody: {
    name: 'LinearVentures/ERP',
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
    color: { backgroundColor: '#8e63ce', textColor: '#ffffff' },
  },
});
const labelId = r.data.id;
console.log('Created label:', r.data.name, labelId);

// Now scan all mail and apply to ERP-related messages
// Match emails from Resend (ERP transactional sender) or @nanoliss.com ERP addresses
const erpFromPatterns = ['resend.com', 'invoices@nanoliss.com', 'resend.dev'];

let pageToken;
let matched = [];
let total = 0;

do {
  const res = await gmail.users.messages.list({ userId: 'me', maxResults: 500, pageToken, q: 'in:all' });
  const messages = res.data.messages || [];
  if (!messages.length) break;

  const CHUNK = 10;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const detailed = await Promise.all(
      chunk.map(m => gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Delivered-To'] }))
    );
    for (const msg of detailed) {
      const headers = {};
      for (const h of msg.data.payload?.headers || []) headers[h.name.toLowerCase()] = h.value.toLowerCase();
      const from = headers.from || '';
      if (erpFromPatterns.some(p => from.includes(p))) {
        matched.push(msg.data.id);
      }
      total++;
    }
  }
  pageToken = res.data.nextPageToken;
} while (pageToken);

console.log(`Scanned ${total} emails, found ${matched.length} ERP-related.`);

if (matched.length > 0) {
  for (let i = 0; i < matched.length; i += 1000) {
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: { ids: matched.slice(i, i + 1000), addLabelIds: [labelId] },
    });
  }
  console.log(`✓ Applied LinearVentures/ERP label to ${matched.length} emails.`);
} else {
  console.log('No matching emails found. Label created — filters will catch future mail.');
}
