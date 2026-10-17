# Development and releases

Use `ayush_dev` for feature work, `dev` for integration and acceptance testing,
and `main` for verified releases. The developer performs every Git write.

1. Implement and test a feature on `ayush_dev`; commit and push it manually.
2. Review and merge `ayush_dev` into `dev` on GitHub.
3. Verify the complete booking workflow in staging, including each role,
   login, image loading, clashes and approval. Run `npm test` and `npm run build`;
   run database integration tests against a disposable test database.
4. Review and merge `dev` into `main` once acceptance checks pass.
5. Deploy production from `main` and check `/api/v1/health` and a real login.

The current hosted services were configured to track `dev`. After the first
verified `dev` release is merged into `main`, change both Vercel Production
Branch Tracking and Render's deployment branch to `main`. Keep the stable
production frontend domain as Render's exact `CLIENT_ORIGIN`.

For deployed staging, use a separate Vercel project and Render service tracking
`dev`, plus a separate Neon database or branch. Set staging's `VITE_API_URL` to
the staging API and staging's `CLIENT_ORIGIN` to the staging frontend. Never
run staging migrations or integration tests against production data.

# Slow first login

Render Free sleeps after 15 idle minutes and can take about one minute to wake:
https://render.com/docs/free#spinning-down-on-idle

The login request allows 120 seconds without automatically replaying credentials.
Other API requests keep their 20-second timeout. A status message appears after
10 seconds. This handles many cold starts but cannot guarantee hosting uptime.
For reliable production response times, use an always-on Render instance.
Confirm the cause with Render's logs around the reported timeout; an unavailable
database or network failure can also cause timeouts.

## Scheduled liveness checks

`.github/workflows/backend-health.yml` calls the public
`/api/v1/health/live` endpoint every five minutes. This route checks only API
liveness and does not query Neon. `/api/v1/health` remains the database-aware
readiness endpoint and should remain Render's deployment health check.

Deploy the new backend route first. Commit and merge the workflow into the
GitHub repository's default branch (`main`) to activate scheduled runs. In
GitHub Actions, enable workflows if needed, select **Backend health check**,
then **Run workflow** to verify a manual run. No database secrets are needed.
To change the target, set repository Actions variable `BACKEND_HEALTH_URL` to
the complete liveness URL. The workflow intentionally does not run in forks.

GitHub schedules are best effort: runs can be delayed or dropped under load,
and public repositories' schedules are disabled after 60 days without activity.
It reduces idle sleeps but does not guarantee continuous uptime. It also uses
Actions runner time and Render running hours. No workflow has been enabled or
pushed by the agent. See:
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

The liveness route deliberately leaves Neon scale-to-zero available; the first
database request may still need to wake the database. Keep the longer login
timeout. Always-on hosting is the option for dependable production latency.

# Account provisioning

Exactly one ADMIN account may exist, whether active or inactive. Its credentials
can be updated through the existing maintenance script, and the last active
Admin cannot be demoted or deactivated. Each Requester and Approver gets their
own email and password; multiple accounts of each role are supported.

`202610170001_single_admin` adds a partial unique index to enforce the rule even
for concurrent database writes. Before deployment, inspect administrators using
the Neon SQL editor:

```sql
SELECT id, email, "isActive" FROM "Account" WHERE role = 'ADMIN';
```

If more than one exists, decide which account to retain as Admin and resolve
the other roles explicitly before applying the migration. The migration never
silently changes roles or deletes accounts. Back up existing data before
migrations. Apply using `npm run db:migrate` against the intended database.

Provision accounts from a trusted terminal using `npm run account:provision -w
server` with `ACCOUNT_EMAIL`, `ACCOUNT_NAME`, `ACCOUNT_ROLE`, `ACCOUNT_PASSWORD`,
and `ACCOUNT_ACTIVE=true` in its environment. Keep credentials out of source
control. Updating an existing account revokes its previous sessions.
