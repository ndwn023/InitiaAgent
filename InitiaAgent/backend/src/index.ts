import dotenv from "dotenv";
import path from "path";
// Load from monorepo root .env (works for ts-node-dev and compiled dist/)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import cors from "cors";

import agentsRouter from "./routes/agents";
import analyzeRouter from "./routes/analyze";
import executeRouter from "./routes/execute";
import chatRouter from "./routes/chat";
import lpFeeRouter from "./routes/lp-fee";
import dashboardRouter from "./routes/dashboard";
import skillsRouter from "./routes/skills";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map(o => o.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    models: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      claudeCli: true, // always attempted if claude CLI is installed
    },
  });
});

// Core API (mirrors Next.js API routes)
app.use("/api/agents", agentsRouter);
app.use("/api/agent/analyze", analyzeRouter);
app.use("/api/agent/execute", executeRouter);
app.use("/api/agent/chat", chatRouter);
app.use("/api/agent/lp-fee", lpFeeRouter);
app.use("/api/dashboard-state", dashboardRouter);

// Extended agent skills
app.use("/api/agent", skillsRouter);
// → POST /api/agent/consensus   multi-model signal voting
// → POST /api/agent/optimize    strategy optimizer
// → POST /api/agent/risk        portfolio risk assessment
// → POST /api/agent/epoch       epoch performance report

// ─── Start ────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  const g = process.env.GEMINI_API_KEY    ? "\x1b[32m✓\x1b[0m" : "\x1b[33m✗\x1b[0m  set GEMINI_API_KEY";
  const a = process.env.ANTHROPIC_API_KEY ? "\x1b[32m✓\x1b[0m" : "\x1b[33m✗\x1b[0m  set ANTHROPIC_API_KEY";
  const d = process.env.DATABASE_URL      ? "\x1b[32mNeon PostgreSQL\x1b[0m" : "\x1b[33mlocal JSON\x1b[0m";
  console.log(`\n \x1b[1m\x1b[36m▲ InitiaAgent API\x1b[0m  ready on \x1b[1mhttp://localhost:${PORT}\x1b[0m\n`);
  console.log(`   Gemini     ${g}`);
  console.log(`   Anthropic  ${a}`);
  console.log(`   Claude CLI \x1b[32m✓\x1b[0m  local fallback`);
  console.log(`   Database   ${d}\n`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n✗  Port ${PORT} is already in use.\n`);
    try {
      const { execSync } = require("child_process");
      const out: string = execSync(`netstat -ano | findstr ":${PORT} "`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      const pids = new Set<string>();
      for (const line of out.split("\n")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      if (pids.size > 0) {
        console.error(`   Kill it with:`);
        for (const pid of pids) {
          console.error(`   taskkill /F /PID ${pid}`);
        }
        console.error("");
      }
    } catch {
      console.error(`   Run: netstat -ano | findstr :${PORT}  then: taskkill /F /PID <pid>\n`);
    }
    process.exit(1);
  } else {
    throw err;
  }
});

export default app;
