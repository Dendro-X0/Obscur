#!/usr/bin/env node

import { execFileSync, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const desktopTargetRoot = path.join(repoRoot, "apps", "desktop", "src-tauri", "target");
const managedWindowsBinaryMetadata = {
  "tor.exe": "Tor sidecar",
  "obscur_desktop_app.exe": "desktop app",
};

function normalize(p) {
  return p.replace(/\\/g, "/").toLowerCase();
}

function isManagedTargetBinaryPath(executablePath, binaryName) {
  if (!executablePath || !binaryName) return false;
  const p = normalize(executablePath);
  const root = normalize(desktopTargetRoot);
  const normalizedBinaryName = binaryName.toLowerCase();
  return p.startsWith(root) && p.endsWith(`/${normalizedBinaryName}`);
}

function cleanupWindows() {
  let raw = "";
  try {
    raw = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-Process -Name tor,obscur_desktop_app -ErrorAction SilentlyContinue | Select-Object ProcessName,Id,Path | ConvertTo-Json -Compress",
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
    const processName = `${String(proc.ProcessName ?? "").toLowerCase()}.exe`;
    const binaryLabel = managedWindowsBinaryMetadata[processName];
    if (!binaryLabel) continue;

    const pid = Number(proc.Id);
    const executablePath = proc.Path || "";
    if (!Number.isFinite(pid) || pid <= 0) continue;
    if (!isManagedTargetBinaryPath(executablePath, processName)) continue;

    try {
      execFileSync("powershell", ["-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force`], { stdio: "ignore" });
      console.log(`[Desktop Cleanup] Stopped stale ${binaryLabel} PID ${pid}: ${executablePath}`);
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

    if (!command.includes(root)) continue;
    const isTor = command.includes("/tor");
    const isDesktopApp = command.includes("/obscur_desktop_app");
    if (!isTor && !isDesktopApp) continue;

    try {
      process.kill(pid, "SIGKILL");
      const label = isTor ? "Tor sidecar" : "desktop app";
      console.log(`[Desktop Cleanup] Stopped stale ${label} PID ${pid}`);
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
