#!/usr/bin/env node
/**
 * Local nostr-rs-relay via Docker (ws://localhost:7000).
 *
 * Default: skipped — Obscur ships with public relays enabled; Docker is optional.
 * To force Docker: OBSCUR_USE_DOCKER_RELAY=1 pnpm dev:relay
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(repoRoot, "infra", "docker-compose.nostr.yml");
const useDocker = process.env.OBSCUR_USE_DOCKER_RELAY === "1";

const printSkipHelp = () => {
    console.log("[dev:relay] Skipped — local Docker relay is optional.");
    console.log("");
    console.log("Default relay list already includes enabled public relays");
    console.log("  (wss://relay.damus.io, wss://nos.lol). No Docker required.");
    console.log("");
    console.log("Phase 2 two-profile DM:");
    console.log("  pnpm dev:desktop:online");
    console.log("  Open two profiles → send DM → restart → thread should persist (SQLite).");
    console.log("");
    console.log("Optional local relay (Docker): pnpm dev:relay:docker");
    console.log("  then enable ws://localhost:7000 in Settings → Relays");
    console.log("");
};

if (!useDocker) {
    printSkipHelp();
    process.exit(0);
}

const run = (command, args) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd: repoRoot,
        stdio: "inherit",
        shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
        if (code === 0) {
            resolve();
            return;
        }
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
});

const probeDockerDaemon = () => new Promise((resolve) => {
    const child = spawn("docker", ["info"], { stdio: "ignore", shell: false });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
});

const probeCommand = (command, args) => new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", shell: false });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
});

/** Prefer a compose CLI that actually accepts `-f` (Windows often lacks `docker compose`). */
const resolveComposeInvocation = async () => {
    const candidates = process.platform === "win32"
        ? [
            ["docker-compose", ["-f", composeFile, "up"]],
            ["docker", ["compose", "-f", composeFile, "up"]],
        ]
        : [
            ["docker", ["compose", "-f", composeFile, "up"]],
            ["docker-compose", ["-f", composeFile, "up"]],
        ];
    for (const [command, args] of candidates) {
        const versionArgs = command === "docker"
            ? ["compose", "version"]
            : ["--version"];
        if (await probeCommand(command, versionArgs)) {
            return [command, args];
        }
    }
    return null;
};

const printDockerHelp = () => {
    console.error("\n[dev:relay] Could not start local relay.");
    console.error("");
    console.error("Docker Desktop must be running, or unset OBSCUR_USE_DOCKER_RELAY and use public relays.");
    console.error("  pnpm dev:relay   (no Docker — default)");
    console.error("");
};

const fail = (code = 1) => {
    process.exitCode = code;
};

const tryStart = async () => {
    const daemonUp = await probeDockerDaemon();
    if (!daemonUp) {
        printDockerHelp();
        fail(1);
        return;
    }

    const composeInvocation = await resolveComposeInvocation();
    if (!composeInvocation) {
        printDockerHelp();
        console.error("[dev:relay] Neither `docker compose` nor `docker-compose` is available.");
        fail(1);
        return;
    }

    const [command, args] = composeInvocation;
    let lastError;
    try {
        console.log(`[dev:relay] Running: ${command} ${args.join(" ")}`);
        await run(command, args);
        return;
    } catch (error) {
        lastError = error;
        console.warn(`[dev:relay] ${command} failed:`, error instanceof Error ? error.message : error);
    }
    printDockerHelp();
    if (lastError) {
        console.error(`[dev:relay] Last error: ${lastError.message}`);
    }
    fail(1);
};

void tryStart();
