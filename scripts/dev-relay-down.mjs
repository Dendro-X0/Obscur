#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(repoRoot, "infra", "docker-compose.nostr.yml");

const run = (command, args) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd: repoRoot,
        stdio: "inherit",
        shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
});

const main = async () => {
    const attempts = [
        ["docker", ["compose", "-f", composeFile, "down"]],
        ["docker-compose", ["-f", composeFile, "down"]],
    ];
    for (const [command, args] of attempts) {
        try {
            await run(command, args);
            return;
        } catch {
            // try next
        }
    }
    process.exitCode = 1;
};

void main();
