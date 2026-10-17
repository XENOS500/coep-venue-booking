import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { api, signIn, errorMessage } from "../../client/src/services/api.js";

test("a slow first login can finish without extending other requests or retrying credentials", async (t) => {
  let logins = 0;
  const server = createServer((req, res) => {
    if (req.url === "/auth/login") logins++;
    setTimeout(() => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ data: { token: "test-token" } }));
    }, 200);
  }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const original = { baseURL: api.defaults.baseURL, timeout: api.defaults.timeout };
  t.after(async () => {
    Object.assign(api.defaults, original);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  api.defaults.baseURL = `http://127.0.0.1:${server.address().port}`;
  api.defaults.timeout = 30;
  assert.deepEqual(await signIn({ email: "test@example.com", password: "test" }), {
    token: "test-token",
  });
  assert.equal(logins, 1);
  await assert.rejects(api.get("/venues"), error => error.code === "ECONNABORTED");
  assert.equal(api.defaults.timeout, 30);
  assert.match(errorMessage({ code: "ECONNABORTED" }), /try again/i);
});
