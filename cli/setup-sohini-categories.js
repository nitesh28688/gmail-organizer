import { google } from 'googleapis';
import { getAuthSohini } from './auth-sohini.js';

// Label palette — Gmail API only accepts these exact colors.
const colors = {
  LinkedIn: { backgroundColor: '#4a86e8', textColor: '#ffffff' },
  Newsletters: { backgroundColor: '#fad165', textColor: '#000000' },
  Spotify: { backgroundColor: '#16a765', textColor: '#ffffff' },
  Travel: { backgroundColor: '#e66550', textColor: '#ffffff' },
  Shopping: { backgroundColor: '#a479e2', textColor: '#ffffff' },
  Zoom: { backgroundColor: '#cccccc', textColor: '#000000' },
  Google: { backgroundColor: '#4a86e8', textColor: '#ffffff' },
  Cloudflare: { backgroundColor: '#fad165', textColor: '#000000' },
  'AI-Tools': { backgroundColor: '#a479e2', textColor: '#ffffff' },
  Personal: { backgroundColor: '#16a765', textColor: '#ffffff' },
  Misc: { backgroundColor: '#cccccc', textColor: '#000000' },
};

// Each entry: label name → array of From-domain matches
const rules = {
  'Sohini/LinkedIn': ['linkedin.com'],
  'Sohini/Newsletters': ['mail.beehiiv.com', 'insider.theloom.in', 'brut.media', 'raptormediastudio.com', 'riseworldwide.in', 'maashha.com', 'ecommercedoctor.in'],
  'Sohini/Spotify': ['spotify.com', 'alerts.spotify.com'],
  'Sohini/Travel': ['mp1.tripadvisor.com', 't1.tripadvisor.com', 'tdacservices.immigration.go.th'],
  'Sohini/Shopping': ['email.hm.com', 'hm.com', 'info.bookmyshow.com', 'feature.bookmyshow.com', 'mail.bookmyshow.com'],
  'Sohini/Zoom': ['zoom.us'],
  'Sohini/Google': ['google.com', 'xwf.google.com', 'ads.google.com', 'youtube.com'],
  'Sohini/Cloudflare': ['notify.cloudflare.com', 'em1.cloudflare.com'],
  'Sohini/AI-Tools': ['fathom.video', 'content.prezi.com', 'gamma.app', 'email.anthropic.com', 'mail.anthropic.com'],
  'Sohini/Personal': ['gmail.com'],
  'Sohini/Misc': ['astrojudge.com', 'rightselection.com', 'e.godaddy.com', 'discover.pinterest.com', 'notifications.pinterest.com'],
};

async function main() {
  const auth = await getAuthSohini();
  const gmail = google.gmail({ version: 'v1', auth });

  // 1. Create labels
  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map(labelsRes.data.labels.map((l) => [l.name, l.id]));

  for (const [name, color] of Object.entries(colors)) {
    const fullName = `Sohini/${name}`;
    if (labelMap.has(fullName)) {
      console.log(`[label] exists: ${fullName}`);
      continue;
    }
    const res = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: fullName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        color,
      },
    });
    labelMap.set(fullName, res.data.id);
    console.log(`[label] created: ${fullName}`);
  }

  // 2. Create filters
  const filtersRes = await gmail.users.settings.filters.list({ userId: 'me' });
  const existing = new Set((filtersRes.data.filter || []).map((f) => f.criteria?.from).filter(Boolean));

  for (const [labelName, domains] of Object.entries(rules)) {
    const labelId = labelMap.get(labelName);
    if (!labelId) {
      console.error(`[filter] MISSING LABEL: ${labelName}`);
      continue;
    }
    const fromQuery = domains.map((d) => `from:${d}`).join(' OR ');
    if (existing.has(fromQuery)) {
      console.log(`[filter] exists: ${labelName}`);
      continue;
    }
    await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: { from: fromQuery },
        action: { addLabelIds: [labelId] },
      },
    });
    console.log(`[filter] created: ${labelName} ← ${domains.join(', ')}`);
  }

  console.log('\n[✓] All labels + filters created.');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
