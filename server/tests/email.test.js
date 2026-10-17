import test from "node:test";
import assert from "node:assert/strict";
import { createEmailService } from "../src/services/email.service.js";
import { createRegistrationService } from "../src/services/registration.service.js";

const config = {
  GMAIL_CLIENT_ID: "test-client", GMAIL_CLIENT_SECRET: "test-secret",
  GMAIL_REFRESH_TOKEN: "test-refresh", GMAIL_SENDER_EMAIL: "sender@gmail.com",
};

test("Gmail OTP delivery refreshes OAuth credentials over HTTPS and sends a base64url MIME message", async () => {
  const calls = [];
  const email = createEmailService(config, async (...args) => {
    calls.push(args);
    if (args[0].includes("oauth2")) return { ok: true, json: async () => ({ access_token: "access-token", expires_in: 3600 }) };
    return { ok: true };
  });
  await email.sendOtp({ email: "student@yahoo.com", code: "123456" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "https://oauth2.googleapis.com/token");
  const tokenRequest = new URLSearchParams(calls[0][1].body);
  assert.equal(tokenRequest.get("client_secret"), "test-secret");
  assert.equal(tokenRequest.get("refresh_token"), "test-refresh");
  assert.equal(tokenRequest.get("grant_type"), "refresh_token");
  assert.equal(calls[1][0], "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  assert.equal(calls[1][1].headers.Authorization, "Bearer access-token");
  assert.ok(calls[0][1].signal);
  assert.ok(calls[1][1].signal);
  const message = Buffer.from(JSON.parse(calls[1][1].body).raw, "base64url").toString("utf8");
  assert.match(message, /From: COEP Spaces <sender@gmail.com>\r\n/);
  assert.match(message, /To: student@yahoo.com\r\n/);
  assert.match(message, /123456/);
  assert.equal(/test-secret|test-refresh|access-token/.test(message), false);
});

test("parallel OTPs share one token refresh and expired tokens are refreshed", async () => {
  let now = 0;
  let tokens = 0;
  let sends = 0;
  const email = createEmailService(config, async url => {
    if (url.includes("oauth2")) { tokens++; return { ok: true, json: async () => ({ access_token: "cached-token", expires_in: 3600 }) }; }
    sends++; return { ok: true };
  }, () => now);
  await Promise.all([1, 2].map(() => email.sendOtp({ email: "student@gmail.com", code: "123456" })));
  assert.equal(tokens, 1);
  assert.equal(sends, 2);
  now = 3600000;
  await email.sendOtp({ email: "student@coeptech.ac.in", code: "123456" });
  assert.equal(tokens, 2);
  assert.equal(sends, 3);
});

test("missing email configuration prevents registration before any database writes", async () => {
  const service = createRegistrationService({}, "test-secret", createEmailService({}));
  await assert.rejects(service.request({ email: "student@coeptech.ac.in" }), error => error.code === "EMAIL_NOT_CONFIGURED" && error.status === 503);
});

test("Gmail send failures are not automatically retried and return a safe error", async () => {
  let sends = 0;
  const email = createEmailService(config, async url => {
    if (url.includes("oauth2")) return { ok: true, json: async () => ({ access_token: "token", expires_in: 3600 }) };
    sends++;
    throw new Error("test-secret code=123456");
  });
  await assert.rejects(email.sendOtp({ email: "student@coeptech.ac.in", code: "123456", deliveryId: "test" }), error => {
    assert.equal(error.status, 503);
    assert.equal(error.code, "EMAIL_DELIVERY_FAILED");
    assert.equal(/test-secret|123456/.test(error.message), false);
    return true;
  });
  assert.equal(sends, 1);
});

test("expired or revoked refresh tokens prevent sending and header injection is rejected", async () => {
  let calls = 0;
  const email = createEmailService(config, async () => { calls++; return { ok: false, status: 400 }; });
  await assert.rejects(email.sendOtp({ email: "student@gmail.com", code: "123456" }), error => error.code === "EMAIL_DELIVERY_FAILED");
  assert.equal(calls, 1);
  await assert.rejects(email.sendOtp({ email: "student@gmail.com\r\nBcc: other@gmail.com", code: "123456" }), error => error.code === "EMAIL_DELIVERY_FAILED");
  assert.equal(calls, 1);
});
