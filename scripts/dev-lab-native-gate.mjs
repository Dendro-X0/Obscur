#!/usr/bin/env node
/**
 * In-app native gate — no CDP / WebView2 remote debugging.
 *
 *   pnpm dev:lab:native-gate          # start listener (keep running)
 *   pnpm dev:desktop:online           # separate terminal; unlock Tester1
 *
 * Tauri auto-detects the listener and POSTs the report when the shell is ready.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateDevLabNativeGateReport,
  NATIVE_GATE_REPORT_SCHEMA,
} from "./lib/dev-lab-native-gate-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.OBSCUR_NATIVE_GATE_HOST?.trim() || "127.0.0.1";
const port = Number.parseInt(process.env.OBSCUR_NATIVE_GATE_PORT ?? "9876", 10);
const timeoutMs = Number.parseInt(process.env.OBSCUR_NATIVE_GATE_TIMEOUT_MS ?? "300000", 10);
const outDir = path.resolve(
  process.env.OBSCUR_NATIVE_GATE_OUT ?? path.join(repoRoot, "test-results", "dev-lab-native-gate"),
);

const log = (msg) => console.log(`[native-gate] ${msg}`);

const writeReport = (report, evaluation) => {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(outDir, `native-gate-${stamp}.json`);
  const latestPath = path.join(outDir, "native-gate-latest.json");
  const payload = {
    ...report,
    evaluation,
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(reportPath, body, "utf8");
  fs.writeFileSync(latestPath, body, "utf8");
  return { reportPath, latestPath };
};

const main = async () => {
  /** @type {import('http').Server | null} */
  let server = null;
  /** @type {NodeJS.Timeout | null} */
  let timeout = null;

  const shutdown = (code) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    if (server) {
      server.close();
    }
    process.exit(code);
  };

  await new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${host}:${port}`);
      if (req.method === "GET" && url.pathname === "/ping") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, schema: NATIVE_GATE_REPORT_SCHEMA }));
        return;
      }

      if (req.method === "POST" && url.pathname === "/report") {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const report = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            const evaluation = evaluateDevLabNativeGateReport(report);
            const paths = writeReport(report, evaluation);
            res.writeHead(evaluation.passed ? 200 : 422, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: evaluation.passed, evaluation, paths }));
            log(evaluation.passed ? "PASS" : `FAIL (${evaluation.failures.join(", ")})`);
            log(`report → ${paths.latestPath}`);
            shutdown(evaluation.passed ? 0 : 1);
          } catch (error) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }));
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
    });

    server.on("error", reject);
    server.listen(port, host, () => {
      log(`listening on http://${host}:${port}`);
      log("Next:");
      log("  1. pnpm dev:desktop:online   (separate terminal)");
      log("  2. Unlock Tester1 in Tauri — gate auto-runs when shell + messaging are ready");
      log(`  Waiting up to ${Math.round(timeoutMs / 1000)}s for in-app report…`);
      resolve(undefined);
    });
  });

  timeout = setTimeout(() => {
    log(`Timed out after ${Math.round(timeoutMs / 1000)}s — is Tauri running and Tester1 unlocked?`);
    shutdown(1);
  }, timeoutMs);
};

main().catch((error) => {
  console.error(`[native-gate] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
