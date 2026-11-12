import { google } from 'googleapis';
import { getAuthSohini } from './auth-sohini.js';

const auth = await getAuthSohini();
const gmail = google.gmail({ version: 'v1', auth });
const L = await gmail.users.labels.list({ userId: 'me' });
const names = L.data.labels.map((l) => l.name);
const sohini = names.filter((n) => n.startsWith('Sohini/'));
console.log(`Sohini labels (${sohini.length}): ${sohini.join(', ')}`);
const F = await gmail.users.settings.filters.list({ userId: 'me' });
const all = F.data.filter || [];
const nameOf = (id) => names.find((n) => n === (L.data.labels.find((l) => l.id === id) || {}).name);
const mine = all.filter(
  (f) =>
    JSON.stringify(f.criteria).includes('sohinirohra') ||
    (f.action?.addLabelIds || []).some((id) => sohini.includes((L.data.labels.find((l) => l.id === id) || {}).name)),
);
console.log(`total filters: ${all.length} · sohini-scoped: ${mine.length}`);
for (const f of mine) {
  const lbl = (f.action.addLabelIds || []).map(nameOf).join(',');
  const crit = f.criteria.from || f.criteria.to;
  console.log(`   ${String(crit).slice(0, 70)} → ${lbl} ${f.action.removeLabelIds?.includes('INBOX') ? '[archives]' : ''}`);
}
const S = await gmail.users.settings.sendAs.list({ userId: 'me' });
console.log('send-as:', S.data.sendAs.map((s) => `${s.sendAsEmail}:${s.isPrimary ? 'primary' : s.isDefault ? 'default' : 'verified=' + s.verificationStatus}`).join(' | '));