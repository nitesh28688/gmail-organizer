import { google } from 'googleapis';
import { getAuth } from './auth.js';

const auth = await getAuth();
const gmail = google.gmail({ version: 'v1', auth });

// 1. Create label LinearVentures/support
const labelsRes = await gmail.users.labels.list({ userId: 'me' });
const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));

let labelId;
if (labelMap.has('LinearVentures/support')) {
  labelId = labelMap.get('LinearVentures/support');
  console.log('[exists] LinearVentures/support:', labelId);
} else {
  const r = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: 'LinearVentures/support',
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      color: { backgroundColor: '#e66550', textColor: '#ffffff' },
    },
  });
  labelId = r.data.id;
  console.log('[created] LinearVentures/support:', labelId);
}

// 2. Create Gmail filter
await gmail.users.settings.filters.create({
  userId: 'me',
  requestBody: {
    criteria: { to: 'support@linearventures.in' },
    action: { addLabelIds: [labelId] },
  },
});
console.log('[created] filter: to:support@linearventures.in → LinearVentures/support');
