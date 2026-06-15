import express from "express";
import cors from "cors";
import { config } from "./config";
import { pool } from "./lib/db";
import { authRouter } from "./routes/auth";
import { classesRouter } from "./routes/classes";
import { sessionsRouter } from "./routes/sessions";
import { attendanceRouter } from "./routes/attendance";

const app = express();

// Descriptors + base64 photos can be large-ish; raise the JSON limit.
app.use(express.json({ limit: "5mb" }));
app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
  })
);

// Health check — used by Caddy / load checks and by the rebuild script.
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

app.use("/auth", authRouter);
app.use("/classes", classesRouter);
app.use("/sessions", sessionsRouter);
app.use("/attendance", attendanceRouter);

// Centralized error handler.
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
});
