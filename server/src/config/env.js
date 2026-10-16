import { z } from "zod";
export function loadConfig(env = process.env) {
  const parsed = z
    .object({
      DATABASE_URL: z.string().url(),
      JWT_SECRET: z.string().min(32),
      PORT: z.coerce.number().int().min(1).max(65535).default(4000),
      CLIENT_ORIGIN: z.string().url().default("http://127.0.0.1:5173"),
      TRUST_PROXY: z.enum(["0", "1"]).default("0"),
    })
    .safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid server environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  return parsed.data;
}
