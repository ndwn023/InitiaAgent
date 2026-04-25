import dotenv from "dotenv";
import path from "path";
// Load from monorepo root .env (works for ts-node-dev and compiled dist/)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { startAgentWorker } from "./lib/agent-worker";
import cors from "cors";

import { RequestValidationError } from "@initia-agent/shared";
import agentsRouter from "./routes/agents";
import analyzeRouter from "./routes/analyze";
import executeRouter from "./routes/execute";
import chatRouter from "./routes/chat";
import lpFeeRouter from "./routes/lp-fee";
import dashboardRouter from "./routes/dashboard";
import skillsRouter from "./routes/skills";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const IS_PROD = process.env.NODE_ENV === "production";
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);

// ─── Security & Performance Middleware ─────────────────────────────────────────

// HTTP security headers (production-grade)
app.use(helmet({
  contentSecurityPolicy: false, // disable for API-only server
  crossOriginEmbedderPolicy: false,
  // HSTS: force HTTPS for 1 year in production
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// Additional headers not covered by helmet
app.use((_req, res, next) => {
  res.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.set("X-DNS-Prefetch-Control", "off");
  next();
});

// Gzip/Brotli response compression — reduces payload 60-80%
app.use(compression({
  threshold: 1024, // only compress responses > 1KB
  level: 6,        // balanced CPU vs compression ratio
}));

// Request body size limit — prevents oversized payload attacks
app.use(express.json({ limit: "1mb" }));

// ─── Request ID Tracing ────────────────────────────────────────────────────────
// Adds x-request-id to every request for distributed tracing.
// Reuses the client's ID if provided (so frontend can correlate logs).
app.use((req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && incoming.length <= 64
    ? incoming
    : crypto.randomUUID();
  req.headers["x-request-id"] = id;
  res.set("X-Request-Id", id);
  next();
});

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map(o => o.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));

// ─── Rate Limiting ──────────────────────────────────────────────────────────────

// Global rate limiter — 200 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  // Skip rate limiting for health checks
  skip: (req) => req.path === "/health",
});

// AI-heavy endpoints limiter — 30 req/min per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit reached. Please wait before requesting again." },
});

app.use(globalLimiter);

// ─── Cache-Control Headers ─────────────────────────────────────────────────────

// Add cache headers for GET endpoints
app.use((req, res, next) => {
  if (req.method === "GET") {
    if (req.path === "/health") {
      res.set("Cache-Control", "public, max-age=10");
    }
  }
  next();
});

// ─── Health Check ───────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    models: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  });
});

// ─── Routes ─────────────────────────────────────────────────────────────────────

app.use("/api/agents", agentsRouter);
app.use("/api/agent/analyze", aiLimiter, analyzeRouter);
app.use("/api/agent/execute", aiLimiter, executeRouter);
app.use("/api/agent/chat", aiLimiter, chatRouter);
app.use("/api/agent/lp-fee", lpFeeRouter);
app.use("/api/dashboard-state", dashboardRouter);

// Extended agent skills
app.use("/api/agent", aiLimiter, skillsRouter);

// ─── 404 Handler ────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const reqId = req.headers["x-request-id"] ?? "unknown";

  // Map zod / payload validation errors to 400 with a structured field map.
  if (err instanceof RequestValidationError) {
    res.status(400).json({ ...err.toJSON(), requestId: reqId });
    return;
  }

  console.error("[error]", {
    requestId: reqId,
    message: err.message,
    stack: !IS_PROD ? err.stack : undefined,
  });
  res.status(500).json({
    error: "Internal server error",
    requestId: reqId,
  });
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  const g = process.env.GEMINI_API_KEY    ? "\x1b[32m✓\x1b[0m" : "\x1b[33m✗\x1b[0m  set GEMINI_API_KEY";
  const a = process.env.ANTHROPIC_API_KEY ? "\x1b[32m✓\x1b[0m" : "\x1b[33m✗\x1b[0m  set ANTHROPIC_API_KEY";
  const d = process.env.DATABASE_URL      ? "\x1b[32mNeon PostgreSQL\x1b[0m" : "\x1b[33mlocal JSON\x1b[0m";
  console.log(`\n \x1b[1m\x1b[36m▲ InitiaAgent API\x1b[0m  ready on \x1b[1mhttp://localhost:${PORT}\x1b[0m\n`);
  console.log(`   Gemini     ${g}`);
  console.log(`   Anthropic  ${a}`);
  console.log(`   Database   ${d}`);
  startAgentWorker();
  console.log("");
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n✗  Port ${PORT} is already in use.\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Graceful shutdown on SIGTERM/SIGINT
function gracefulShutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    console.error("Forcing shutdown after timeout.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
