#!/usr/bin/env node
// Cross-platform port killer — dev-only helper.
// Usage: node scripts/kill-port.mjs 3000 4000
// Vercel never runs this (it only calls the `build` script, not `dev`).

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";

const run = promisify(exec);
const isWin = platform() === "win32";
const self = process.pid;

const ports = process.argv.slice(2).map((p) => Number(p)).filter(Boolean);
if (ports.length === 0) {
  console.log("kill-port: no ports specified, skipping.");
  process.exit(0);
}

async function pidsOnPort(port) {
  try {
    if (isWin) {
      const { stdout } = await run(`netstat -ano -p tcp | findstr :${port}`);
      const pids = new Set();
      for (const line of stdout.split(/\r?\n/)) {
        // Only LISTENING rows; last column is the PID.
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;
        const local = parts[1] || "";
        if (!local.endsWith(`:${port}`)) continue;
        const state = parts[3];
        if (state !== "LISTENING") continue;
        const pid = parts[4];
        if (/^\d+$/.test(pid) && Number(pid) !== self) pids.add(pid);
      }
      return [...pids];
    }
    const { stdout } = await run(`lsof -t -iTCP:${port} -sTCP:LISTEN`);
    return stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((pid) => /^\d+$/.test(pid) && Number(pid) !== self);
  } catch {
    // No match → port is free.
    return [];
  }
}

async function killPid(pid) {
  try {
    if (isWin) await run(`taskkill /F /T /PID ${pid}`);
    else await run(`kill -9 ${pid}`);
    return true;
  } catch {
    return false;
  }
}

await Promise.all(
  ports.map(async (port) => {
    const pids = await pidsOnPort(port);
    if (pids.length === 0) {
      console.log(`\x1b[90m•\x1b[0m port ${port} free`);
      return;
    }
    for (const pid of pids) {
      const ok = await killPid(pid);
      console.log(
        ok
          ? `\x1b[32m✓\x1b[0m killed PID ${pid} on port ${port}`
          : `\x1b[33m!\x1b[0m could not kill PID ${pid} on port ${port}`,
      );
    }
  }),
);
