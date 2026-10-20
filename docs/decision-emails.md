# Booking decision emails

An authorized Approver's successful APPROVED or REJECTED transition creates one
`DecisionEmail` record for its `BookingAction`, in the same database transaction.
The unique action reference and existing booking locks prevent duplicate queue
entries from repeated or concurrent decisions. Failed, unauthorized or rolled-back
decisions do not create notifications. Cancellation does not send a decision email.

The recipient is the **contact email in the booking form**, even if it differs
from the requester's login email. Each plain-text message contains the reference,
event title, venue, all scheduled occurrences in Asia/Kolkata, decision, any
approver reason, and a link to the authenticated booking page. Receiving the link
does not grant access to the booking. Unicode names, titles and reasons are
encoded as UTF-8 MIME content; user-entered values never become email headers.

## Delivery and recovery

The existing Gmail HTTPS service and OAuth token cache are shared by OTP and
notification delivery. No new provider, package or Google permission is required.
The server wakes the delivery worker only after a decision commits, and once on
startup. A stopped Render instance resumes processing after it starts again.

The worker atomically claims queued rows with `FOR UPDATE SKIP LOCKED` and a
five-minute lease. It does not hold a database transaction open during Gmail
requests. Failed sends retry after 1, 2, 4 and 8 minutes, with at most five send
attempts. Expired leases can be recovered following a crash. It drains batches of
ten, schedules only pending retries/leases, and stops querying Neon when the queue
is empty. Database worker errors retry after 30 seconds. Free-host sleeping and
provider availability can delay delivery; it is not a guaranteed delivery deadline.

Delivery is **at least once**: an ambiguous timeout or a crash after Gmail accepts
a message but before SENT is saved can cause a duplicate. A stable Message-ID is
included, but Gmail does not promise deduplication. SENT means Gmail accepted the
send, not that the recipient read it or that it avoided spam. FAILED needs manual
review. Existing decisions made before deploying this feature are not backfilled.

Missing Gmail configuration leaves notifications pending without consuming
attempts. Fix environment variables and redeploy to resume. No credentials,
message content or recipient addresses are written to worker logs.

## Deploy

Keep the current Render environment variables: `DATABASE_URL`, `JWT_SECRET`,
`CLIENT_ORIGIN`, `TRUST_PROXY`, and all four `GMAIL_*` variables.
`CLIENT_ORIGIN` must be `https://coep-venue-booking.vercel.app` in production;
it is also the trusted origin used for booking links.

Build: `npm ci --include=dev && npm run db:generate`

Start: `npm run db:migrate && npm run start -w server`

Commit the new `202610200001_decision_emails` migration with the source. The start
command applies it to Neon before the new server starts. Do not reset or reseed
the database. The normal server process owns the worker; no separate paid Render
worker service is needed. Vercel's deployment adds the login password toggle and
the contact-email hint; its API URL does not change.

After deploying, create two future requests with an inbox you control as contact
email. Approve one and reject the other with a reason. Check the inbox/spam folder
and Gmail sender's Sent folder. Verify event, venue, IST schedule and links.

## Inspect failures in Neon

Use the SQL Editor on the same database as Render:

```sql
SELECT id, "actionId", status, attempts, "lastErrorCode", "nextAttemptAt", "sentAt"
FROM "DecisionEmail"
ORDER BY "createdAt" DESC
LIMIT 30;
```

After fixing Gmail credentials or delivery problems, retry exhausted rows only
after checking the sender's Sent folder for already delivered copies. Select the
specific notification UUID before performing a targeted maintenance update; do
not reset every row or rerun the booking decision. A server restart resumes
processing any records returned to PENDING.

## Validation

Unit tests cover Gmail MIME generation, Unicode and header injection. PostgreSQL
workflow tests cover atomic rollback on queue failure, concurrent decisions and
worker claims, retries, exhausted attempts, missing configuration, startup/crash
recovery and cancellation exclusion. Gmail calls are mocked: real delivery must
be checked after deployment. Browser checks cover hiding/revealing the login
password with mouse and keyboard, preserving its value and avoiding form submit.
