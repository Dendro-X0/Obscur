#!/usr/bin/env node
/**
 * Coordination worker dev entrypoint.
 *
 * Wrangler 3.x on Windows can hang after `d1 execute --local` succeeds (open handles).
 * This script runs the migration when needed, force-terminates the stuck child, then
 * starts `wrangler dev`.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coordinationDir = path.join(repoRoot, "apps", "coordination");
const flags = new Set(process.argv.slice(2));
const migrateOnly = flags.has("--migrate-only");
const forceMigrate = flags.has("--force-migrate");
const sqlFile = (() => {
  const fileFlagIndex = process.argv.indexOf("--file");
  if (fileFlagIndex >= 0 && process.argv[fileFlagIndex + 1]) {
    return process.argv[fileFlagIndex + 1];
  }
  return "./schema.sql";
})();

const COORDINATION_PORT = 8787;

const freeCoordinationPort = () => {
  if (process.env.OBSCUR_SKIP_PORT_CLEANUP === "1") {
    return;
  }
  const script = path.join(repoRoot, "scripts", "kill-listeners-on-port.mjs");
  spawnSync(process.execPath, [script, String(COORDINATION_PORT)], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
};

const resolveWranglerBin = () => path.join(
  coordinationDir,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);
const SUCCESS_RE = /commands executed successfully/i;
const log = (message) => console.log(`[coordination-dev] ${message}`);

const localD1SqliteExists = () => {
  const d1Root = path.join(coordinationDir, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!fs.existsSync(d1Root)) {
    return false;
  }
  return fs.readdirSync(d1Root).some((entry) => entry.endsWith(".sqlite"));
};

const runWranglerD1Execute = async (relativeSqlFile) => {
  const wranglerArgs = [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "obscur",
    "--local",
    `--file=${relativeSqlFile}`,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn("pnpm", wranglerArgs, {
      cwd: coordinationDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: process.env,
    });

    let combinedOutput = "";
    let settled = false;
    let settleTimer;

    const noteOutput = (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      if (SUCCESS_RE.test(combinedOutput)) {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => finish(), 750);
      }
    };

    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(settleTimer);
      clearTimeout(hardTimeout);
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      noteOutput(chunk);
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      noteOutput(chunk);
    });

    child.on("error", (error) => finish(error));

    child.on("exit", (code) => {
      if (settled) {
        return;
      }
      if (code === 0 || SUCCESS_RE.test(combinedOutput)) {
        finish();
        return;
      }
      finish(new Error(`wrangler d1 execute exited with code ${code ?? "unknown"}`));
    });

    const hardTimeout = setTimeout(() => {
      if (settled) {
        return;
      }
      if (SUCCESS_RE.test(combinedOutput)) {
        finish();
        return;
      }
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      finish(new Error("wrangler d1 execute timed out before reporting success"));
    }, 45_000);
  });
};

const runWranglerDev = () => new Promise((resolve) => {
  if (process.env.OBSCUR_SKIP_PORT_CLEANUP !== "1") {
    freeCoordinationPort();
  }
  log("starting wrangler dev (non-interactive; first boot on Windows can take several minutes)");
  const wranglerBin = resolveWranglerBin();
  const child = spawn(process.execPath, [
    wranglerBin,
    "dev",
    "--port",
    String(COORDINATION_PORT),
    "--ip",
    "127.0.0.1",
    "--local-protocol",
    "http",
    "--show-interactive-dev-session",
    "false",
    "--log-level",
    "log",
  ], {
    cwd: coordinationDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      WRANGLER_SEND_METRICS: "false",
      FORCE_COLOR: "0",
    },
  });

  let sawWranglerOutput = false;
  const startupHeartbeat = setInterval(() => {
    if (sawWranglerOutput) {
      return;
    }
    log("still waiting for wrangler first output (Windows cold start can take several minutes)…");
  }, 30_000);

  const forward = (stream) => {
    stream.on("data", (chunk) => {
      sawWranglerOutput = true;
      clearInterval(startupHeartbeat);
      const text = chunk.toString();
      process.stdout.write(text.split(/\r?\n/u).filter(Boolean).map((line) => `[wrangler] ${line}\n`).join(""));
      if (/Ready on|listening on|http:\/\/127\.0\.0\.1:8787/i.test(text)) {
        log("wrangler reported local listener");
      }
    });
  };

  forward(child.stdout);
  forward(child.stderr);

  const shutdown = (signal) => {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  child.on("error", (error) => {
    console.error(`[coordination-dev] wrangler spawn failed: ${error.message}`);
    resolve(1);
  });

  child.on("exit", (code) => {
    clearInterval(startupHeartbeat);
    resolve(code ?? 1);
  });
});

const run = async () => {
  const shouldMigrate = migrateOnly || forceMigrate || !localD1SqliteExists();

  if (shouldMigrate) {
    log(`applying local D1 schema (${sqlFile})`);
    try {
      await runWranglerD1Execute(sqlFile);
      log("local D1 schema applied");
    } catch (error) {
      if (migrateOnly) {
        throw error;
      }
      log(`migration warning: ${error instanceof Error ? error.message : String(error)}`);
      log("continuing to wrangler dev (existing local D1 may already be initialized)");
    }
  } else {
    log("local D1 already present — skipping schema apply (use --force-migrate to re-run)");
  }

  if (migrateOnly) {
    return 0;
  }

  return runWranglerDev();
};

run()
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    console.error(`[coordination-dev] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
