import bcrypt from "bcryptjs";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { fail } from "../utils/errors.js";

const MINUTE = 60000;
export function createRegistrationService(db, secret, emailService, clock = () => new Date()) {
  const digest = (id, code) => createHmac("sha256", secret)
    .update(`registration:${id}:${code}`).digest("hex");

  async function issue({ input, registrationId }) {
    if (!emailService.configured)
      fail(503, "EMAIL_NOT_CONFIGURED", "Email verification is not available yet. Please contact the administrator.");
    const passwordHash = input ? await bcrypt.hash(input.password, 12) : null;
    const now = clock();
    const result = await db.$transaction(async tx => {
      let pending;
      if (input) {
        // Serialize first requests and resends for the same email, including
        // when a pending row does not exist yet.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.email})::bigint)`;
        if (await tx.account.findUnique({ where: { email: input.email } }))
          fail(409, "EMAIL_IN_USE", "An account already uses this email. Please sign in or contact the administrator.");
        pending = await tx.pendingRegistration.findUnique({ where: { email: input.email } });
      } else {
        const found = await tx.pendingRegistration.findUnique({ where: { id: registrationId } });
        if (!found) fail(400, "INVALID_REGISTRATION", "Please start registration again.");
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.email})::bigint)`;
        pending = await tx.pendingRegistration.findUnique({ where: { id: registrationId } });
        if (!pending) fail(400, "INVALID_REGISTRATION", "Please start registration again.");
      }
      if (pending && +now - +pending.sentAt < MINUTE)
        fail(429, "RESEND_TOO_SOON", "Please wait one minute before requesting another code.");
      const sameWindow = pending && +now - +pending.windowStart < 60 * MINUTE;
      if (sameWindow && pending.sendCount >= 5)
        fail(429, "EMAIL_LIMIT", "Too many codes requested. Please try again in an hour.");
      // A restarted signup is a new intent, possibly from a different browser.
      // Rotate its ID so one browser cannot verify another browser's password.
      const id = input ? randomUUID() : pending.id;
      const code = String(randomInt(0, 1000000)).padStart(6, "0");
      const values = {
        name: input?.name || pending.name,
        passwordHash: passwordHash || pending.passwordHash,
        otpHash: digest(id, code),
        expiresAt: new Date(+now + 10 * MINUTE),
        attempts: 0,
        sentAt: now,
        sendCount: sameWindow ? pending.sendCount + 1 : 1,
        windowStart: sameWindow ? pending.windowStart : now,
      };
      // Registration verification takes the same advisory lock. A resend can
      // never replace a code midway through account creation.
      const row = await tx.pendingRegistration.upsert({
        where: { email: input?.email || pending.email },
        create: { id, email: input?.email || pending.email, ...values },
        update: { ...values, id },
      });
      return { row, code };
    }, { timeout: 10000 });
    await emailService.sendOtp({
      email: result.row.email, code: result.code,
      deliveryId: `registration-${result.row.id}-${result.row.sentAt.getTime()}`,
    });
    return { registrationId: result.row.id, email: result.row.email, expiresInSeconds: 600, resendAfterSeconds: 60 };
  }

  return {
    request: input => issue({ input }),
    resend: registrationId => issue({ registrationId }),
    async verify({ registrationId, code }) {
      const outcome = await db.$transaction(async tx => {
        const found = await tx.pendingRegistration.findUnique({ where: { id: registrationId } });
        if (!found) return "invalid";
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.email})::bigint)`;
        const pending = await tx.pendingRegistration.findUnique({ where: { id: registrationId } });
        if (!pending || pending.attempts >= 5 || +pending.expiresAt <= +clock()) return "invalid";
        const matches = timingSafeEqual(Buffer.from(pending.otpHash, "hex"), Buffer.from(digest(registrationId, code), "hex"));
        if (!matches) {
          await tx.pendingRegistration.update({ where: { id: registrationId }, data: { attempts: { increment: 1 } } });
          return "invalid"; // Return rather than throw so the failed attempt commits.
        }
        if (await tx.account.findUnique({ where: { email: pending.email } })) return "exists";
        const account = await tx.account.create({ data: {
          name: pending.name, email: pending.email, passwordHash: pending.passwordHash,
          role: "REQUESTER", emailVerifiedAt: clock(),
        } });
        await tx.auditEvent.create({ data: {
          actorId: account.id, entityType: "ACCOUNT", entityId: account.id,
          action: "REQUESTER_REGISTERED", changes: { role: "REQUESTER", source: "verified-email" },
        } });
        await tx.pendingRegistration.delete({ where: { id: registrationId } });
        return "created";
      });
      if (outcome === "exists") fail(409, "EMAIL_IN_USE", "An account already uses this email. Please sign in.");
      if (outcome !== "created") fail(400, "INVALID_OTP", "The code is incorrect, expired, or has reached its attempt limit. Request a new code.");
      return { message: "Email verified. Your requester account is ready. Please sign in." };
    },
  };
}
