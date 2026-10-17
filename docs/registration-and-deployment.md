# Requester signup and Approver management

Approved scope update (17 October 2026): requester-only, any-email OTP signup
replaces the earlier PRD's prohibition on public registration. Admin and Approver
accounts remain invitation/provisioning-only. No email, password or role is
modified on existing accounts by these migrations. The current Admin login stays
valid, including its existing non-college email identifier.

## Requesters

Open `/register` from **Register as Requester** on Login. Enter name, a valid
email address (Gmail, Yahoo, college or another provider), and a password of at
least 12 characters. Emails are normalized. Invalid addresses and client-supplied
roles are rejected by the backend. New Approvers remain college-email only.

Only after entering the six-digit code is an active REQUESTER account created.
The code expires in 10 minutes, allows five guesses, and is single-use. Codes
are HMAC-protected with the server JWT secret; passwords are bcrypt hashes.
Resends wait 60 seconds and are limited to five sends per email per hour, shared
between starting registration again and resending. API IP rate limits also apply.
Verification and resends serialize per email to prevent duplicate accounts and
code reuse. Codes, passwords, and email-provider responses are never logged.

Existing provisioned logins are preserved; registration does not reset them.
Expired pending entries may be removed by trusted maintenance after their hourly
rate-limit window has passed, e.g. delete rows expired more than one day ago:

```sql
DELETE FROM "PendingRegistration"
WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '1 day';
```

## Approvers

Admin → **Manage accounts** → **Add approver**. Enter the authority's name,
`@coeptech.ac.in` email and password. Share credentials through a private channel.
The app never emails passwords. If the email already belongs to a Requester,
the UI explicitly grants Approver access, replaces the password and revokes old
sessions. An existing Approver is managed through its row rather than overwritten.

Use **Reset password**, **Disable** or **Enable** to manage existing approvers.
Each change revokes their existing sessions and is audited without credentials.
The Admin account is excluded from these operations. Multiple Approvers are
supported; the single-Admin database constraint remains in effect.

After creation, use **Assign approvers** to grant access to specific venues.
Reassign pending requests' venues to another active approver before disabling
their only reviewer. Disabling an account leaves its history intact.

## Configure real OTP delivery

Gmail API is integrated over HTTPS using Node's built-in fetch; no SDK or SMTP
connection is required. Follow [Gmail setup](gmail-setup.md) to enable Gmail API,
authorize a sender, obtain a refresh token and configure these Render variables:

```text
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
GMAIL_SENDER_EMAIL
```

This replaces Resend and does not require college DNS access. No real emails
were sent during tests. Existing login works without email configuration;
signup is unavailable until the four settings are present. Never put OAuth
secrets into VITE variables. Review Google's testing-mode token expiry before
relying on the deployment. Only the sender authorizes Gmail; recipients do not.

# Merge dev into main and deploy

The developer performs all commits, pushes and merges. Current edits are on `dev`.

1. Review the diff and commit all intended changes on `dev`. For example:

   ```powershell
   git status
   git add client server docs .github readme.md
   git commit -m "feat: add Gmail OTP signup and admin approver management"
   git push origin dev
   ```

2. On GitHub create a pull request with **base: main**, **compare: dev**. Review
   and test it, resolve any conflicts, then merge. Keep the `dev` branch.
   A pull request provides a reviewable release without manually overwriting main.

3. Before deploying, back up Neon and inspect Admin count:

   ```sql
   SELECT id, email, "isActive" FROM "Account" WHERE role = 'ADMIN';
   ```

   If there is more than one, resolve which account retains Admin before applying
   `202610170001_single_admin`. Do not drop tables or reseed accounts. The next
   migration, `202610170002_registration`, only adds a nullable verification
   timestamp and pending-registration table; it preserves all existing credentials.
   `202610170003_requester_any_email` then permits any provider for requester OTPs.

4. Render: set deployment **Branch = main**. Keep repository root blank, use
   Node 22 and these commands:

   ```text
   Build: npm ci --include=dev && npm run db:generate
   Start: npm run db:migrate && npm run start -w server
   Health check: /api/v1/health
   ```

   Retain existing `DATABASE_URL`, `JWT_SECRET` (do not rotate it), `TRUST_PROXY=1`,
   and `CLIENT_ORIGIN=https://coep-venue-booking.vercel.app`. Add the four Gmail
   variables above. Deploy the latest `main` commit and verify
   https://coep-venue-booking.onrender.com/api/v1/health and
   https://coep-venue-booking.onrender.com/api/v1/health/live.

5. Vercel: **Settings → Environments → Production → Branch Tracking = main**.
   Use repository root, Vite, `npm ci --include=dev`, `npm run build`, and output
   directory `client/dist`. Keep this Production Config variable:

   ```text
   VITE_API_URL=https://coep-venue-booking.onrender.com/api/v1
   ```

   Create a new Production deployment from `main`; do not redeploy an old commit.
   Confirm its build log says **Branch: main** and the newly merged commit.

6. GitHub Actions: after the workflow is on default branch `main`, enable
   **Backend health check** and run it manually once. It then schedules five-minute
   liveness checks. Schedules are best effort, not an uptime guarantee.

7. In incognito, verify the existing Admin login, requester OTP signup, the
   Admin-only Manage accounts page, new Approver login, venue assignment, a
   Requester booking and its Approver decision. Verify supplied photos load.

Production URL: https://coep-venue-booking.vercel.app

Future work goes on `ayush_dev` → `dev` for testing → `main` for release. Separate
deployed staging should use a separate frontend/API and separate Neon database
or branch; never test registration or migrations against production records.
