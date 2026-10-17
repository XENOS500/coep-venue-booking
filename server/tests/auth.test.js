import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
const secret = "unit-test-secret-at-least-32-characters";
const id = "8f269b2d-ab74-4ffa-8335-a45f084586bf";
test("authentication and authorization are independently enforced over HTTP", async (t) => {
  const account = {
    id,
    name: "Test",
    email: "test@example.com",
    passwordHash: await bcrypt.hash("Valid-password-123", 4),
    role: "REQUESTER",
    isActive: true,
    tokenVersion: 0,
  };
  const db = {
    account: {
      findUnique: async ({ where }) =>
        where.email === account.email || where.id === id ? account : null,
    },
  };
  const server = createApp(db, {
    JWT_SECRET: secret,
    CLIENT_ORIGIN: "http://127.0.0.1:5173",
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1`;
  const request = async (path, options = {}) => {
    const r = await fetch(url + path, options);
    return { status: r.status, body: await r.json() };
  };
  const login = (body) =>
    request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await login({ email: account.email, password: "incorrect" })).status,
    401,
  );
  assert.equal(
    (await login({ email: "unknown@example.com", password: "incorrect" }))
      .status,
    401,
  );
  assert.equal((await login({ email: account.email })).status, 400);
  const logged = await login({
    email: account.email,
    password: "Valid-password-123",
  });
  assert.equal(logged.status, 200);
  assert.equal("passwordHash" in logged.body.data.account, false);
  const auth = { Authorization: `Bearer ${logged.body.data.token}` };
  assert.equal((await request("/auth/me", { headers: auth })).status, 200);
  assert.equal((await request("/auth/me")).status, 401);
  assert.equal(
    (
      await request("/auth/me", {
        headers: { Authorization: "Bearer invalid" },
      })
    ).status,
    401,
  );
  const expired = jwt.sign({ version: 0 }, secret, {
    subject: id,
    expiresIn: -1,
    issuer: "coep-spaces",
    audience: "coep-web",
  });
  assert.equal(
    (
      await request("/auth/me", {
        headers: { Authorization: `Bearer ${expired}` },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/venues", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  account.role = "ADMIN"; // current DB role, not a stale token claim
  assert.equal((await request("/bookings", { headers: auth })).status, 403);
  account.isActive = false;
  assert.equal((await request("/auth/me", { headers: auth })).status, 401);
  account.isActive = true;
  account.tokenVersion++;
  assert.equal((await request("/auth/me", { headers: auth })).status, 401);
  assert.equal(
    (await request("/auth/register", { method: "POST" })).status,
    400, // Public requester signup still requires valid name/email/password.
  );
  assert.equal(
    (
      await request("/auth/me", {
        headers: { ...auth, Origin: "https://untrusted.example" },
      })
    ).status,
    403,
  );
});
test("local loopback origin aliases work during development while external origins remain blocked", async (t) => {
  const db = { $queryRaw: async () => [{ ok: 1 }] };
  const server = createApp(
    db,
    { JWT_SECRET: secret, CLIENT_ORIGIN: "http://127.0.0.1:5173" },
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/health`;
  const loopback = await fetch(url, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(loopback.status, 200);
  assert.equal(loopback.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const external = await fetch(url, { headers: { Origin: "http://localhost.localdomain:5173" } });
  assert.equal(external.status, 403);
});
test("login rate limiting returns safe 429 and retry metadata", async (t) => {
  const db = { account: { findUnique: async () => null } };
  const server = createApp(
    db,
    { JWT_SECRET: secret, CLIENT_ORIGIN: "http://127.0.0.1:5173" },
    { rateLimit: { max: 1 } },
  ).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/auth/login`;
  const opts = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "a@example.com", password: "incorrect" }),
  };
  assert.equal((await fetch(url, opts)).status, 401);
  const limited = await fetch(url, opts);
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
});
