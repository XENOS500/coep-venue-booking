import { loadConfig } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { createApp } from "./app.js";
import { createEmailService } from "./services/email.service.js";
import { createDecisionEmailWorker } from "./services/decision-email.service.js";
const config = loadConfig();
await prisma.$connect();
const host = process.env.HOST || "0.0.0.0";
const emailService = createEmailService(config);
const notifications = createDecisionEmailWorker(prisma, emailService);
const server = createApp(prisma, config, {
  emailService, onDecision: () => { void notifications.wake(); },
}).listen(config.PORT, host, () =>
  console.log(`COEP API listening on port ${config.PORT}`),
);
notifications.start();
async function shutdown() {
  server.close(async () => {
    await notifications.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
