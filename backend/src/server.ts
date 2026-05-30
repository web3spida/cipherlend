import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import profileRoutes from "./routes/profile";
import underwritingRoutes from "./routes/underwriting";
import loansRoutes from "./routes/loans";
import auditRoutes from "./routes/audit";
import permitsRoutes from "./routes/permits";
import decryptRoutes from "./routes/decrypt";
import reineiraRoutes from "./routes/reineira";
import { getProvider } from "./lib/fhenix";
import {
  assertProductionEnv,
  getAllowedOrigins,
  getMissingProductionEnv,
  isProduction,
  requestTimeout,
} from "./lib/runtime";
import { getMetricsSnapshot, recordRequestMetric } from "./lib/metrics";

assertProductionEnv();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = getAllowedOrigins();

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin && !isProduction()) {
        return callback(null, true);
      }
      if (origin && allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: false,
  })
);
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "2mb" }));

app.use((req, res, next) => {
  const requestId = req.header("x-request-id") ?? randomUUID();
  const startedAt = Date.now();
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    recordRequestMetric(`${req.method} ${req.path}`, res.statusCode, durationMs);
    console.info(
      JSON.stringify({
        level: res.statusCode >= 500 ? "error" : "info",
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        event: "request_finished",
      })
    );
  });
  next();
});

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    service: "cipherlend-api",
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (_, res) => {
  const missingEnv = getMissingProductionEnv();
  if (isProduction() && missingEnv.length > 0) {
    return res.status(503).json({
      status: "not_ready",
      missingEnv,
    });
  }

  try {
    const network = await requestTimeout(getProvider().getNetwork(), 5_000, "RPC readiness check");
    return res.json({
      status: "ready",
      chainId: network.chainId.toString(),
      chainName: network.name,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      status: "not_ready",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/metrics", (_, res) => {
  res.json(getMetricsSnapshot());
});

app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/underwriting", underwritingRoutes);
app.use("/api/v1/loans", loansRoutes);
app.use("/api/v1/audit", auditRoutes);
app.use("/api/v1/permits", permitsRoutes);
app.use("/api/v1/decrypt", decryptRoutes);
app.use("/api/v1/reineira", reineiraRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.message.includes("Origin is not allowed") ? 403 : 500;
  res.status(status).json({
    error: status === 500 && isProduction() ? "Internal server error" : err.message,
  });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`CipherLend backend listening on ${port}`);
});
