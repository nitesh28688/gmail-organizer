import { google } from 'googleapis';
import { getAuth } from './auth.js';

const auth = await getAuth();
const gmail = google.gmail({ version: 'v1', auth });

const labelsRes = await gmail.users.labels.list({ userId: 'me' });
const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));
const erpLabelId = labelMap.get('LinearVentures/ERP');

const filters = [
  { from: 'resend.com' },
  { from: 'resend.dev' },
  { from: 'invoices@nanoliss.com' },
];

for (const f of filters) {
  await gmail.users.settings.filters.create({
    userId: 'me',
    requestBody: {
      criteria: { from: f.from },
      action: { addLabelIds: [erpLabelId] },
    },
  });
  console.log(`✓ Filter created: from:${f.from} → LinearVentures/ERP`);
}
