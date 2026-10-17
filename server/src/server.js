import { loadConfig } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { createApp } from "./app.js";
const config = loadConfig();
await prisma.$connect();
const host = process.env.HOST || "0.0.0.0";
const server = createApp(prisma, config).listen(config.PORT, host, () =>
  console.log(`COEP API listening on port ${config.PORT}`),
);
async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
