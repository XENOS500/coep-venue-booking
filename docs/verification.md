# Verification

The implementation was verified on Windows with Node 24 and a separate PostgreSQL 18 cluster at loopback port 55432. No existing PostgreSQL service data or Neon database was changed. Browser checks use Chromium with a Los Angeles browser timezone to detect accidental local-time rendering.

## Automated checks

Final run: 10 unit/HTTP tests passed, 14 PostgreSQL integration/load checks passed, browser workflow passed, production build passed, and dependency audit reported zero vulnerabilities. Schema validation/generation, migration deployment and schema-to-database comparison passed with no detected drift. Lockfile installation validation (`npm ci --dry-run --ignore-scripts --offline`) passed. The final local load run measured catalog p95 at 134 ms and availability p95 at 23 ms; deployment performance still needs verification on Neon.

- `npm test`: authentication, authorization, invalid/expired/revoked sessions, rate limiting, real dates, Kolkata midnight, the inclusive 30-day horizon, recurrence across all weekdays, empty recurrence, opening hours, capacity, strict event-field validation and workbook provenance.
- `npm run test:integration -w server` with `TEST_DATABASE_URL`: real HTTP and PostgreSQL request/approve/cancel workflow; current assignment scope; admin restrictions; private details and conflict/calendar redaction; concurrent overlapping submissions; adjacent intervals; whole-series rollback/cancellation; concurrent and repeated decisions; assignment revocation and restoration; safe venue edits/deactivation; self-decision after a role change; first-occurrence cutoff; trusted provisioning/session revocation/last-admin protection; database check constraints.
- The performance test additionally uses `PERFORMANCE_DATABASE_URL`, named with `_perf_test`: 100 venues, 1,000 occurrences and 10 concurrent signed-in clients; 100 measured calls per endpoint. Catalog and availability p95 are asserted below 2,000 ms. Local PostgreSQL results do not establish deployed Neon/network performance.
- `npm run build`: production Vite build. Calendar is split into its own lazy-loaded bundle.
- `prisma validate`, `prisma generate`, `prisma migrate deploy`: schema, generated client and clean database migration checks.
- `npm audit --audit-level=high`: dependency audit. Patched root overrides are documented in `package.json`.

## Browser workflow

The repeatable script covers ADMIN venue configuration and assignment, REQUESTER catalog/details and availability preview, request submission and pending calendar display, APPROVER approval, REQUESTER cancellation, and desktop/mobile navigation. It checks for browser runtime errors and mobile horizontal overflow. Screenshots are stored under ignored `.local/screenshots/` and were visually inspected.

To rerun, prepare a separate migrated and seeded database ending in `_ui_test`, point a running API at it, and run Vite on `127.0.0.1:5173`. Never point browser fixture preparation at production.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/coep_ui_test'
node server/tests/browser/prepare.js
# API DATABASE_URL must point to that same disposable UI database.
# Use an existing Playwright installation; it is not an application dependency.
$env:PLAYWRIGHT_MODULE_PATH = 'ABSOLUTE_PATH_TO_PLAYWRIGHT_PACKAGE'
# Optional when using a compatible existing Chromium binary:
$env:PLAYWRIGHT_EXECUTABLE_PATH = 'ABSOLUTE_PATH_TO_BROWSER_EXECUTABLE'
node server/tests/browser/smoke.cjs
```

Browser preparation writes random fixture credentials only to ignored `.local/browser-fixtures.json`. Each full run creates a fresh request and cancels it. Use an API restart between repeated runs if the login attempt limiter is reached. The production bundle and source do not include fixture passwords.

## Deployment work that remains

- Supply the institution's Neon connection and production JWT secret; apply migrations to an approved empty/baselined database after backup.
- Provision actual accounts and verify venue capacity, opening hours and approver assignments. Six source capacities are missing; all imported booking configurations start disabled.
- Resolve authorized display images where wanted. The 38 workbook source links have been preserved, not access-verified; six are folder links and two unlinked labels remain unresolved.
- Configure HTTPS hosting, exact trusted origin, proxy settings, provider backups and recovery; rerun acceptance and load checks on the deployment.

No public registration, account-management APIs, email notifications, partial-series changes, auto-expiry or administrator booking overrides are in scope. Changes are left uncommitted for developer review and merge.
