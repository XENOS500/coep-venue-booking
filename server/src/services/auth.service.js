import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fail } from "../utils/errors.js";
import { publicAccount } from "../middlewares/auth.js";
// A valid dummy hash ensures unknown accounts still perform bcrypt work.
const dummyHash = bcrypt.hashSync("dummy-account-password-for-timing-only", 12);
export function createAuthService(db, secret) {
  return {
    async login({ email, password }) {
      const account = await db.account.findUnique({ where: { email } });
      const matches = await bcrypt.compare(
        password,
        account?.passwordHash ?? dummyHash,
      );
      if (!matches || !account?.isActive)
        fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      return {
        token: jwt.sign({ version: account.tokenVersion }, secret, {
          algorithm: "HS256",
          subject: account.id,
          expiresIn: "2h",
          issuer: "coep-spaces",
          audience: "coep-web",
        }),
        account: publicAccount(account),
      };
    },
  };
}
