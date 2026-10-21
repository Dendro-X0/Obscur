import { spawn } from "node:child_process";

/** Windows-safe pnpm spawn (no shell:true — avoids DEP0190 and breaks paths with spaces). */
export const resolvePnpm = () => (process.platform === "win32" ? "pnpm.cmd" : "pnpm");

const resolveSpawn = (command, commandArgs) => {
  if (process.platform === "win32" && typeof command === "string" && command.toLowerCase().endsWith(".cmd")) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command, ...commandArgs],
    };
  }
  return { command, args: commandArgs };
};

export function spawnPnpm(args, options = {}) {
  const pnpm = resolvePnpm();
  const { command, args: spawnArgs } = resolveSpawn(pnpm, args);
  return spawn(command, spawnArgs, { shell: false, ...options });
}
