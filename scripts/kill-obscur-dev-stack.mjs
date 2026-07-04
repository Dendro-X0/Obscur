#!/usr/bin/env node
/**
 * Emergency cleanup for Obscur dev stack on memory-constrained machines.
 *
 * Kills desktop/Tor sidecars, orphaned Obscur WebView2 renderers (common after
 * force-quit or MCP sessions), and frees coordination (:8787) / relay (:7000).
 *
 *   pnpm kill:dev-stack
 *   pnpm kill:dev-stack -- --docker   also tear down Docker relay compose stack
 *   pnpm kill:dev-stack -- --report   list Obscur-related processes, then exit
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const stopDocker = flags.has("--docker") || process.env.OBSCUR_KILL_DEV_STACK_DOCKER === "1";
const reportOnly = flags.has("--report");

const log = (message) => console.log(`[kill-dev-stack] ${message}`);

const runNodeScript = (scriptName, ...args) => {
  const scriptPath = path.join(repoRoot, "scripts", scriptName);
  spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
};

const runPowerShell = (script, stdio = "pipe") => {
  return execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8", stdio: stdio === "inherit" ? "inherit" : ["ignore", stdio, "ignore"] },
  );
};

const reportObscurProcesses = () => {
  if (process.platform !== "win32") {
    log("process report is Windows-only");
    return;
  }
  try {
    const output = runPowerShell(`
      $rows = @()
      foreach ($name in @('obscur_desktop_app','tor')) {
        Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
          $rows += [pscustomobject]@{ Kind=$name; PID=$_.Id; WS_MB=[math]::Round($_.WorkingSet64/1MB,0) }
        }
      }
      Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq 'node.exe' -and (
          $_.CommandLine -like '*coordination*' -or
          $_.CommandLine -like '*dev-workspace-stack*' -or
          $_.CommandLine -like '*dev-relay*' -or
          $_.CommandLine -like '*wrangler*'
        )
      } | ForEach-Object {
        $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
        if ($p) {
          $rows += [pscustomobject]@{ Kind='stack-node'; PID=$_.ProcessId; WS_MB=[math]::Round($p.WorkingSet64/1MB,0) }
        }
      }
      Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq 'msedgewebview2.exe' -and (
          $_.CommandLine -like '*app.obscur.desktop*' -or
          $_.CommandLine -like '*obscur_desktop_app*'
        )
      } | ForEach-Object {
        $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
        if ($p) {
          $rows += [pscustomobject]@{ Kind='obscur-webview2'; PID=$_.ProcessId; WS_MB=[math]::Round($p.WorkingSet64/1MB,0) }
        }
      }
      if ($rows.Count -eq 0) { 'none' } else { $rows | Sort-Object WS_MB -Descending | Format-Table -AutoSize | Out-String -Width 200 }
    `);
    log("Obscur-related processes:");
    console.log(output.trim() || "  (none)");
  } catch {
    log("could not enumerate processes");
  }
};

const killOrphanedObscurWebView2 = () => {
  if (process.platform !== "win32") {
    return;
  }
  try {
    const output = runPowerShell(`
      $killed = @()
      Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq 'msedgewebview2.exe' -and (
          $_.CommandLine -like '*app.obscur.desktop*' -or
          $_.CommandLine -like '*obscur_desktop_app*'
        )
      } | ForEach-Object {
        try {
          Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
          $killed += $_.ProcessId
        } catch {}
      }
      if ($killed.Count -eq 0) { 'none' } else { $killed -join ', ' }
    `);
    const trimmed = output.trim();
    if (trimmed && trimmed !== "none") {
      log(`stopped orphaned Obscur WebView2 (pids: ${trimmed})`);
    } else {
      log("no orphaned Obscur WebView2 processes");
    }
  } catch {
    log("WebView2 cleanup failed (try Task Manager → End task on msedgewebview2 with Obscur in details)");
  }
};

const stopDockerRelay = () => {
  if (!stopDocker) {
    log("skipping Docker relay (pass --docker to stop compose service)");
    return;
  }
  const composeFile = path.join(repoRoot, "infra", "docker-compose.nostr.yml");
  if (!existsSync(composeFile)) {
    log("infra/docker-compose.nostr.yml not found — skipping relay container");
    return;
  }
  for (const [command, args] of [
    ["docker", ["compose", "-f", composeFile, "down"]],
    ["docker-compose", ["-f", composeFile, "down"]],
  ]) {
    const result = spawnSync(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
      env: process.env,
    });
    if (result.status === 0) {
      log("stopped Docker relay stack");
      return;
    }
  }
  log("could not stop Docker relay (Docker may be offline)");
};

if (reportOnly) {
  reportObscurProcesses();
  process.exit(0);
}

log("before cleanup:");
reportObscurProcesses();

log("stopping Obscur desktop / Tor sidecars…");
runNodeScript("cleanup-tauri-sidecars.mjs");

log("freeing coordination port 8787…");
runNodeScript("kill-listeners-on-port.mjs", "8787");

log("freeing relay port 7000…");
runNodeScript("kill-listeners-on-port.mjs", "7000");

killOrphanedObscurWebView2();
stopDockerRelay();

log("after cleanup:");
reportObscurProcesses();

log("done");
log("If commit is still ~36+ GB: reboot once (page file on HDD D:/F:/G: may keep disk at 98% until restart).");
log("Killing node.exe alone does NOT stop WebView2, Docker, or Cursor — use pnpm kill:dev-stack.");
