#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const args = process.argv.slice(2);

const defaultCapturePath = resolve(
  rootDir,
  "docs/assets/demo/v1.2.5/raw/m10-v130-release-candidate-capture.json"
);

const parseArgs = (argv) => {
  const parsed = {
    capturePath: defaultCapturePath,
    withCloseoutCheck: false,
    skipStatus: false,
    skipNext: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      continue;
    }
    if (token === "--capture") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--capture requires a value");
      }
      parsed.capturePath = resolve(rootDir, value);
      index += 1;
      continue;
    }
    if (token === "--with-closeout-check") {
      parsed.withCloseoutCheck = true;
      continue;
    }
    if (token === "--skip-status") {
      parsed.skipStatus = true;
      continue;
    }
    if (token === "--skip-next") {
      parsed.skipNext = true;
      continue;
    }
    if (token === "--help") {
      parsed.help = true;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }

  return parsed;
};

const resolveCommand = (cmd) => {
  if (process.platform === "win32" && cmd === "pnpm") {
    return "pnpm.cmd";
  }
  return cmd;
};

const quoteShellArg = (value) => {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
};

const run = (cmd, commandArgs) => {
  const command = resolveCommand(cmd);
  const result = process.platform === "win32"
    ? spawnSync([command, ...commandArgs].map(quoteShellArg).join(" "), {
      cwd: rootDir,
      stdio: "inherit",
      shell: true,
    })
    : spawnSync(command, commandArgs, {
      cwd: rootDir,
      stdio: "inherit",
    });

  if (result.status !== 0) {
    throw new Error(`${cmd} ${commandArgs.join(" ")} failed`);
  }
};

const usage = [
  "Usage:",
  "  node scripts/refresh-m10-release-candidate-flow.mjs [options]",
  "",
  "Options:",
  "  --capture <path>          Capture JSON path (default: docs/assets/demo/v1.2.5/raw/m10-v130-release-candidate-capture.json)",
  "  --with-closeout-check     Also run: pnpm closeout:v130:check -- --allow-dirty",
  "  --skip-status             Skip status export (m10-status.json)",
  "  --skip-next               Skip next-step helper output",
  "  --help                    Show this message",
].join("\n");

const main = () => {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.log(usage);
    return;
  }

  if (!existsSync(parsed.capturePath)) {
    throw new Error(
      `capture file not found: ${relative(rootDir, parsed.capturePath) || parsed.capturePath}`
    );
  }

  const captureArg = relative(rootDir, parsed.capturePath);
  const shouldRunNext = !parsed.skipNext && !parsed.skipStatus;

  console.log("[demo:rc:refresh] Materializing release-candidate assets...");
  run("pnpm", ["demo:m10:rc:materialize", "--", "--capture", captureArg]);

  console.log("[demo:rc:refresh] Running strict asset verification...");
  run("pnpm", ["demo:m10:rc:check"]);

  if (!parsed.skipStatus) {
    console.log("[demo:rc:refresh] Exporting strict status report...");
    run("pnpm", ["demo:m10:rc:status"]);
  } else {
    console.log("[demo:rc:refresh] Skipping status export (--skip-status).");
  }

  if (shouldRunNext) {
    console.log("[demo:rc:refresh] Printing deterministic follow-up actions...");
    run("pnpm", ["demo:m10:rc:next"]);
  } else {
    console.log("[demo:rc:refresh] Skipping next-step helper output.");
  }

  if (parsed.withCloseoutCheck) {
    console.log("[demo:rc:refresh] Running closeout validation with local dirty-tree allowance...");
    run("pnpm", ["closeout:v130:check", "--", "--allow-dirty"]);
  }

  console.log("[demo:rc:refresh] Complete.");
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[demo:rc:refresh] Failed: ${message}`);
  process.exit(1);
}
