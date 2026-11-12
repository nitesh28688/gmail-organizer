import { google } from 'googleapis';
import { getAuthSohini } from './auth-sohini.js';

// Update category filters to ALSO archive (remove from inbox).
// Personal + alias labels stay in the inbox — those need her attention.

const CATEGORIES = {
  'Sohini/LinkedIn': ['linkedin.com'],
  'Sohini/Newsletters': ['mail.beehiiv.com', 'insider.theloom.in', 'brut.media', 'raptormediastudio.com', 'riseworldwide.in', 'maashha.com', 'ecommercedoctor.in'],
  'Sohini/Spotify': ['spotify.com', 'alerts.spotify.com'],
  'Sohini/Travel': ['mp1.tripadvisor.com', 't1.tripadvisor.com', 'tdacservices.immigration.go.th'],
  'Sohini/Shopping': ['email.hm.com', 'hm.com', 'info.bookmyshow.com', 'feature.bookmyshow.com', 'mail.bookmyshow.com'],
  'Sohini/Zoom': ['zoom.us'],
  'Sohini/Google': ['google.com', 'xwf.google.com', 'ads.google.com', 'youtube.com'],
  'Sohini/Cloudflare': ['notify.cloudflare.com', 'em1.cloudflare.com'],
  'Sohini/AI-Tools': ['fathom.video', 'content.prezi.com', 'gamma.app', 'email.anthropic.com', 'mail.anthropic.com'],
  'Sohini/Misc': ['astrojudge.com', 'rightselection.com', 'e.godaddy.com', 'discover.pinterest.com', 'notifications.pinterest.com'],
};

async function main() {
  const auth = await getAuthSohini();
  const gmail = google.gmail({ version: 'v1', auth });

  // Get label IDs
  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const labelMap = new Map(labelsRes.data.labels.map((l) => [l.name, l.id]));

  // Get existing filters
  const filtersRes = await gmail.users.settings.filters.list({ userId: 'me' });
  const existingFilters = filtersRes.data.filter || [];

  for (const [labelName, domains] of Object.entries(CATEGORIES)) {
    const labelId = labelMap.get(labelName);
    if (!labelId) {
      console.error(`MISSING LABEL: ${labelName}`);
      continue;
    }
    const fromQuery = domains.map((d) => `from:${d}`).join(' OR ');

    // Find and delete existing filter for this label
    const old = existingFilters.find((f) => f.criteria?.from === fromQuery);
    if (old) {
      await gmail.users.settings.filters.delete({ userId: 'me', id: old.id });
      console.log(`[deleted] old filter for ${labelName}`);
    }

    // Create new filter: label + archive (remove from inbox)
    await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: { from: fromQuery },
        action: {
          addLabelIds: [labelId],
          removeLabelIds: ['INBOX'],
        },
      },
    });
    console.log(`[created] ${labelName} → label + archive`);
  }

  console.log('\n[✓] All category filters now archive mail out of the inbox.');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
