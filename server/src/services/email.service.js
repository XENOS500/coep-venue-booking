import { fail } from "../utils/errors.js";

export function createEmailService(config, request = fetch, clock = () => Date.now()) {
  let accessToken;
  let expiresAt = 0;
  let refreshing;
  async function getAccessToken() {
    if (accessToken && clock() < expiresAt) return accessToken;
    if (!refreshing) {
      refreshing = (async () => {
        const response = await request("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.GMAIL_CLIENT_ID,
            client_secret: config.GMAIL_CLIENT_SECRET,
            refresh_token: config.GMAIL_REFRESH_TOKEN,
            grant_type: "refresh_token",
          }).toString(),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("Gmail authorization failed");
        const credentials = await response.json();
        const lifetime = Number(credentials.expires_in);
        if (typeof credentials.access_token !== "string" || !credentials.access_token || !Number.isFinite(lifetime) || lifetime <= 0)
          throw new Error("Invalid Gmail authorization response");
        accessToken = credentials.access_token;
        expiresAt = clock() + Math.max(0, lifetime * 1000 - 60000);
        return accessToken;
      })();
    }
    const pending = refreshing;
    try { return await pending; }
    finally { if (refreshing === pending) refreshing = undefined; }
  }
  return {
    configured: !!(config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET && config.GMAIL_REFRESH_TOKEN && config.GMAIL_SENDER_EMAIL),
    async sendOtp({ email, code }) {
      if (!this.configured)
        fail(503, "EMAIL_NOT_CONFIGURED", "Email verification is not available yet. Please contact the administrator.");
      try {
        // Reject header injection even if a future internal caller bypasses
        // the registration schema. OAuth credentials never enter the email.
        if (/[\r\n]/.test(email + config.GMAIL_SENDER_EMAIL) || !/^\d{6}$/.test(code))
          throw new Error("Invalid OTP message");
        const token = await getAccessToken();
        const raw = Buffer.from([
          `From: COEP Spaces <${config.GMAIL_SENDER_EMAIL}>`,
          `To: ${email}`,
          "Subject: Verify your COEP Spaces email",
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: 7bit",
          "",
          `Your COEP Spaces verification code is ${code}.`,
          "It expires in 10 minutes. If you did not request this, ignore this email.",
          "Never share this code.",
          "",
        ].join("\r\n"), "utf8").toString("base64url");
        const response = await request("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          if (response.status === 401) { accessToken = undefined; expiresAt = 0; }
          throw new Error("Gmail rejected the request");
        }
      } catch {
        // Never expose/log Google responses, OAuth credentials or OTPs.
        // A network timeout can follow an accepted message; do not retry sends
        // automatically because that could deliver duplicate messages.
        fail(503, "EMAIL_DELIVERY_FAILED", "We could not send your code. Please wait one minute and try again.");
      }
    },
  };
}
