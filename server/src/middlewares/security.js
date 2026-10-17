import { fail } from "../utils/errors.js";
export function security(origin) {
  const configured = Array.isArray(origin) ? origin : [origin];
  const allowedOrigins = new Set(configured.filter(Boolean));
  // Browsers treat localhost and 127.0.0.1 as different origins. Allow only
  // their explicit loopback aliases during local development; production
  // origins remain exact matches from CLIENT_ORIGIN.
  for (const value of configured) {
    try {
      const url = new URL(value);
      if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
        const alias = new URL(url);
        alias.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
        allowedOrigins.add(alias.origin);
      }
    } catch {
      // Environment validation reports malformed CLIENT_ORIGIN at startup.
    }
  }
  return (req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    });
    if (req.secure)
      res.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    if (req.headers.origin && !allowedOrigins.has(req.headers.origin))
      return next(
        Object.assign(new Error("Origin is not allowed."), {
          status: 403,
          code: "UNTRUSTED_ORIGIN",
        }),
      );
    if (req.headers.origin && allowedOrigins.has(req.headers.origin))
      res.set({
        "Access-Control-Allow-Origin": req.headers.origin,
        Vary: "Origin",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, OPTIONS",
      });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  };
}
export function loginLimiter({ max = 10, windowMs = 900000 } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts)
      if (value.reset <= now) attempts.delete(key);
    const key = req.ip;
    const record = attempts.get(key) ?? { count: 0, reset: now + windowMs };
    if (!attempts.has(key) && attempts.size >= 10000) {
      res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
      try {
        fail(
          429,
          "TOO_MANY_ATTEMPTS",
          "Too many sign-in attempts. Try again later.",
        );
      } catch (e) {
        return next(e);
      }
    }
    record.count++;
    attempts.set(key, record);
    if (record.count > max) {
      res.set("Retry-After", String(Math.ceil((record.reset - now) / 1000)));
      try {
        fail(
          429,
          "TOO_MANY_ATTEMPTS",
          "Too many sign-in attempts. Try again later.",
        );
      } catch (e) {
        return next(e);
      }
    }
    next();
  };
}
