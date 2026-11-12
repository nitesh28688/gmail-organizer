import { google } from 'googleapis';
import { getAuth } from './auth.js';

const auth = await getAuth();
const gmail = google.gmail({ version: 'v1', auth });

// Search everywhere including spam/trash, last 7 days
const res = await gmail.users.messages.list({
  userId: 'me',
  q: 'subject:confirm in:anywhere newer_than:7d',
  maxResults: 20,
});

if (!res.data.messages?.length) {
  console.log('No confirmation emails found.');
  process.exit();
}

for (const m of res.data.messages) {
  const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date', 'To', 'Delivered-To'] });
  const h = {};
  for (const hdr of msg.data.payload.headers) h[hdr.name] = hdr.value;
  console.log(`ID: ${m.id}\nFrom: ${h.From}\nTo: ${h.To || h['Delivered-To']}\nSubject: ${h.Subject}\nDate: ${h.Date}\n---`);
}
