import { z } from "zod";
const text = (max) => z.string().trim().min(1).max(max);
export const uuid = z.string().uuid();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, "Enter a real calendar date");
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
export const scheduleFields = {
  venueId: uuid,
  startDate: date,
  endDate: date,
  weekdays: z
    .array(z.number().int().min(1).max(7))
    .max(7)
    .default([])
    .refine((a) => new Set(a).size === a.length, "Weekdays must be distinct"),
  localStartTime: time,
  localEndTime: time,
};
export const scheduleSchema = z.object(scheduleFields).strict();
export const bookingSchema = z
  .object({
    ...scheduleFields,
    eventTitle: text(160),
    eventType: text(80),
    contactName: text(120),
    contactEmail: z.string().trim().toLowerCase().email().max(254),
    contactPhone: text(25)
      .min(7)
      .regex(/^[\d +()\-]+$/)
      .refine(
        (s) => s.replace(/\D/g, "").length >= 7,
        "At least 7 digits required",
      ),
    guestCount: z.number().int().positive(),
    eventDetails: text(2000),
    purpose: text(500),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z
      .string()
      .min(1)
      .max(72)
      .refine(
        (s) => Buffer.byteLength(s, "utf8") <= 72,
        "Password exceeds bcrypt’s 72-byte limit",
      ),
  })
  .strict();
const optionalText = (max) => text(max).nullable().optional();
const httpsUrl = z
  .string()
  .url()
  .refine((s) => s.startsWith("https://"), "Use an HTTPS URL")
  .nullable()
  .optional();
const venueFields = {
  name: text(160),
  buildingName: optionalText(200),
  floor: optionalText(160),
  venueType: optionalText(160),
  capacity: z.number().int().positive().max(100000).nullable().optional(),
  features: optionalText(2000),
  allowedUses: optionalText(2000),
  imageUrl: httpsUrl,
  isActive: z.boolean().optional(),
  bookingEnabled: z.boolean().optional(),
  openingTime: time.nullable().optional(),
  closingTime: time.nullable().optional(),
};
export const venueCreateSchema = z.object(venueFields).strict();
export const venuePatchSchema = z
  .object(venueFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "No changes supplied");
export const assignmentSchema = z
  .object({
    approverIds: z
      .array(uuid)
      .max(50)
      .refine((a) => new Set(a).size === a.length, "Duplicate approver"),
  })
  .strict();
export const decisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: text(500).optional(),
  })
  .strict()
  .refine((v) => v.decision !== "REJECTED" || !!v.reason, {
    message: "Rejection requires a reason",
    path: ["reason"],
  });
export const cancelSchema = z.object({ reason: text(500).optional() }).strict();
export const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  search: z.string().trim().max(160).optional(),
  building: z.string().max(200).optional(),
  type: z.string().max(160).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "HISTORY"])
    .optional(),
});
export const calendarSchema = z.object({ from: date, to: date }).strict();
export function parse(schema, value) {
  return schema.parse(value);
}
