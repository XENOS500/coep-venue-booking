import { fail } from "../utils/errors.js";
import { decisionMessage } from "./decision-email.service.js";
import {
  ACTIVE_STATUSES,
  generateOccurrences,
  assertVenueEligible,
} from "../utils/schedule.js";

export const venueInclude = {
  approvers: {
    where: { approver: { isActive: true, role: "APPROVER" } },
    select: { approverId: true },
  },
};
const bookingInclude = {
  venue: true,
  occurrences: { orderBy: { startsAt: "asc" } },
  actions: {
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true } } },
  },
};
export async function lockVenue(tx, id) {
  const rows =
    await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${id}::uuid FOR UPDATE`;
  if (!rows.length) fail(404, "NOT_FOUND", "Venue not found.");
  return tx.venue.findUnique({ where: { id }, include: venueInclude });
}
export async function currentActor(tx, account, role) {
  const actor = await tx.account.findUnique({ where: { id: account.id } });
  if (!actor?.isActive || actor.tokenVersion !== account.tokenVersion)
    fail(401, "SESSION_EXPIRED", "Please sign in again.");
  if (actor.role !== role)
    fail(403, "FORBIDDEN", "This action is not available for your role.");
  return actor;
}
export async function findConflicts(tx, venueId, occurrences, excludeId) {
  const rows = await tx.bookingOccurrence.findMany({
    where: {
      venueId,
      booking: { status: { in: ACTIVE_STATUSES } },
      ...(excludeId ? { bookingId: { not: excludeId } } : {}),
      OR: occurrences.map((o) => ({
        startsAt: { lt: o.endsAt },
        endsAt: { gt: o.startsAt },
      })),
    },
    select: { startsAt: true, endsAt: true },
    orderBy: { startsAt: "asc" },
  });
  return rows;
}
function assertNoConflicts(conflicts) {
  if (conflicts.length)
    fail(
      409,
      "SLOT_CONFLICT",
      "One or more occurrences overlap a reserved interval. The entire request was left unchanged.",
      { conflicts },
    );
}
export function bookingScope(account) {
  if (account.role === "REQUESTER") return { requesterId: account.id };
  if (account.role === "APPROVER")
    return { venue: { approvers: { some: { approverId: account.id } } } };
  fail(
    403,
    "FORBIDDEN",
    "Administrators can view operational occupancy in the calendar.",
  );
}
export function createBookingService(db, clock = () => new Date(), {
  frontendOrigin = "http://127.0.0.1:5173", onDecision,
} = {}) {
  return {
    async availability(input) {
      const occurrences = generateOccurrences(input, clock());
      const venue = await db.venue.findUnique({
        where: { id: input.venueId },
        include: venueInclude,
      });
      if (!venue) fail(404, "NOT_FOUND", "Venue not found.");
      assertVenueEligible(venue, input);
      const conflicts = await findConflicts(db, venue.id, occurrences);
      return { available: !conflicts.length, occurrences, conflicts };
    },
    async create(account, input) {
      return db.$transaction(
        async (tx) => {
          const venue = await lockVenue(tx, input.venueId);
          await currentActor(tx, account, "REQUESTER");
          const occurrences = generateOccurrences(input, clock());
          assertVenueEligible(venue, input, input.guestCount);
          assertNoConflicts(await findConflicts(tx, venue.id, occurrences));
          return tx.booking.create({
            data: {
              ...input,
              requesterId: account.id,
              occurrences: {
                create: occurrences,
              },
              actions: { create: { actorId: account.id, action: "SUBMITTED" } },
            },
            include: bookingInclude,
          });
        },
        { maxWait: 10000, timeout: 15000 },
      );
    },
    async list(account, query) {
      const { page, limit, status } = query;
      const where = {
        ...bookingScope(account),
        ...(status
          ? {
              status:
                status === "HISTORY"
                  ? { in: ["APPROVED", "REJECTED", "CANCELLED"] }
                  : status,
            }
          : {}),
      };
      const [data, total] = await db.$transaction([
        db.booking.findMany({
          where,
          include: bookingInclude,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.booking.count({ where }),
      ]);
      return { data, pagination: { page, limit, total } };
    },
    async detail(account, id) {
      const booking = await db.booking.findFirst({
        where: { id, ...bookingScope(account) },
        include: bookingInclude,
      });
      if (!booking) fail(404, "NOT_FOUND", "Booking not found.");
      return booking;
    },
    async transition(account, id, input, cancel = false) {
      // Only use the initial lookup to find the lock key. Re-read state after acquiring it.
      const initial = await db.booking.findUnique({
        where: { id },
        select: { venueId: true },
      });
      if (!initial) fail(404, "NOT_FOUND", "Booking not found.");
      const result = await db.$transaction(
        async (tx) => {
          const venue = await lockVenue(tx, initial.venueId);
          await currentActor(tx, account, cancel ? "REQUESTER" : "APPROVER");
          const booking = await tx.booking.findUnique({
            where: { id },
            include: bookingInclude,
          });
          if (cancel && booking.requesterId !== account.id)
            fail(404, "NOT_FOUND", "Booking not found.");
          if (!cancel) {
            if (!venue.approvers.some((a) => a.approverId === account.id))
              fail(404, "NOT_FOUND", "Booking not found.");
            if (booking.requesterId === account.id)
              fail(
                403,
                "SELF_DECISION",
                "You cannot decide your own historical request.",
              );
          }
          const valid = cancel
            ? ACTIVE_STATUSES.includes(booking.status)
            : booking.status === "PENDING";
          if (
            !valid ||
            !booking.occurrences.length ||
            booking.occurrences[0].startsAt <= clock()
          )
            fail(
              409,
              "INVALID_TRANSITION",
              "The request has already been decided, cancelled, or started.",
            );
          if (!cancel) {
            assertVenueEligible(venue, booking, booking.guestCount);
            assertNoConflicts(
              await findConflicts(
                tx,
                venue.id,
                booking.occurrences,
                booking.id,
              ),
            );
          }
          const status = cancel ? "CANCELLED" : input.decision;
          const updated = await tx.booking.update({
            where: { id },
            data: {
              status,
              actions: {
                create: {
                  actorId: account.id,
                  action: status,
                  reason: input.reason,
                },
              },
            },
            include: bookingInclude,
          });
          if (!cancel) {
            const action = updated.actions.find(entry => entry.action === status);
            await tx.decisionEmail.create({ data: {
              actionId: action.id,
              ...decisionMessage(updated, input.reason, frontendOrigin),
              nextAttemptAt: clock(),
            } });
          }
          return updated;
        },
        { maxWait: 10000, timeout: 15000 },
      );
      // Wake only after the transaction commits; delivery cannot undo a decision.
      if (!cancel) onDecision?.();
      return result;
    },
    async calendar(account, { from, to }) {
      const start = new Date(`${from}T00:00:00+05:30`),
        end = new Date(`${to}T00:00:00+05:30`);
      if (end <= start || end - start > 93 * 86400000)
        fail(
          400,
          "INVALID_RANGE",
          "Choose an exclusive end date within 93 days of the start.",
        );
      const rows = await db.bookingOccurrence.findMany({
        where: {
          startsAt: { lt: end },
          endsAt: { gt: start },
          booking: { status: { in: ACTIVE_STATUSES } },
        },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          venueId: true,
          venue: { select: { name: true, buildingName: true } },
          booking: { select: { id: true, status: true, requesterId: true } },
        },
        orderBy: { startsAt: "asc" },
        take: 10001,
      });
      if (rows.length > 10000)
        fail(400, "RANGE_TOO_LARGE", "Choose a smaller calendar range.");
      return rows.map(({ booking, ...o }) => ({
        ...o,
        status: booking.status,
        isOwn: booking.requesterId === account.id,
        ...(booking.requesterId === account.id && account.role === "REQUESTER"
          ? { bookingId: booking.id }
          : {}),
      }));
    },
  };
}
