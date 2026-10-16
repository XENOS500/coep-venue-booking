# COEP Spaces — Venue Booking

Full-stack campus venue booking built from `agent/PRD.md` v2.0. React/Vite frontend in `client/`; Express/Prisma/PostgreSQL backend in `server/`.

The application includes login, a dashboard, the real 61-venue catalog and details, availability checks, single and recurring requests, requester history/cancellation, assigned approver decisions/history, a privacy-filtered calendar, venue administration and approver assignment. Roles do not inherit permissions. Accounts are provisioned through trusted maintenance, with no signup or account-management API.

## Setup

Requirements: Node.js 22.12+ (tested with Node 24), npm, and PostgreSQL. Use your Neon database for deployment. No remote database credentials are included.

From the repository root:

```powershell
npm ci
Copy-Item server/.env.example server/.env
```

Set `DATABASE_URL` to your PostgreSQL/Neon connection string in `server/.env`, preserving `sslmode=require` for Neon. Set a random `JWT_SECRET` of at least 32 characters and `CLIENT_ORIGIN=http://127.0.0.1:5173`. Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` and save it privately. Neither `.env` nor `.local/` is tracked.

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

These commands use `server/.env` for migrations and seeding. The idempotent catalog seed inserts source serials without overwriting existing edits. It deliberately does not invent opening hours, verified images, capacities, assignments or passwords.

### Bootstrap the first account

Use the maintenance script from a trusted administrator terminal. Passwords are read from environment variables rather than command-line arguments. Set a password of at least 12 characters and at most 72 UTF-8 bytes (bcrypt's limit).

```powershell
$env:ACCOUNT_EMAIL = 'your-admin@coeptech.ac.in'
$env:ACCOUNT_NAME = 'Your name'
$env:ACCOUNT_ROLE = 'ADMIN'
$env:ACCOUNT_PASSWORD = [Net.NetworkCredential]::new('', (Read-Host 'New password' -AsSecureString)).Password
npm run account:provision -w server
Remove-Item Env:ACCOUNT_PASSWORD
```

Repeat with `APPROVER` and `REQUESTER` to provision real accounts. An existing email updates that account and revokes its old sessions. Optional `ACCOUNT_ACTIVE=false` deactivates it; the script prevents removal of the last active admin. Clear provisioning variables after use. Deliver credentials through an authorized private channel. Account lifecycle changes are operational tasks, not ADMIN web permissions.

### Start development

Run these in two terminals:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Open [COEP Spaces](http://127.0.0.1:5173). Vite proxies `/api` to port 4000. Use the exact configured hostname for trusted-origin CORS. Sessions remain in memory, so refreshing or reopening the page requires login.

As ADMIN, verify a venue's capacity and opening hours under Manage Venues, enable booking, and assign an existing active APPROVER under Assign Approvers. Only then can REQUESTER accounts submit requests. The six missing-capacity venues remain visible but unavailable until verified. Source image links remain unverified; an authorized directly embeddable HTTPS image URL can be entered separately.

## Verification

```powershell
npm test
npm run build
npm audit --audit-level=high
```

For real database integration checks, create and migrate a **separate disposable database whose name ends in `_test`**, then set `TEST_DATABASE_URL` in the environment or `server/.env`:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/coep_test'
# Apply the checked-in migrations to this disposable database first.
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate
npm run test:integration -w server
Remove-Item Env:DATABASE_URL
Remove-Item Env:TEST_DATABASE_URL
```

Integration tests erase only the explicitly selected disposable database. Workflow checks use real HTTP, Prisma and PostgreSQL, including competing submissions/decisions, series rollback, adjacency, privacy, assignment revocation, venue edits and self-decision after role changes. With no test URL, the integration suite reports skipped tests rather than pretending they ran.

The performance test uses a second migrated disposable database ending in `_perf_test`, supplied as `PERFORMANCE_DATABASE_URL`. It measures 100 catalog and 100 availability requests from 10 signed-in clients with 100 venues and 1,000 occurrences. Local timings are not a Neon/network benchmark.

Browser verification scripts are in `server/tests/browser/`. See [verification notes](docs/verification.md) for how to prepare their isolated fixtures and run them with an existing Playwright installation.

## Project references

- [Architecture, schema and requirement reconciliation](docs/architecture.md)
- [API contract](docs/api.md)
- [Operations and deployment](docs/operations.md)
- [Executed verification and remaining deployment work](docs/verification.md)
- [Prisma schema](server/prisma/schema.prisma)

Keep changes on the developer-prepared development branch. Repository contributors use `<name>_dev` branches (for example `ayush_dev`); the developer reviews and merges into `dev`, then `main`. Agent changes are left uncommitted.

