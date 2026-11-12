import { google } from 'googleapis';
import { getAuthTCS } from './auth-tcs.js';

const auth = await getAuthTCS();
const gmail = google.gmail({ version: 'v1', auth });

const labelNames = [
  'TCS/Payments',
  'TCS/Shipping',
  'TCS/Marketing',
  'TCS/Website-Hosting',
  'TCS/Finance',
  'TCS/Social',
  'TCS/Google-Workspace',
];

async function main() {
  console.log('=== Reverting category labels/filters ===\n');

  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));

  const filtersRes = await gmail.users.settings.filters.list({ userId: 'me' });
  const filters = filtersRes.data.filter || [];

  // Delete filters whose addLabelIds match one of our category label IDs
  const targetLabelIds = new Set(labelNames.map(n => labelMap.get(n)).filter(Boolean));

  for (const f of filters) {
    const addsTargetLabel = (f.action?.addLabelIds || []).some(id => targetLabelIds.has(id));
    if (addsTargetLabel) {
      console.log('Deleting filter:', f.id, f.criteria?.query);
      await gmail.users.settings.filters.delete({ userId: 'me', id: f.id });
    }
  }

  // Delete labels
  for (const name of labelNames) {
    const labelId = labelMap.get(name);
    if (!labelId) {
      console.log('Label not found (already gone):', name);
      continue;
    }
    console.log('Deleting label:', name);
    await gmail.users.labels.delete({ userId: 'me', id: labelId });
  }

  console.log('\n[✓] Revert complete!');
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
