const MAX_ATTEMPTS = 5;
const LEASE_MS = 5 * 60 * 1000;

export function decisionMessage(booking, reason, frontendOrigin) {
  const date = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  });
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true,
  });
  const status = booking.status.toLowerCase();
  const url = new URL(`/bookings/${booking.id}`, frontendOrigin).href;
  return {
    recipient: booking.contactEmail,
    subject: `COEP Spaces: booking ${status} (${booking.id})`,
    body: [
      `Hello ${booking.contactName},`, "",
      `Your venue booking request has been ${status}.`, "",
      `Booking reference: ${booking.id}`,
      `Event: ${booking.eventTitle}`,
      `Venue: ${booking.venue.name}`, "",
      "Schedule (IST / Asia/Kolkata):",
      ...booking.occurrences.map(({ startsAt, endsAt }) =>
        `${date.format(new Date(startsAt))}: ${time.format(new Date(startsAt))} - ${time.format(new Date(endsAt))}`),
      ...(reason ? ["", `Approver's reason: ${reason}`] : []), "",
      `View the request: ${url}`,
      "Sign in with the requester account that submitted this booking to view its details.",
      "", "COEP Spaces", "",
    ].join("\n"),
  };
}

// Durable outbox: claim one row atomically so multiple server processes cannot
// send the same notification concurrently. Expired leases recover after a crash.
export function createDecisionEmailWorker(db, emailService, {
  clock = () => new Date(), logger = console,
} = {}) {
  let timer;
  let running;
  let stopped = false;
  let started = false;
  let rerun = false;
  async function deliver() {
    if (!emailService.configured) return;
    for (let index = 0; index < 10 && !stopped; index++) {
      const now = clock();
      const stale = new Date(now.getTime() - LEASE_MS);
      const rows = await db.$queryRaw`
        WITH candidate AS (
          SELECT id FROM "DecisionEmail"
          WHERE (status = 'PENDING' AND "nextAttemptAt" <= ${now})
             OR (status = 'SENDING' AND "lockedAt" <= ${stale})
          ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE "DecisionEmail" AS email
        SET status = 'SENDING', attempts = attempts + 1, "lockedAt" = ${now}
        FROM candidate WHERE email.id = candidate.id RETURNING email.*`;
      const row = rows[0];
      if (!row) return;
      if (row.attempts > MAX_ATTEMPTS) {
        await db.decisionEmail.update({ where: { id: row.id }, data: {
          status: "FAILED", lockedAt: null, lastErrorCode: "DELIVERY_UNCONFIRMED",
        } });
        continue;
      }
      try {
        await emailService.sendNotification(row);
      } catch {
        const failed = row.attempts >= MAX_ATTEMPTS;
        await db.decisionEmail.update({ where: { id: row.id }, data: {
          status: failed ? "FAILED" : "PENDING", lockedAt: null,
          nextAttemptAt: new Date(clock().getTime() + Math.min(30, 2 ** (row.attempts - 1)) * 60000),
          lastErrorCode: "EMAIL_DELIVERY_FAILED",
        } });
        logger.error(JSON.stringify({ event: "decision_email_failed", notificationId: row.id, attempts: row.attempts, exhausted: failed }));
        continue;
      }
      // If this write fails after Gmail accepted the message, the lease can
      // recover it. Delivery is at-least-once; a rare duplicate is possible.
      await db.decisionEmail.update({ where: { id: row.id }, data: {
        status: "SENT", lockedAt: null, sentAt: clock(), lastErrorCode: null,
      } });
    }
  }
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(wake, Math.max(1000, delay));
    timer.unref?.();
  }
  async function scheduleNext() {
    if (!started || stopped || !emailService.configured) return;
    const [next] = await db.$queryRaw`
      SELECT MIN(CASE WHEN status = 'PENDING' THEN "nextAttemptAt"
        ELSE "lockedAt" + INTERVAL '5 minutes' END) AS due
      FROM "DecisionEmail" WHERE status IN ('PENDING', 'SENDING')`;
    if (next?.due && !stopped) schedule(new Date(next.due).getTime() - clock().getTime());
  }
  function wake() {
    if (stopped) return Promise.resolve();
    if (running) { rerun = true; return running; }
    clearTimeout(timer);
    running = (async () => {
      do { rerun = false; await deliver(); } while (rerun && !stopped);
      await scheduleNext();
    })().catch(() => {
      logger.error(JSON.stringify({ event: "decision_email_worker_error" }));
      if (started && !stopped) schedule(30000);
    }).finally(() => {
      running = undefined;
      if (rerun && !stopped) void wake();
    });
    return running;
  }
  return {
    wake,
    start() {
      if (started) return;
      started = true;
      stopped = false;
      void wake();
    },
    async stop() {
      stopped = true;
      started = false;
      clearTimeout(timer);
      timer = undefined;
      await running;
    },
  };
}
