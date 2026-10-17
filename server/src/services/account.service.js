import bcrypt from "bcryptjs";
import { fail } from "../utils/errors.js";
import { publicAccount } from "../middlewares/auth.js";
import { currentActor } from "./booking.service.js";

export function createAccountService(db) {
  async function adminWrite(actor, operation) {
    return db.$transaction(async tx => {
      // Use the same lock order as maintenance provisioning and assignments.
      await tx.$queryRaw`SELECT id FROM "Venue" ORDER BY id FOR UPDATE`;
      await tx.$executeRaw`LOCK TABLE "Account" IN SHARE ROW EXCLUSIVE MODE`;
      await currentActor(tx, actor, "ADMIN");
      return operation(tx);
    }, { timeout: 30000 });
  }
  async function audit(tx, actor, account, action) {
    await tx.auditEvent.create({ data: {
      actorId: actor.id, entityType: "ACCOUNT", entityId: account.id, action,
      changes: { role: "APPROVER", isActive: account.isActive },
    } });
  }
  return {
    async list(actor, { page, limit, search }) {
      const where = { role: "APPROVER", ...(search ? { OR: ["name", "email"].map(field => ({ [field]: { contains: search, mode: "insensitive" } })) } : {}) };
      const [rows, total] = await db.$transaction([
        db.account.findMany({ where, select: { id: true, name: true, email: true, role: true, isActive: true }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit }),
        db.account.count({ where }),
      ]);
      return { data: rows, pagination: { page, limit, total } };
    },
    async createApprover(actor, { name, email, password }) {
      const passwordHash = await bcrypt.hash(password, 12);
      return adminWrite(actor, async tx => {
        const existing = await tx.account.findUnique({ where: { email } });
        if (existing?.role === "ADMIN") fail(403, "ADMIN_PROTECTED", "The administrator account cannot be changed here.");
        if (existing?.role === "APPROVER") fail(409, "EMAIL_IN_USE", "This approver already exists. Use its account controls to reset credentials.");
        const account = existing
          ? await tx.account.update({ where: { id: existing.id }, data: { name, role: "APPROVER", isActive: true, passwordHash, tokenVersion: { increment: 1 } } })
          : await tx.account.create({ data: { name, email, passwordHash, role: "APPROVER" } });
        await audit(tx, actor, account, existing ? "PROMOTED_TO_APPROVER" : "APPROVER_CREATED");
        return { ...publicAccount(account), isActive: account.isActive };
      });
    },
    async updateApprover(actor, id, input) {
      const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
      return adminWrite(actor, async tx => {
        const existing = await tx.account.findUnique({ where: { id } });
        if (!existing || existing.role !== "APPROVER") fail(404, "NOT_FOUND", "Approver account not found.");
        const account = await tx.account.update({ where: { id }, data: {
          ...(passwordHash ? { passwordHash } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          tokenVersion: { increment: 1 },
        } });
        await audit(tx, actor, account, passwordHash ? "APPROVER_PASSWORD_RESET" : "APPROVER_STATUS_CHANGED");
        return { ...publicAccount(account), isActive: account.isActive };
      });
    },
  };
}
