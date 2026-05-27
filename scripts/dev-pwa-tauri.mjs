#!/usr/bin/env node
/**
 * Next dev server for Tauri beforeDevCommand.
 * Inherits NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE from the parent process
 * (set by scripts/dev-desktop.mjs --online). Defaults to offline (0).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergePwaEnvLocal } from "./load-pwa-env-local.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = mergePwaEnvLocal({
    ...process.env,
    NEXT_PUBLIC_DESKTOP_SHELL: "1",
    TAURI_BUILD: "true",
    NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE: process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE ?? "0",
});

const useWebpack = env.OBSCUR_DESKTOP_DEV_BUNDLER === "webpack";
const nextArgs = [
    "-C",
    "apps/pwa",
    "exec",
    "next",
    "dev",
    ...(useWebpack ? [] : ["--turbopack"]),
    "--hostname",
    "127.0.0.1",
    "--port",
    "3340",
];

const child = spawn("pnpm", nextArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env,
    shell: true,
});

child.on("exit", (code) => {
    process.exit(code ?? 1);
});
