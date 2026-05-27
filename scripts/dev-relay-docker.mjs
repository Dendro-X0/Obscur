#!/usr/bin/env node
/** Force local Docker relay (optional; most dev does not need this). */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.OBSCUR_USE_DOCKER_RELAY = "1";
const relayScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "dev-relay.mjs");
const child = spawn(process.execPath, [relayScript], {
    stdio: "inherit",
    env: process.env,
    shell: false,
});
child.on("exit", (code) => process.exit(code ?? 1));
