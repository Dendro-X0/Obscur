#!/usr/bin/env node
/**
 * @deprecated CDP gate — redirects to in-app native gate (no WebView2 remote debugging).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "dev-lab-native-gate.mjs");
console.warn("[capture:dm-kernel] CDP path deprecated — using in-app native gate listener.");
const result = spawnSync(process.execPath, [scriptPath], { stdio: "inherit" });
process.exit(result.status ?? 1);
