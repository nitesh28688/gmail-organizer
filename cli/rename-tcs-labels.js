import { google } from 'googleapis';
import { getAuthTCS } from './auth-tcs.js';

const auth = await getAuthTCS();
const gmail = google.gmail({ version: 'v1', auth });

const renames = [
  ['TCS/Junk-Promotions', 'TCS/Promotions'],
  ['TCS/Junk-Newsletters', 'TCS/Newsletters'],
  ['TCS/Junk-Notifications', 'TCS/Notifications'],
  ['TCS/Junk-Social', 'TCS/Social'],
  ['TCS/Junk-Shopping-Promo', 'TCS/Shopping-Promo'],
];

async function main() {
  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map(labelsRes.data.labels.map(l => [l.name, l.id]));

  for (const [oldName, newName] of renames) {
    const labelId = labelMap.get(oldName);
    if (!labelId) {
      console.log('Not found, skipping:', oldName);
      continue;
    }
    await gmail.users.labels.patch({
      userId: 'me',
      id: labelId,
      requestBody: { name: newName },
    });
    console.log(`Renamed: ${oldName} -> ${newName}`);
  }

  console.log('\n[✓] Rename complete!');
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
