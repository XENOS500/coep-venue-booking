import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createApp } from "../../src/app.js";
const connection = process.env.TEST_DATABASE_URL;
const secret = "integration-test-secret-at-least-32-characters";
test(
  "PostgreSQL HTTP workflows, concurrent transactions and privacy",
  { skip: !connection },
  async (t) => {
    const parsed = new URL(connection);
    assert.match(
      parsed.pathname,
      /\/[a-zA-Z0-9_-]+_test$/,
      "TEST_DATABASE_URL must name a disposable database ending in _test",
    );
    const db = new PrismaClient({ datasources: { db: { url: connection } } });
    async function clear() {
      await db.$executeRaw`TRUNCATE "BookingAction", "BookingOccurrence", "Booking", "VenueApprover", "AuditEvent", "Venue", "Account" CASCADE`;
    }
    await clear();
    const server = createApp(
      db,
      { JWT_SECRET: secret, CLIENT_ORIGIN: "http://127.0.0.1:5173" },
      {
        clock: () => new Date("2030-10-16T03:30:00Z"),
        rateLimit: { max: 100 },
      },
    ).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await clear();
      await db.$disconnect();
    });
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const passwordHash = await bcrypt.hash("Integration-only-password", 4);
    const accounts = {};
    for (const [key, role] of [
      ["requester", "REQUESTER"],
      ["other", "REQUESTER"],
      ["approver", "APPROVER"],
      ["unassigned", "APPROVER"],
      ["admin", "ADMIN"],
    ]) {
      const a = await db.account.create({
        data: { name: key, email: `${key}@example.com`, role, passwordHash },
      });
      accounts[key] = {
        ...a,
        token: jwt.sign({ version: 0 }, secret, {
          subject: a.id,
          expiresIn: "2h",
          issuer: "coep-spaces",
          audience: "coep-web",
        }),
      };
    }
    async function request(
      path,
      { as = "requester", method = "GET", body } = {},
    ) {
      const r = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${accounts[as].token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    }
    async function venue() {
      const r = await request("/venues", {
        as: "admin",
        method: "POST",
        body: {
          name: "Integration room",
          buildingName: "Test building",
          capacity: 72,
          openingTime: "08:00",
          closingTime: "20:00",
          bookingEnabled: true,
        },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const id = r.body.data.id;
      const assigned = await request(`/venues/${id}/approvers`, {
        as: "admin",
        method: "PUT",
        body: { approverIds: [accounts.approver.id] },
      });
      assert.equal(assigned.status, 200);
      return id;
    }
    const input = (venueId, overrides = {}) => ({
      venueId,
      startDate: "2030-10-17",
      endDate: "2030-10-17",
      weekdays: [],
      localStartTime: "10:00",
      localEndTime: "11:00",
      eventTitle: "Private workshop",
      eventType: "Workshop",
      contactName: "Private contact",
      contactEmail: "private@example.com",
      contactPhone: "+91 98765 43210",
      guestCount: 50,
      eventDetails: "Private event details",
      purpose: "Private purpose",
      ...overrides,
    });
    const create = (id, overrides = {}, as = "requester") =>
      request("/bookings", { as, method: "POST", body: input(id, overrides) });
    await t.test(
      "complete request → approve → calendar → cancellation flow with audits",
      async () => {
        const id = await venue();
        const created = await create(id);
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const b = created.body.data;
        assert.equal(b.status, "PENDING");
        assert.equal(b.guestCount, 50);
        assert.equal(b.contactEmail, "private@example.com");
        assert.equal(b.occurrences.length, 1);
        const preview = await request("/availability/check", {
          method: "POST",
          body: {
            venueId: id,
            startDate: "2030-10-17",
            endDate: "2030-10-17",
            weekdays: [],
            localStartTime: "10:00",
            localEndTime: "11:00",
          },
        });
        assert.equal(preview.body.data.available, false);
        const decision = await request(`/bookings/${b.id}/decision`, {
          as: "approver",
          method: "POST",
          body: { decision: "APPROVED" },
        });
        assert.equal(decision.status, 200, JSON.stringify(decision.body));
        assert.equal(decision.body.data.status, "APPROVED");
        assert.equal(decision.body.data.actions.length, 2);
        assert.equal((await create(id)).status, 409);
        const calendar = await request(
          "/calendar?from=2030-10-16&to=2030-10-20",
          { as: "admin" },
        );
        assert.equal(calendar.status, 200);
        assert.equal(
          calendar.body.data.find((o) => o.venueId === id).status,
          "APPROVED",
        );
        const cancelled = await request(`/bookings/${b.id}/cancel`, {
          method: "POST",
          body: { reason: "Plans changed" },
        });
        assert.equal(cancelled.status, 200);
        assert.equal(cancelled.body.data.status, "CANCELLED");
        assert.equal((await create(id)).status, 201);
      },
    );
    await t.test(
      "role, assignment, ownership and calendar privacy are enforced",
      async () => {
        const id = await venue();
        const b = (await create(id)).body.data;
        for (const as of ["admin", "approver", "unassigned"])
          assert.equal((await create(id, {}, as)).status, 403);
        for (const as of ["other", "unassigned"])
          assert.equal(
            (await request(`/bookings/${b.id}`, { as })).status,
            404,
          );
        assert.equal(
          (await request(`/bookings/${b.id}`, { as: "admin" })).status,
          403,
        );
        assert.equal(
          (
            await request(`/bookings/${b.id}/cancel`, {
              as: "other",
              method: "POST",
              body: {},
            })
          ).status,
          404,
        );
        for (const as of ["admin", "approver"])
          assert.equal(
            (
              await request(`/bookings/${b.id}/cancel`, {
                as,
                method: "POST",
                body: { reason: "override" },
              })
            ).status,
            403,
          );
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              as: "unassigned",
              method: "POST",
              body: { decision: "APPROVED" },
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              as: "admin",
              method: "POST",
              body: { decision: "APPROVED" },
            })
          ).status,
          403,
        );
        for (const as of ["other", "admin", "unassigned"]) {
          const r = await request("/calendar?from=2030-10-16&to=2030-10-20", {
            as,
          });
          const serialized = JSON.stringify(r.body);
          for (const privateValue of [
            "Private workshop",
            "Private contact",
            "private@example.com",
            "Private purpose",
            "Private event details",
            "contactPhone",
            "guestCount",
            "requesterId",
          ])
            assert.equal(serialized.includes(privateValue), false);
          assert.equal(
            "bookingId" in r.body.data.find((o) => o.venueId === id),
            false,
          );
        }
        const conflict = await create(id, {}, "other");
        assert.equal(conflict.status, 409);
        assert.equal(
          JSON.stringify(conflict.body).includes("private@example.com"),
          false,
        );
        const scoped = await request("/bookings", { as: "unassigned" });
        assert.equal(scoped.body.pagination.total, 0);
        assert.equal(
          (
            await request("/venues", {
              as: "requester",
              method: "POST",
              body: { name: "Denied" },
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "concurrent overlapping submissions produce exactly one pending reservation",
      async () => {
        const id = await venue();
        const responses = await Promise.all([
          create(id),
          create(id, {}, "other"),
        ]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
        assert.equal(await db.booking.count({ where: { venueId: id } }), 1);
      },
    );
    await t.test(
      "adjacent intervals are allowed; recurring conflicts roll back the entire series",
      async () => {
        const id = await venue();
        assert.equal((await create(id)).status, 201);
        assert.equal(
          (await create(id, { localStartTime: "11:00", localEndTime: "12:00" }))
            .status,
          201,
        );
        const series = await create(id, {
          startDate: "2030-10-17",
          endDate: "2030-10-24",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        });
        assert.equal(series.status, 409);
        assert.equal(await db.booking.count({ where: { venueId: id } }), 2);
        assert.equal(
          await db.bookingOccurrence.count({ where: { venueId: id } }),
          2,
        );
      },
    );
    await t.test(
      "recurrence is approved and cancelled as one series, with every hold released",
      async () => {
        const id = await venue();
        const b = (
          await create(id, {
            endDate: "2030-10-23",
            weekdays: [1, 2, 3, 4, 5, 6, 7],
          })
        ).body.data;
        assert.equal(b.occurrences.length, 7);
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              as: "approver",
              method: "POST",
              body: { decision: "APPROVED" },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`/bookings/${b.id}/cancel`, {
              method: "POST",
              body: {},
            })
          ).status,
          200,
        );
        const r = await create(id, {
          endDate: "2030-10-23",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        });
        assert.equal(r.status, 201);
        assert.equal(r.body.data.occurrences.length, 7);
      },
    );
    await t.test(
      "concurrent decisions are final once; rejection requires a reason",
      async () => {
        const id = await venue();
        const b = (await create(id)).body.data;
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              as: "approver",
              method: "POST",
              body: { decision: "REJECTED" },
            })
          ).status,
          400,
        );
        const r = await Promise.all(
          ["APPROVED", "REJECTED"].map((decision) =>
            request(`/bookings/${b.id}/decision`, {
              as: "approver",
              method: "POST",
              body: { decision, reason: "Review reason" },
            }),
          ),
        );
        assert.deepEqual(r.map((v) => v.status).sort(), [200, 409]);
        assert.equal(
          await db.bookingAction.count({ where: { bookingId: b.id } }),
          2,
        );
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              as: "approver",
              method: "POST",
              body: { decision: "APPROVED" },
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "removing assignment revokes private access and blocks new requests until reassignment",
      async () => {
        const id = await venue();
        const b = (await create(id)).body.data;
        assert.equal(
          (
            await request(`/venues/${id}/approvers`, {
              as: "admin",
              method: "PUT",
              body: { approverIds: [] },
            })
          ).status,
          200,
        );
        assert.equal(
          (await request(`/bookings/${b.id}`, { as: "approver" })).status,
          404,
        );
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              as: "approver",
              method: "POST",
              body: { decision: "APPROVED" },
            })
          ).status,
          404,
        );
        assert.equal(
          (await create(id, { localStartTime: "12:00", localEndTime: "13:00" }))
            .status,
          400,
        );
        assert.equal(
          (
            await request(`/venues/${id}/approvers`, {
              as: "admin",
              method: "PUT",
              body: { approverIds: [accounts.approver.id] },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              as: "approver",
              method: "POST",
              body: { decision: "APPROVED" },
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "venue changes cannot invalidate pending holds or approved reservations",
      async () => {
        const id = await venue();
        const b = (await create(id)).body.data;
        for (const body of [
          { isActive: false },
          { bookingEnabled: false },
          { capacity: 10 },
          { openingTime: "10:30" },
          { closingTime: "10:30" },
        ])
          assert.equal(
            (
              await request(`/venues/${id}`, {
                as: "admin",
                method: "PATCH",
                body,
              })
            ).status,
            409,
          );
        assert.equal(
          (
            await request(`/venues/${id}`, {
              as: "admin",
              method: "PATCH",
              body: { capacity: 80 },
            })
          ).status,
          200,
        );
        await request(`/bookings/${b.id}/cancel`, { method: "POST", body: {} });
        assert.equal(
          (
            await request(`/venues/${id}`, {
              as: "admin",
              method: "PATCH",
              body: { isActive: false },
            })
          ).status,
          200,
        );
        assert.equal((await create(id)).status, 400);
      },
    );
    await t.test(
      "self-decision remains forbidden after a requester becomes an assigned approver",
      async () => {
        const id = await venue();
        const b = (await create(id)).body.data;
        await db.account.update({
          where: { id: accounts.requester.id },
          data: { role: "APPROVER" },
        });
        await request(`/venues/${id}/approvers`, {
          as: "admin",
          method: "PUT",
          body: { approverIds: [accounts.requester.id] },
        });
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              method: "POST",
              body: { decision: "APPROVED" },
            })
          ).status,
          403,
        );
        await db.account.update({
          where: { id: accounts.requester.id },
          data: { role: "REQUESTER" },
        });
      },
    );
    await t.test(
      "started requests cannot be decided or cancelled",
      async () => {
        const id = await venue();
        const b = (await create(id)).body.data;
        await db.bookingOccurrence.updateMany({
          where: { bookingId: b.id },
          data: {
            startsAt: new Date("2030-10-16T02:00:00Z"),
            endsAt: new Date("2030-10-16T03:00:00Z"),
          },
        });
        assert.equal(
          (
            await request(`/bookings/${b.id}/decision`, {
              as: "approver",
              method: "POST",
              body: { decision: "APPROVED" },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(`/bookings/${b.id}/cancel`, {
              method: "POST",
              body: {},
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "trusted maintenance provisions accounts, revokes sessions and protects the last admin",
      async () => {
        const serverDirectory = fileURLToPath(
          new URL("../../", import.meta.url),
        );
        function provision(email, role, active = "true") {
          return spawnSync(process.execPath, ["scripts/provision-account.js"], {
            cwd: serverDirectory,
            encoding: "utf8",
            env: {
              ...process.env,
              DATABASE_URL: connection,
              ACCOUNT_EMAIL: email,
              ACCOUNT_NAME: "Maintenance test",
              ACCOUNT_ROLE: role,
              ACCOUNT_PASSWORD: "Maintenance-test-password-123",
              ACCOUNT_ACTIVE: active,
            },
          });
        }
        const blocked = provision(accounts.admin.email, "REQUESTER");
        assert.equal(blocked.status, 1);
        assert.match(blocked.stderr, /last active administrator/);
        assert.equal(
          (await db.account.findUnique({ where: { id: accounts.admin.id } }))
            .role,
          "ADMIN",
        );
        assert.equal(
          provision("maintenance@example.test", "REQUESTER").status,
          0,
        );
        const created = await db.account.findUnique({
          where: { email: "maintenance@example.test" },
        });
        assert.equal(created.tokenVersion, 0);
        assert.notEqual(created.passwordHash, "Maintenance-test-password-123");
        assert.equal(
          provision("maintenance@example.test", "APPROVER", "false").status,
          0,
        );
        const updated = await db.account.findUnique({
          where: { id: created.id },
        });
        assert.equal(updated.role, "APPROVER");
        assert.equal(updated.isActive, false);
        assert.equal(updated.tokenVersion, 1);
        const audit = await db.auditEvent.findMany({
          where: { entityId: created.id },
        });
        assert.equal(audit.length, 2);
        assert.equal(
          JSON.stringify(audit).includes("Maintenance-test-password-123"),
          false,
        );
      },
    );
    await t.test(
      "database check constraints reject invalid capacity and occurrence ordering",
      async () => {
        const id = await venue();
        await assert.rejects(
          db.venue.update({ where: { id }, data: { capacity: 0 } }),
        );
        const b = (await create(id)).body.data;
        await assert.rejects(
          db.bookingOccurrence.update({
            where: { id: b.occurrences[0].id },
            data: { endsAt: new Date("2030-10-17T00:00:00Z") },
          }),
        );
      },
    );
  },
);
