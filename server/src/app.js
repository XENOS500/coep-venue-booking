import express from "express";
import { security } from "./middlewares/security.js";
import { errorHandler } from "./middlewares/error.js";
import { apiRouter } from "./routes/api.js";
export function createApp(db, config, options) {
  const app = express();
  app.disable("x-powered-by");
  if (config.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(security(config.CLIENT_ORIGIN));
  app.use(express.json({ limit: "32kb" }));
  app.use("/api/v1", apiRouter(db, config, options));
  app.use((req, res) =>
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } }),
  );
  app.use(errorHandler);
  return app;
}
