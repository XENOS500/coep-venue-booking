import { format } from "date-fns";
export const TIMEZONE = "Asia/Kolkata";
export const localToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const datePlus = (d, days) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const displayDate = (d) =>
  format(new Date(`${d}T12:00:00`), "EEE, d MMM yyyy");
export const displayInstant = (instant) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  }).format(new Date(instant));
export const displayTime = (instant) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
// FullCalendar UTC mode displays these wall-clock values without browser timezone drift.
export const calendarWallTime = (instant) =>
  new Date(Date.parse(instant) + 19800000).toISOString().replace("Z", "");
