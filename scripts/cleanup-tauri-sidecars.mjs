#!/usr/bin/env node

import { execFileSync, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const desktopTargetRoot = path.join(repoRoot, "apps", "desktop", "src-tauri", "target");

function normalize(p) {
  return p.replace(/\\/g, "/").toLowerCase();
}

function isManagedTorPath(executablePath) {
  if (!executablePath) return false;
  const p = normalize(executablePath);
  const root = normalize(desktopTargetRoot);
  return p.startsWith(root) && p.endsWith("/tor.exe");
}

function cleanupWindows() {
  let raw = "";
  try {
    raw = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq 'tor.exe' } | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8" }
    ).trim();
  } catch {
    return;
  }

  if (!raw || raw === "null") return;
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : [parsed];

  for (const proc of list) {
    const pid = Number(proc.ProcessId);
    const executablePath = proc.ExecutablePath || "";
    if (!Number.isFinite(pid) || pid <= 0) continue;
    if (!isManagedTorPath(executablePath)) continue;

    try {
      execFileSync("powershell", ["-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force`], { stdio: "ignore" });
      console.log(`[Desktop Cleanup] Stopped stale Tor sidecar PID ${pid}: ${executablePath}`);
    } catch {
      // Ignore process races.
    }
  }
}

function cleanupPosix() {
  const cmd = "ps -axo pid=,command=";
  let raw = "";
  try {
    raw = execSync(cmd, { encoding: "utf8" });
  } catch {
    return;
  }

  const root = normalize(desktopTargetRoot);
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const command = normalize(match[2]);

    if (!command.includes(root) || !command.includes("/tor")) continue;

    try {
      process.kill(pid, "SIGKILL");
      console.log(`[Desktop Cleanup] Stopped stale Tor sidecar PID ${pid}`);
    } catch {
      // Ignore process races and permission errors.
    }
  }
}

if (process.platform === "win32") {
  cleanupWindows();
} else {
  cleanupPosix();
}
