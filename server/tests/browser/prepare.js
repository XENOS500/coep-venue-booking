// Prepare only a disposable database ending in _ui_test for browser verification.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_ui_test"))
  throw new Error(
    "Set TEST_DATABASE_URL to a migrated and seeded disposable database ending in _ui_test.",
  );
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  const accounts = {};
  for (const role of ["ADMIN", "APPROVER", "REQUESTER"]) {
    const password = randomBytes(18).toString("base64url");
    const email = `${role.toLowerCase()}.browser@example.test`;
    const account = await db.account.upsert({
      where: { email },
      create: {
        name: `${role[0]}${role.slice(1).toLowerCase()} Browser`,
        email,
        role,
        passwordHash: await bcrypt.hash(password, 4),
      },
      update: { passwordHash: await bcrypt.hash(password, 4), isActive: true },
    });
    accounts[role] = { email, password, id: account.id };
  }
  const venue = await db.venue.findUniqueOrThrow({
    where: { sourceSerial: 5 },
  });
  await mkdir(new URL("../../../.local/", import.meta.url), {
    recursive: true,
  });
  await writeFile(
    new URL("../../../.local/browser-fixtures.json", import.meta.url),
    JSON.stringify({ accounts, venueId: venue.id }),
  );
  console.log("Browser fixtures prepared in the ignored .local directory.");
} finally {
  await db.$disconnect();
}
