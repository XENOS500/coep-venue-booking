import { readFile } from "node:fs/promises";
import { prisma } from "../src/config/prisma.js";
try {
  const venues = JSON.parse(
    await readFile(new URL("./data/venues.json", import.meta.url), "utf8"),
  );
  // Idempotent insert only: re-seeding never overwrites admin verification or edits.
  let added = 0;
  for (const venue of venues) {
    const result = await prisma.venue.createMany({
      data: [venue],
      skipDuplicates: true,
    });
    added += result.count;
  }
  console.log(
    `Catalog seed complete: ${added} added, ${venues.length - added} already present. Bookings remain disabled until verified.`,
  );
} finally {
  await prisma.$disconnect();
}
