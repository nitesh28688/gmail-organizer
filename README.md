# Linear Mail (gmail-organizer-web)

Multi-account Gmail organizer for the Linear Ventures mailboxes (nanoliss,
TCS, sohini, manish). Two halves:

- **The web app** (this repo root): Next.js 16 + Prisma + next-auth. Sign in
  with a Google account, audit the inbox against preset rules, apply
  labels/filters, renew Gmail `watch` subscriptions per account (cron), and
  browse mail with sent-folder auto-refresh.
- **`cli/`** — the original Node CLI toolkit (moved in from the sibling
  `gmail-organizer` folder on 2026-11-13): per-account OAuth bootstrap
  (`auth*.js`), `setup.js` (labels/filters/send-as aliases), audit and
  bulk-organize scripts. Run from inside `cli/`: `npm install`, then
  `node auth.js`, `node setup.js`, `node audit.js --dry-run`. Its README
  documents the full flow.

## Secrets

Never committed, all git-ignored: `.env`/`.env.local` (root, app), and in
`cli/`: `credentials.json` + `token*.json` (per-account OAuth tokens).

## Dev

```bash
npm install        # runs prisma generate
npm run dev        # build script also runs prisma db push
```
