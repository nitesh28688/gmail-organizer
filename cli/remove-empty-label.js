import { google } from 'googleapis';
import { getAuthTCS } from './auth-tcs.js';

const auth = await getAuthTCS();
const gmail = google.gmail({ version: 'v1', auth });

const labelName = 'TCS/Shopping-Promo';

async function main() {
  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const label = labelsRes.data.labels.find(l => l.name === labelName);
  if (!label) {
    console.log('Label not found:', labelName);
    return;
  }

  const filtersRes = await gmail.users.settings.filters.list({ userId: 'me' });
  const filters = filtersRes.data.filter || [];
  for (const f of filters) {
    if ((f.action?.addLabelIds || []).includes(label.id)) {
      console.log('Deleting filter:', f.id, f.criteria?.query);
      await gmail.users.settings.filters.delete({ userId: 'me', id: f.id });
    }
  }

  console.log('Deleting label:', labelName);
  await gmail.users.labels.delete({ userId: 'me', id: label.id });

  console.log('\n[✓] Removed', labelName);
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
