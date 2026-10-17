import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

test("public liveness works without a database query while readiness checks the database", async (t) => {
  let queries = 0;
  const db = { $queryRaw: async () => { queries++; return [{ value: 1 }]; } };
  const server = createApp(db, {
    JWT_SECRET: "health-test-secret-at-least-32-characters",
    CLIENT_ORIGIN: "https://coep-venue-booking.vercel.app",
  }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const live = await fetch(`${base}/health/live`);
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { data: { status: "ok" } });
  assert.equal(queries, 0);
  const ready = await fetch(`${base}/health`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { data: { status: "ok" } });
  assert.equal(queries, 1);
});
