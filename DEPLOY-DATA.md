# Production data & backups (Render + Upstash)

Production storage is Upstash Redis (REST API), not a Render disk. Set on the
Render service's Environment tab:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

`server/index.js` picks the Upstash adapter automatically whenever both
variables are present, and skips `prepareDatabase()`'s filesystem-only checks
(`server/storage.js`) in that case. Confirm which backend is actually active
via `/api/health` — it reports `storage: "upstash"` or `"file"`, plus
`upstashHost` when applicable. Trust this over assumptions; a service can look
fine and still be silently falling back to the ephemeral local file if an
env var is missing or misnamed.

## Backing up

The boss can download a full, restorable backup (including password hashes)
from the app itself: Overview page → "Zaxira nusxa olish", or directly via
`GET /api/backup` with a boss token. Do this periodically and keep the file
private — it is not encrypted, and it contains real credentials (as scrypt
hashes, not plaintext) and payroll data.

## If the boss is locked out

Nobody above the boss can reset their password through the app itself. Run,
against whichever storage is currently active:
```bash
node server/reset-boss-password.mjs <new-password>
```
It reads `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` from the
environment if set, otherwise falls back to `DB_PATH` (or the local file).
Bumps `authVersion`, so this also invalidates any existing sessions/tokens.

## Restoring from a backup

Write the verified backup JSON directly to the `crm:db` key in the target
Upstash database (or to the target file, if using file storage). There is no
dedicated import script for Upstash yet; `server/migrate-db.mjs` only covers
the file-storage path (see below).

## Alternative: a paid Render disk instead of Upstash

If you'd rather pay for storage than depend on a third-party free tier:

1. Attach a persistent disk at `/var/data` on the Render service (requires a
   paid instance type — confirm the charge before changing the plan).
2. Set `DB_PATH=/var/data/crm/db.json`, and do **not** set the `UPSTASH_*`
   variables (their presence takes priority).
3. On first boot with an empty disk, the server bootstraps a fresh database
   and prints a one-time boss password to the logs — capture it immediately,
   it is never shown again.
4. To restore an existing backup instead of bootstrapping fresh, place it at
   that path before the first boot, or use `DB_SEED_PATH` pointing to a
   verified backup file (imported exactly once, only if the destination does
   not already exist):
   `node server/migrate-db.mjs /path/to/verified-backup.json /var/data/crm/db.json`
5. If `DB_PATH` is set but the file is missing on a Render instance
   (`RENDER` env var also set), startup refuses to silently create a
   replacement database rather than bootstrapping over lost data.

## Verifying a deploy

`/api/health` reports `release` (the deployed commit hash) and `storage`.
After any deploy, confirm both match what you expect — a stale `release`
usually means auto-deploy didn't fire and a manual deploy is needed; check the
service's Deploys/Events tab.

Local verification: `npm test`, `npm run test:workflow`, `npm run test:load`,
`npm run build`. The workflow and load checks use isolated temporary databases.
