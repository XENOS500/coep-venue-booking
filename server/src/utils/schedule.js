import { fail } from "./errors.js";
export const TIMEZONE = "Asia/Kolkata";
export const ACTIVE_STATUSES = ["PENDING", "APPROVED"];
export const localDate = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const addDays = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const toInstant = (date, time) => new Date(`${date}T${time}:00+05:30`);
export function generateOccurrences(
  schedule,
  now = new Date(),
  enforceWindow = true,
) {
  const { startDate, endDate, weekdays, localStartTime, localEndTime } =
    schedule;
  if (endDate < startDate || localEndTime <= localStartTime)
    fail(
      400,
      "INVALID_SCHEDULE",
      "End date must follow start date, and end time must be after start on the same day.",
    );
  const today = localDate(now),
    last = addDays(today, 30);
  if (enforceWindow && (startDate < today || endDate > last))
    fail(
      400,
      "BOOKING_WINDOW",
      `Choose dates from ${today} through ${last} (Asia/Kolkata).`,
    );
  if ((Date.parse(endDate) - Date.parse(startDate)) / 86400000 > 30)
    fail(400, "INVALID_SCHEDULE", "Schedule cannot span more than 30 days.");
  if (startDate !== endDate && !weekdays.length)
    fail(
      400,
      "EMPTY_RECURRENCE",
      "Select at least one weekday for a recurring booking.",
    );
  const occurrences = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    const weekday = new Date(`${d}T00:00:00Z`).getUTCDay() || 7;
    if (weekdays.length && !weekdays.includes(weekday)) continue;
    const startsAt = toInstant(d, localStartTime),
      endsAt = toInstant(d, localEndTime);
    if (startsAt <= now)
      fail(
        400,
        "PAST_START",
        "Every occurrence must start in the future (Asia/Kolkata).",
      );
    occurrences.push({ startsAt, endsAt });
  }
  if (!occurrences.length)
    fail(400, "EMPTY_RECURRENCE", "No dates match the selected weekdays.");
  return occurrences;
}
export function assertVenueEligible(venue, schedule, guestCount) {
  if (
    !venue.isActive ||
    !venue.bookingEnabled ||
    !venue.capacity ||
    !venue.openingTime ||
    !venue.closingTime ||
    !venue.approvers?.length
  )
    fail(
      400,
      "VENUE_UNAVAILABLE",
      "Venue needs verified capacity, opening hours, booking enablement and an active assigned approver.",
    );
  if (
    schedule.localStartTime < venue.openingTime ||
    schedule.localEndTime > venue.closingTime
  )
    fail(
      400,
      "OUTSIDE_OPENING_HOURS",
      `Choose a time between ${venue.openingTime} and ${venue.closingTime}.`,
    );
  if (guestCount && guestCount > venue.capacity)
    fail(400, "CAPACITY_EXCEEDED", `Maximum capacity is ${venue.capacity}.`);
}
