import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app.js";

// Run separately from workflow tests: it owns and clears its disposable database.
const connection = process.env.PERFORMANCE_DATABASE_URL;
test(
  "p95 catalog and availability under 2s with 100 venues, 1,000 occurrences and 10 clients",
  { skip: !connection },
  async (t) => {
    assert.match(new URL(connection).pathname, /\/[a-zA-Z0-9_-]+_perf_test$/);
    const db = new PrismaClient({ datasources: { db: { url: connection } } });
    const secret = "performance-test-secret-over-32-characters";
    const clear = () =>
      db.$executeRaw`TRUNCATE "BookingAction", "BookingOccurrence", "Booking", "VenueApprover", "AuditEvent", "Venue", "Account" CASCADE`;
    await clear();
    const users = Array.from({ length: 10 }, (_, i) => ({
      id: randomUUID(),
      name: `Load ${i}`,
      email: `load${i}@example.test`,
      role: "REQUESTER",
      passwordHash: "No-login-fixture",
    }));
    const approverId = randomUUID(),
      adminId = randomUUID();
    await db.account.createMany({
      data: [
        ...users,
        {
          id: approverId,
          name: "Load approver",
          email: "approver@load.test",
          role: "APPROVER",
          passwordHash: "No-login-fixture",
        },
        {
          id: adminId,
          name: "Load admin",
          email: "admin@load.test",
          role: "ADMIN",
          passwordHash: "No-login-fixture",
        },
      ],
    });
    const venues = Array.from({ length: 100 }, (_, i) => ({
      id: randomUUID(),
      name: `Load venue ${i}`,
      capacity: 100,
      bookingEnabled: true,
      openingTime: "08:00",
      closingTime: "20:00",
    }));
    await db.venue.createMany({ data: venues });
    await db.venueApprover.createMany({
      data: venues.map((v) => ({
        venueId: v.id,
        approverId,
        assignedBy: adminId,
      })),
    });
    const bookings = venues.map((v, i) => ({
      id: randomUUID(),
      venueId: v.id,
      requesterId: users[i % 10].id,
      eventTitle: "Load fixture",
      eventType: "Meeting",
      contactName: "Load",
      contactEmail: "load@example.test",
      contactPhone: "1234567890",
      guestCount: 10,
      eventDetails: "Load fixture",
      purpose: "Performance verification",
      startDate: "2030-10-17",
      endDate: "2030-10-26",
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      localStartTime: "09:00",
      localEndTime: "10:00",
    }));
    await db.booking.createMany({ data: bookings });
    await db.bookingOccurrence.createMany({
      data: bookings.flatMap((b) =>
        Array.from({ length: 10 }, (_, i) => ({
          bookingId: b.id,
          venueId: b.venueId,
          startsAt: new Date(`2030-10-${17 + i}T03:30:00Z`),
          endsAt: new Date(`2030-10-${17 + i}T04:30:00Z`),
        })),
      ),
    });
    const server = createApp(
      db,
      { JWT_SECRET: secret, CLIENT_ORIGIN: "http://127.0.0.1:5173" },
      { clock: () => new Date("2030-10-16T03:30:00Z") },
    ).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await clear();
      await db.$disconnect();
    });
    const timings = { catalog: [], availability: [] };
    await Promise.all(
      users.map(async (user, index) => {
        const token = jwt.sign({ version: 0 }, secret, {
          subject: user.id,
          expiresIn: "2h",
          issuer: "coep-spaces",
          audience: "coep-web",
        });
        for (let n = 0; n < 20; n++) {
          const kind = n % 2 ? "availability" : "catalog";
          const started = performance.now();
          const response = await fetch(
            `http://127.0.0.1:${server.address().port}/api/v1/${kind === "catalog" ? "venues?limit=24" : "availability/check"}`,
            {
              method: kind === "catalog" ? "GET" : "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              ...(kind === "availability"
                ? {
                    body: JSON.stringify({
                      venueId: venues[index].id,
                      startDate: "2030-10-17",
                      endDate: "2030-10-17",
                      weekdays: [],
                      localStartTime: "10:00",
                      localEndTime: "11:00",
                    }),
                  }
                : {}),
            },
          );
          assert.equal(response.status, 200);
          await response.json();
          timings[kind].push(performance.now() - started);
        }
      }),
    );
    for (const [kind, values] of Object.entries(timings)) {
      values.sort((a, b) => a - b);
      const p95 = values[Math.ceil(values.length * 0.95) - 1];
      t.diagnostic(
        `${kind}: ${values.length} requests, p95 ${p95.toFixed(1)} ms`,
      );
      assert.ok(p95 < 2000, `${kind} p95 ${p95} ms exceeds target`);
    }
  },
);
