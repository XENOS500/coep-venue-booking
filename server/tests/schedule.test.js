import test from "node:test";
import assert from "node:assert/strict";
import {
  generateOccurrences,
  localDate,
  addDays,
  assertVenueEligible,
} from "../src/utils/schedule.js";
import {
  bookingSchema,
  date,
  decisionSchema,
  scheduleSchema,
} from "../src/validators/schemas.js";
import { readFile } from "node:fs/promises";
const now = new Date("2026-10-16T03:30:00Z"); // 09:00 IST
const schedule = {
  venueId: "8f269b2d-ab74-4ffa-8335-a45f084586bf",
  startDate: "2026-10-16",
  endDate: "2026-10-16",
  weekdays: [],
  localStartTime: "10:00",
  localEndTime: "11:00",
};
test("today and inclusive day 30 are valid, day 31 is rejected", () => {
  assert.equal(generateOccurrences(schedule, now).length, 1);
  assert.equal(
    generateOccurrences(
      { ...schedule, startDate: "2026-11-15", endDate: "2026-11-15" },
      now,
    ).length,
    1,
  );
  assert.throws(
    () =>
      generateOccurrences(
        { ...schedule, startDate: "2026-11-16", endDate: "2026-11-16" },
        now,
      ),
    { code: "BOOKING_WINDOW" },
  );
});
test("calendar boundary is computed at Kolkata midnight regardless of process timezone", () => {
  assert.equal(localDate(new Date("2026-10-15T18:29:59Z")), "2026-10-15");
  assert.equal(localDate(new Date("2026-10-15T18:30:00Z")), "2026-10-16");
  assert.equal(addDays("2026-12-20", 30), "2027-01-19");
});
test("same-day past/equal starts and reversed or overnight ranges are rejected", () => {
  for (const localStartTime of ["08:00", "09:00"])
    assert.throws(
      () => generateOccurrences({ ...schedule, localStartTime }, now),
      { code: "PAST_START" },
    );
  for (const localEndTime of ["10:00", "09:00"])
    assert.throws(
      () => generateOccurrences({ ...schedule, localEndTime }, now),
      { code: "INVALID_SCHEDULE" },
    );
  assert.throws(
    () => generateOccurrences({ ...schedule, endDate: "2026-10-15" }, now),
    { code: "INVALID_SCHEDULE" },
  );
});
test("recurrence includes every selected ISO weekday; UTC instants use IST offset", () => {
  for (let day = 1; day <= 7; day++) {
    const rows = generateOccurrences(
      { ...schedule, endDate: "2026-10-22", weekdays: [day] },
      now,
    );
    assert.equal(rows.length, 1);
    assert.equal(new Date(rows[0].startsAt).getUTCDay() || 7, day);
    assert.equal(rows[0].startsAt.toISOString().slice(11), "04:30:00.000Z");
  }
  assert.equal(
    generateOccurrences(
      { ...schedule, endDate: "2026-10-22", weekdays: [1, 2, 3, 4, 5, 6, 7] },
      now,
    ).length,
    7,
  );
});
test("empty recurrence, duplicate weekdays, invalid dates and unknown write fields are rejected", () => {
  assert.throws(
    () => generateOccurrences({ ...schedule, weekdays: [1] }, now),
    { code: "EMPTY_RECURRENCE" },
  );
  assert.throws(
    () => generateOccurrences({ ...schedule, endDate: "2026-10-18" }, now),
    { code: "EMPTY_RECURRENCE" },
  );
  assert.equal(
    scheduleSchema.safeParse({ ...schedule, weekdays: [1, 1] }).success,
    false,
  );
  for (const d of ["2026-02-30", "2026-13-01", "2026-2-01"])
    assert.equal(date.safeParse(d).success, false);
  assert.equal(
    scheduleSchema.safeParse({ ...schedule, status: "APPROVED" }).success,
    false,
  );
});
test("new requests require bounded contact fields, event title, guest count and purpose", () => {
  const input = {
    ...schedule,
    eventTitle: "Workshop",
    eventType: "Lecture",
    contactName: "Contact",
    contactEmail: "contact@example.com",
    contactPhone: "+91 98765 43210",
    guestCount: 1,
    eventDetails: "Details",
    purpose: "Learning",
  };
  assert.equal(bookingSchema.safeParse(input).success, true);
  for (const patch of [
    { guestCount: 0 },
    { guestCount: 1.5 },
    { contactEmail: "invalid" },
    { contactPhone: "12-34" },
    { purpose: "" },
    { requesterId: input.venueId },
    { status: "APPROVED" },
  ])
    assert.equal(
      bookingSchema.safeParse({ ...input, ...patch }).success,
      false,
    );
  assert.equal(
    decisionSchema.safeParse({ decision: "REJECTED" }).success,
    false,
  );
  assert.equal(
    decisionSchema.safeParse({ decision: "REJECTED", reason: "Not suitable" })
      .success,
    true,
  );
});
test("venue eligibility requires capacity, configuration and an active approver", () => {
  const venue = {
    isActive: true,
    bookingEnabled: true,
    capacity: 72,
    openingTime: "08:00",
    closingTime: "18:00",
    approvers: [{ approverId: "one" }],
  };
  assert.doesNotThrow(() => assertVenueEligible(venue, schedule, 72));
  for (const patch of [
    { isActive: false },
    { bookingEnabled: false },
    { capacity: null },
    { openingTime: null },
    { approvers: [] },
  ])
    assert.throws(
      () => assertVenueEligible({ ...venue, ...patch }, schedule, 1),
      { code: "VENUE_UNAVAILABLE" },
    );
  assert.throws(() => assertVenueEligible(venue, schedule, 73), {
    code: "CAPACITY_EXCEEDED",
  });
  assert.throws(
    () =>
      assertVenueEligible(venue, { ...schedule, localStartTime: "07:00" }, 1),
    { code: "OUTSIDE_OPENING_HOURS" },
  );
});
test("real catalog preserves 61 serials, missing capacity, duplicate names and all 38 image targets", async () => {
  const rows = JSON.parse(
    await readFile(
      new URL("../prisma/data/venues.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(rows.length, 61);
  assert.equal(
    rows.some((r) => r.sourceSerial === 50),
    false,
  );
  assert.deepEqual(
    rows.filter((r) => !r.capacity).map((r) => r.sourceSerial),
    [41, 47, 48, 49, 51, 52],
  );
  assert.equal(rows.filter((r) => r.imageSourceUrl).length, 38);
  assert.equal(rows.filter((r) => r.name === "ME-201").length, 2);
  assert.ok(rows.some((r) => r.features?.toLowerCase().includes("no wifi")));
  assert.match(
    rows.find((r) => r.sourceSerial === 18).imageSourceUrl,
    /sharepoint/,
  );
  assert.match(rows.find((r) => r.sourceSerial === 5).imageSourceUrl, /\?e=/);
});
