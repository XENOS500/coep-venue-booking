import jwt from "jsonwebtoken";
import { fail } from "../utils/errors.js";
export const publicAccount = (a) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
});
export function authenticate(db, secret) {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
      if (!token) fail(401, "UNAUTHENTICATED", "Sign in to continue.");
      let payload;
      try {
        payload = jwt.verify(token, secret, {
          algorithms: ["HS256"],
          issuer: "coep-spaces",
          audience: "coep-web",
        });
      } catch {
        fail(
          401,
          "INVALID_TOKEN",
          "Your session is invalid or expired. Sign in again.",
        );
      }
      if (
        typeof payload.sub !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(payload.sub)
      )
        fail(401, "INVALID_TOKEN", "Invalid session.");
      const account = await db.account.findUnique({
        where: { id: payload.sub },
      });
      if (!account?.isActive || account.tokenVersion !== payload.version)
        fail(401, "SESSION_REVOKED", "Your session has ended. Sign in again.");
      req.account = account;
      next();
    } catch (e) {
      next(e);
    }
  };
}
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.account.role))
      return next(
        Object.assign(
          new Error("This action is not available for your role."),
          { status: 403, code: "FORBIDDEN" },
        ),
      );
    next();
  };
