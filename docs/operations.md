# Operations

## Before deployment

1. Supply a dedicated Neon PostgreSQL database connection in the server environment, using TLS (`sslmode=require`). Do not put any database or JWT secret in a `VITE_*` variable. Use restricted database credentials and protect access to the trusted account maintenance script.
2. Back up existing data before applying migrations. Use the database provider's supported backup/snapshot workflow or `pg_dump --format=custom --file=backup.dump` with connection credentials supplied through PostgreSQL environment variables or a protected password file. Store backups outside the repository and verify restoration into a separate database.
3. Install from the lockfile, generate the Prisma client and run `prisma migrate deploy`. This project includes a fresh initial migration; if the target already has tables, inspect and baseline the existing database before applying it. Never use `migrate reset` on institutional data.
4. Seed the real venue catalog, provision authorized accounts, and verify each venue's actual capacity and opening hours before enabling requests. Assign active approvers. Image source links were preserved but not access-checked or converted into invented download URLs.
5. Build `client/dist`. Serve it over HTTPS with an SPA fallback to `index.html` and proxy `/api/v1` to Express. Configure `CLIENT_ORIGIN` to the exact HTTPS site origin. Backend listens on loopback port 4000, suitable for a reverse proxy on the same host.
6. Leave `TRUST_PROXY=0` unless exactly one trusted proxy overwrites the forwarded request headers. Only then use `TRUST_PROXY=1`. This affects client-IP rate limiting and HTTPS detection.
7. Run the unit, integration, browser and database load checks against disposable databases, then repeat the institution's acceptance workflow against the deployment. Health is `GET /api/v1/health` and checks database connectivity without exposing configuration.

## Routine maintenance

- Use `npm run account:provision -w server` in a trusted environment for account creation, deactivation, role changes or password reset. Updating an account increments its token version, revoking existing sessions. Keep provisioning environment variables out of shell transcripts and logs; clear `ACCOUNT_PASSWORD` after use.
- Venue and approver assignment changes are audited in `AuditEvent`. Booking submission, approval, rejection and cancellation are recorded in `BookingAction` with the actor. The app never logs tokens, passwords or private event payloads.
- A pending hold has no automatic expiry. A requester must cancel eligible bookings before a venue can be disabled if future/ongoing reservations exist. Administrators have no override or booking decision power.
- The maintained catalog fixture is insert-only when seeded. To rebuild it after an authorized source workbook update, install Python `openpyxl` and run `python server/scripts/import-venues.py`. Review the fixture diff; explicit administrative edits are required to update existing imported records.
- Login limiting is an in-memory, single-process limiter. Deploy one API process for this MVP. Horizontal scaling requires a shared limiter and a review of proxy configuration before exposing multiple instances.
- Review dependency audit results and lockfile updates. The root overrides pin patched `deepmerge-ts` and `effect` versions used by Prisma tooling; rerun Prisma validation/generation/migration checks after changing them.

## Recovery

Stop writes before restoring a backup to a separate database. Validate its migrations, account access, assignment scope, UTC occurrence times and action history. Only switch the application's database connection after those checks pass. Rotate credentials/JWT secret if credentials were exposed; rotating the JWT secret invalidates all sessions.

## Existing local test cluster

Implementation verification used a separate PostgreSQL 18 cluster under the ignored `.local/pg-test` folder, bound to `127.0.0.1:55432`, without changing the existing PostgreSQL Windows service. Its local trust authentication is solely for disposable test/development data. It contains no Neon credentials or institutional user data. The cluster is not a production configuration.

If using the local development environment prepared in this workspace, start/stop that cluster with your PostgreSQL installation's `pg_ctl -D .local/pg-test -l .local/pg-test.log -o "-h 127.0.0.1 -p 55432" -w start` and `pg_ctl -D .local/pg-test -m fast -w stop` from the repository root. Start it before the API. Generated development credentials, if present, are in `.local/development-access.md` and are never committed.
