/**
 * add-route.js — creates a new Gmail label + filter for suite@linearventures.in
 * The Cloudflare routing rule must be added manually in Cloudflare dashboard.
 */
import { google } from 'googleapis';
import { getAuth } from './auth.js';

const auth = await getAuth();
const gmail = google.gmail({ version: 'v1', auth });

// 1. Create label LinearVentures/suite
const labelsRes = await gmail.users.labels.list({ userId: 'me' });
const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));

let labelId;
if (labelMap.has('LinearVentures/suite')) {
  labelId = labelMap.get('LinearVentures/suite');
  console.log('[exists] LinearVentures/suite:', labelId);
} else {
  const r = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: 'LinearVentures/suite',
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      color: { backgroundColor: '#8e63ce', textColor: '#ffffff' },
    },
  });
  labelId = r.data.id;
  console.log('[created] LinearVentures/suite:', labelId);
}

// 2. Create filter: to:suite@linearventures.in → label
await gmail.users.settings.filters.create({
  userId: 'me',
  requestBody: {
    criteria: { to: 'suite@linearventures.in' },
    action: { addLabelIds: [labelId] },
  },
});
console.log('[created] filter: to:suite@linearventures.in → LinearVentures/suite');

console.log('\n✓ Done. Now add the Cloudflare routing rule manually (see instructions below).');
console.log('Cloudflare → linearventures.in → Email → Email Routing → Routing rules → Create address');
console.log('  Address: suite');
console.log('  Action: Send to email');
console.log('  Destination: nanoliss.in@gmail.com');
