# Existing Render service: preserve live CRM data before deploying

The app currently uses `server/db.json` unless `DB_PATH` is set. That path is
inside the Git checkout. On Render's default ephemeral filesystem, runtime
employee creation and password changes disappear on restart or redeploy.
Reference: https://render.com/docs/disks

Use the existing service, not a new service with a different name. Before any
deploy or disk attachment, download a verified copy of the **live** `DB_PATH`
(default: `/opt/render/project/src/server/db.json`) from the existing service.
The local repository database is not a substitute for the live backup.
The backup contains private staff/payroll data and password hashes; keep it out
of Git and public directories. Preserve `JWT_SECRET` in Render Environment.

1. Verify the downloaded JSON has the current staff and record counts.
2. Attach a persistent disk at `/var/data` on that existing service. Render may
   require a paid service plan; confirm the charge before changing the plan.
3. Restore the verified live backup to `/var/data/crm/db.json`. The included
   command refuses to overwrite an existing database:
   `node server/migrate-db.mjs /path/to/verified-live-backup.json /var/data/crm/db.json`
4. Set `DB_PATH=/var/data/crm/db.json` and retain the existing `JWT_SECRET`.
5. Deploy the tested commit, verify `/api/health`, sign in normally, and check
   staff and payroll counts. Restart once and verify they remain unchanged.

If `DB_PATH` points to a missing file on Render, startup now refuses to silently
create a replacement demo database. An explicit `DB_SEED_PATH` can import a
verified uploaded backup exactly once, only if the destination does not exist.
Remove that variable after the first successful import.

Local verification: `npm test`, `npm run test:workflow`, `npm run test:load`,
`npm run build`. The workflow and load checks use isolated temporary databases.
