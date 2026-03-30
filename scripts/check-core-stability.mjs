#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpmBin = isWindows ? "pnpm.cmd" : "pnpm";
const quoteForCmd = (value) => {
  const text = String(value);
  if (text.length === 0) {
    return "\"\"";
  }
  if (!/[ \t"&()<>^|]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
};

const steps = [
  {
    label: "Voice + messaging reliability suites",
    args: [
      "--dir",
      "apps/pwa",
      "exec",
      "vitest",
      "run",
      "app/features/messaging/services/realtime-voice-capability.test.ts",
      "app/features/messaging/services/realtime-voice-signaling.test.ts",
      "app/features/messaging/services/realtime-voice-session-lifecycle.test.ts",
      "app/features/messaging/services/realtime-voice-session-owner.test.ts",
      "app/features/messaging/services/realtime-voice-session-diagnostics.test.ts",
      "app/features/messaging/services/realtime-voice-invite-tombstone.test.ts",
      "app/shared/m6-voice-capture.test.ts",
      "app/shared/m6-voice-replay-bridge.test.ts",
      "app/shared/log-app-event.test.ts",
      "app/features/main-shell/main-shell.test.tsx",
    ],
  },
  {
    label: "Typecheck",
    args: ["--dir", "apps/pwa", "exec", "--", "tsc", "--noEmit", "--pretty", "false"],
  },
  {
    label: "Docs integrity",
    args: ["docs:check"],
  },
  {
    label: "M10 release-candidate strict artifacts",
    args: ["demo:m10:rc:check"],
  },
  {
    label: "v1.3.0 packet structure",
    args: ["demo:v130:check"],
  },
];

const run = (label, args) => {
  console.log(`[stability:core] ${label}...`);
  const result = isWindows
    ? spawnSync(
      "cmd.exe",
      ["/d", "/s", "/c", `${quoteForCmd(pnpmBin)} ${args.map(quoteForCmd).join(" ")}`],
      { stdio: "inherit", shell: false },
    )
    : spawnSync(pnpmBin, args, {
      stdio: "inherit",
      shell: false,
    });
  if (result.error) {
    console.error(`[stability:core] failed to start command for step: ${label}`);
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

for (const step of steps) {
  run(step.label, step.args);
}

console.log("[stability:core] passed.");
