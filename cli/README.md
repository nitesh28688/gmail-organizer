> Moved into this repo as `cli/` on 2026-11-13 (was the sibling `gmail-organizer` folder). All commands below still run from inside this folder: `cd cli` first. OAuth secrets here (`credentials.json`, `token*.json`) are git-ignored.

# Gmail Organizer — nanoliss.in@gmail.com

## One-time setup

### Step 1 — Google Cloud credentials

1. Go to https://console.cloud.google.com/
2. Create a project (or pick an existing one)
3. **APIs & Services → Enable APIs** → enable **Gmail API**
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Desktop app**
   - Name: Gmail Organizer
5. Download the JSON → save as **`credentials.json`** in this folder
6. **OAuth consent screen** → add `nanoliss.in@gmail.com` as a test user

### Step 2 — Authorize

```
npm install
node auth.js
```

Browser opens → sign in as nanoliss.in@gmail.com → approve → `token.json` saved.

### Step 3 — Create labels + filters + Send As aliases

```
node setup.js
```

- Creates all labels (skips existing ones)
- Creates all filters (skips existing ones)
- Adds Send As aliases for `nitesh@linearventures.in` and `hello@nanoliss.com`
  - Gmail will send a **verification email** to each alias — click the link to confirm

### Step 4 — Audit existing inbox

Dry run first (no changes, just shows counts):
```
node audit.js --dry-run
```

Then apply:
```
node audit.js
```

Scans all mail and applies the same label rules retroactively.
Large inboxes (10k+ emails) take 3–10 minutes due to API rate limits.

---

## Labels created

| Label | Purpose |
|-------|---------|
| `LinearVentures/*` | Mail to any @linearventures.in address |
| `Nanoliss/*` | Mail to any @nanoliss.com address |
| `Services/Vercel` | Deployment alerts |
| `Services/Cloudflare` | DNS / Pages / domain |
| `Services/Meta` | Facebook Ads / Business Manager |
| `Services/Razorpay` | Payments |
| `Services/GST-Tax` | Government / tax portals |
| `Services/Shipping` | Delhivery, Shiprocket, etc. |
| `Services/Google` | Search Console, Workspace |
| `Services/ERP` | Internal ERP notifications |
| `Finance/Invoices` | Vendor invoices |
| `Finance/Payments` | Payment confirmations |
| `Finance/Bank` | HDFC, Axis alerts |

## Send As aliases

After `node setup.js`, verify both aliases in Gmail:
- Settings → Accounts → Send mail as → verify `nitesh@linearventures.in`
- Settings → Accounts → Send mail as → verify `hello@nanoliss.com`

---

## Sohini Rohra — sohinirohra1@gmail.com (labels + filters, TCS pattern)

Send-as aliases (`info@`, `appointments@`, `sohini@`, `press@` @sohinirohra.com)
were added + verified manually — the Gmail API rejects `sendAs.create` for
non-Workspace accounts, same as TCS. Only labels + filters go through the API.

| Script | Purpose |
|---|---|
| `auth-sohini.js` | One-time OAuth as sohinirohra1@gmail.com → saves `token-sohini.json` (reuses `credentials.json` Desktop client, no new GCP project) |
| `setup-sohini-email.js` | Creates labels `Sohini/info`, `Sohini/appointments`, `Sohini/sohini`, `Sohini/press` + one `to:` filter per address (palette-safe colors, same set as TCS) |

Resume (blocked on her sign-in as of 2026-10-02):
```
node auth-sohini.js
node setup-sohini-email.js
```

✅ DONE 2026-10-02 — OAuth completed as her, all 4 labels + 4 filters created
(`Label_1`–`Label_4`). `token-sohini.json` is local-only, never committed.

✅ DONE 2026-10-02 — 11 category labels + 11 From-domain filters created
(`setup-sohini-categories.js`): LinkedIn, Newsletters, Spotify, Travel,
Shopping, Zoom, Google, Cloudflare, AI-Tools, Personal, Misc.
Filters archive category mail out of the inbox (`setup-sohini-archive-filters.js`);
`retro-sohini.js` backfilled the backlog (3,043 mails labeled, 2,821 archived).

---

## Manish Mulchandani — mulchandani.manish@gmail.com

| Script | Purpose |
|---|---|
| `auth-manish.js` | One-time OAuth as `mulchandani.manish@gmail.com` → saves `token-manish.json` |
| `audit-manish.js` | Read-only scan of inbox senders, message volumes, and label distribution |
| `setup-manish-categories.js` | Creates labels (`Real-Estate`, `Newsletters`, `Travel`, `Jobs-HR`, `Finance`, `Services`, `Education-IIMA`) + automated incoming filters |
| `retro-manish.js` | Backfills existing backlog (`--dry-run` supported) |
| `protect-manish-vip.js` | Dedicated script creating protected labels & filters for `Legal/Litigation-Trademarks` (Hennex, UA Overseas, Madamser & Co, Shailen Bhatia), `Business/D-VA`, `Business/Anamika-Trading`, `Business/MM-Consumer` |
| `trash-options-a-and-b.js` | Moves Marriott Bonvoy blasts, LUB newsletters, CRIF, and dead mailing lists >1y to Trash |
| `archive-manish-historical-backlog.js` | Sweeps historical backlog >1y out of Inbox into All Mail with zero deletion |

✅ ACCOMPLISHED & VERIFIED:
- **Inbox Cleanup**: Reduced `INBOX` from **51,107** to **8,824** messages!
- **Total Account Messages**: Dropped from **67,796** to **25,344** (over 42,000 junk/staged emails purged).
- **Options A & B (Bulk Brand & Mailing Lists Cleanup)**: 3,450 emails moved to Trash.
- **Option C (Historical Backlog Archival Sweep)**: 10,603 historical emails (>1y) archived safely into "All Mail". Residual non-VIP backlog in Inbox is now **0**.
- **Current Inbox Makeup (8,824 total)**:
  - **3,680** Active current-year emails (2025–2026).
  - **5,144** Historical protected records (D-VA / DVA Care bank facilities, Hennex litigation, UA Overseas, Madamser & Co, Shailen Bhatia, Anamika Trading, MM Consumer, IIMA, and Starred).

🛡️ PROTECTED & LABELED — **8,485+ core business/legal emails**:
- `Legal/Litigation-Trademarks`: 1,623 emails (Hennex India, UA Overseas, Madamser & Co, Shailen Bhatia)
- `Business/D-VA`: 4,728 emails (includes D-VA, DVA Care credit facilities, Real Henna / realheena68@gmail.com, and Brahm Art Packers / brahmart.design@gmail.com)
- `Business/Anamika-Trading`: 684 emails
- `Business/MM-Consumer`: 1,450 emails
- `Education-IIMA`: Retained & protected

