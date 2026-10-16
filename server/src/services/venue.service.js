import { fail } from "../utils/errors.js";
import { ACTIVE_STATUSES } from "../utils/schedule.js";
import { currentActor, lockVenue, venueInclude } from "./booking.service.js";
const publicVenue = (venue) => {
  const { approvers, ...data } = venue;
  return {
    ...data,
    activeApproverCount: approvers.length,
    eligible: !!(
      venue.isActive &&
      venue.bookingEnabled &&
      venue.capacity &&
      venue.openingTime &&
      venue.closingTime &&
      approvers.length
    ),
  };
};
function validateConfig(venue) {
  if (
    (venue.openingTime && !venue.closingTime) ||
    (!venue.openingTime && venue.closingTime) ||
    (venue.openingTime && venue.closingTime <= venue.openingTime)
  )
    fail(
      400,
      "INVALID_HOURS",
      "Provide opening and closing hours, with closing after opening.",
    );
  if (
    venue.bookingEnabled &&
    (!venue.capacity || !venue.openingTime || !venue.closingTime)
  )
    fail(
      400,
      "INCOMPLETE_VENUE",
      "Verified capacity and opening hours are required before enabling bookings.",
    );
}
export function createVenueService(db, clock = () => new Date()) {
  return {
    async list(query) {
      const { page, limit, search, building, type, capacity } = query;
      const where = {
        ...(search
          ? {
              OR: ["name", "buildingName", "venueType"].map((f) => ({
                [f]: { contains: search, mode: "insensitive" },
              })),
            }
          : {}),
        ...(building ? { buildingName: building } : {}),
        ...(type ? { venueType: type } : {}),
        ...(capacity ? { capacity: { gte: capacity } } : {}),
      };
      const [venues, total, facets] = await db.$transaction([
        db.venue.findMany({
          where,
          include: venueInclude,
          orderBy: [
            { sourceSerial: { sort: "asc", nulls: "last" } },
            { name: "asc" },
          ],
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.venue.count({ where }),
        db.venue.findMany({
          distinct: ["buildingName", "venueType"],
          select: { buildingName: true, venueType: true },
        }),
      ]);
      return {
        data: venues.map(publicVenue),
        pagination: { page, limit, total },
        filters: {
          buildings: [
            ...new Set(facets.map((f) => f.buildingName).filter(Boolean)),
          ].sort(),
          types: [
            ...new Set(facets.map((f) => f.venueType).filter(Boolean)),
          ].sort(),
        },
      };
    },
    async detail(id) {
      const v = await db.venue.findUnique({
        where: { id },
        include: venueInclude,
      });
      if (!v) fail(404, "NOT_FOUND", "Venue not found.");
      return publicVenue(v);
    },
    async create(account, input) {
      validateConfig(input);
      return db.$transaction(async (tx) => {
        await currentActor(tx, account, "ADMIN");
        const venue = await tx.venue.create({
          data: input,
          include: venueInclude,
        });
        await tx.auditEvent.create({
          data: {
            actorId: account.id,
            entityType: "VENUE",
            entityId: venue.id,
            action: "CREATED",
            changes: input,
          },
        });
        return publicVenue(venue);
      });
    },
    async update(account, id, input) {
      return db.$transaction(async (tx) => {
        const venue = await lockVenue(tx, id);
        await currentActor(tx, account, "ADMIN");
        const merged = { ...venue, ...input };
        validateConfig(merged);
        const active = await tx.booking.findMany({
          where: {
            venueId: id,
            status: { in: ACTIVE_STATUSES },
            occurrences: { some: { endsAt: { gt: clock() } } },
          },
          include: { occurrences: true },
        });
        if (active.length && (!merged.isActive || !merged.bookingEnabled))
          fail(
            409,
            "ACTIVE_RESERVATIONS",
            "Future or ongoing reservations must be cancelled by their requesters before disabling this venue.",
          );
        if (
          active.some(
            (b) =>
              !merged.capacity ||
              b.guestCount > merged.capacity ||
              !merged.openingTime ||
              !merged.closingTime ||
              b.localStartTime < merged.openingTime ||
              b.localEndTime > merged.closingTime,
          )
        )
          fail(
            409,
            "INVALIDATES_RESERVATIONS",
            "The new capacity or opening hours would invalidate an active reservation.",
          );
        const updated = await tx.venue.update({
          where: { id },
          data: input,
          include: venueInclude,
        });
        await tx.auditEvent.create({
          data: {
            actorId: account.id,
            entityType: "VENUE",
            entityId: id,
            action: "UPDATED",
            changes: input,
          },
        });
        return publicVenue(updated);
      });
    },
    async directory({ page, limit }) {
      const where = { role: "APPROVER", isActive: true };
      const [data, total] = await db.$transaction([
        db.account.findMany({
          where,
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.account.count({ where }),
      ]);
      return { data, pagination: { page, limit, total } };
    },
    async assignments(id) {
      if (!(await db.venue.findUnique({ where: { id }, select: { id: true } })))
        fail(404, "NOT_FOUND", "Venue not found.");
      return db.venueApprover.findMany({
        where: { venueId: id },
        select: {
          approverId: true,
          assignedAt: true,
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              role: true,
            },
          },
        },
      });
    },
    async assign(account, id, { approverIds }) {
      return db.$transaction(async (tx) => {
        await lockVenue(tx, id);
        await currentActor(tx, account, "ADMIN");
        const count = await tx.account.count({
          where: { id: { in: approverIds }, role: "APPROVER", isActive: true },
        });
        if (count !== approverIds.length)
          fail(
            400,
            "INVALID_APPROVER",
            "Choose existing active APPROVER accounts.",
          );
        await tx.venueApprover.deleteMany({ where: { venueId: id } });
        await tx.venueApprover.createMany({
          data: approverIds.map((approverId) => ({
            venueId: id,
            approverId,
            assignedBy: account.id,
          })),
        });
        await tx.auditEvent.create({
          data: {
            actorId: account.id,
            entityType: "VENUE",
            entityId: id,
            action: "ASSIGNMENTS_REPLACED",
            changes: { approverIds },
          },
        });
        return { approverIds };
      });
    },
  };
}
