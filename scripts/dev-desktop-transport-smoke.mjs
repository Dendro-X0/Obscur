#!/usr/bin/env node
/**
 * W53 transport smoke dev stack — strict kernels + host publish lab gates.
 *
 *   pnpm dev:desktop:transport-smoke
 *
 * Does NOT set NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY (strict engine-lab mode).
 * For archaeology UI only: NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1 pnpm dev:desktop:online
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stackScript = path.join(repoRoot, "scripts", "dev-workspace-stack.mjs");

const env = {
  ...process.env,
  NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY: "1",
  NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK: "1",
};

if (env.NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY === "1") {
  console.warn(
    "[dev-desktop-transport-smoke] NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1 is set — "
    + "W53 smoke expects strict kernel mode (unset or 0).",
  );
}

const child = spawn(
  process.execPath,
  [stackScript, "--online", ...process.argv.slice(2)],
  {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
