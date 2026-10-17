import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../src/config/prisma.js";
// Credentials are read from environment, never CLI arguments or source control.
const schema = z.object({
  ACCOUNT_EMAIL: z.string().trim().toLowerCase().email(),
  ACCOUNT_NAME: z.string().trim().min(1).max(120),
  ACCOUNT_ROLE: z.enum(["REQUESTER", "APPROVER", "ADMIN"]),
  ACCOUNT_PASSWORD: z
    .string()
    .min(12)
    .max(72)
    .refine((s) => Buffer.byteLength(s, "utf8") <= 72),
  ACCOUNT_ACTIVE: z.enum(["true", "false"]).default("true"),
});
try {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      "Set ACCOUNT_EMAIL, ACCOUNT_NAME, ACCOUNT_ROLE, ACCOUNT_PASSWORD (at least 12 characters, maximum 72 UTF-8 bytes), and optional ACCOUNT_ACTIVE.",
    );
  const input = result.data;
  const passwordHash = await bcrypt.hash(input.ACCOUNT_PASSWORD, 12);
  await prisma.$transaction(
    async (tx) => {
      // Maintenance tools must serialize with venue operations before altering assigned approvers.
      // Lock all venues in deterministic order, then the account table to serialize provisioning.
      await tx.$queryRaw`SELECT id FROM "Venue" ORDER BY id FOR UPDATE`;
      await tx.$executeRaw`LOCK TABLE "Account" IN SHARE ROW EXCLUSIVE MODE`;
      const existing = await tx.account.findUnique({
        where: { email: input.ACCOUNT_EMAIL },
      });
      const isActive = input.ACCOUNT_ACTIVE === "true";
      if (input.ACCOUNT_ROLE === "ADMIN") {
        const otherAdmin = await tx.account.findFirst({
          where: { role: "ADMIN", email: { not: input.ACCOUNT_EMAIL } },
          select: { id: true },
        });
        if (otherAdmin)
          throw new Error(
            "Only one administrator account is allowed. Update the existing administrator instead; REQUESTER and APPROVER accounts can have multiple users.",
          );
        if (!existing && !isActive)
          throw new Error("The administrator must be created as active.");
      }
      if (
        existing?.role === "ADMIN" &&
        existing.isActive &&
        (input.ACCOUNT_ROLE !== "ADMIN" || !isActive)
      ) {
        const count = await tx.account.count({
          where: { role: "ADMIN", isActive: true },
        });
        if (count <= 1)
          throw new Error(
            "Cannot deactivate or demote the last active administrator.",
          );
      }
      const fields = {
        name: input.ACCOUNT_NAME,
        role: input.ACCOUNT_ROLE,
        isActive,
        passwordHash,
      };
      const account = await tx.account.upsert({
        where: { email: input.ACCOUNT_EMAIL },
        create: { ...fields, email: input.ACCOUNT_EMAIL },
        update: { ...fields, tokenVersion: { increment: 1 } },
      });
      await tx.auditEvent.create({
        data: {
          actorId: account.id,
          entityType: "ACCOUNT",
          entityId: account.id,
          action: existing ? "MAINTENANCE_UPDATED" : "MAINTENANCE_CREATED",
          changes: {
            role: account.role,
            isActive: account.isActive,
            source: "trusted-maintenance-script",
          },
        },
      });
    },
    { timeout: 30000 },
  );
  console.log(
    "Account provisioned. Deliver credentials through an authorized private channel. Existing sessions were revoked on update.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  delete process.env.ACCOUNT_PASSWORD;
  await prisma.$disconnect();
}
