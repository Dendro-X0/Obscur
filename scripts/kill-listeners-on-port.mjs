#!/usr/bin/env node
/**
 * Free a TCP port by terminating processes that are listening on it (dev cleanup).
 * Windows: netstat -ano + taskkill. Unix: lsof + kill.
 */
import { execSync } from "node:child_process";

const port = Number.parseInt(process.argv[2] ?? "8787", 10);

if (!Number.isFinite(port) || port <= 0 || port > 65535) {
  console.error("[kill-port] invalid port");
  process.exit(1);
}

const killWindowsListeners = () => {
  let output = "";
  try {
    output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return [];
  }
  const pids = new Set();
  for (const line of output.split(/\r?\n/u)) {
    if (!/LISTENING/u.test(line)) {
      continue;
    }
    const parts = line.trim().split(/\s+/u);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/u.test(pid) && pid !== "0") {
      pids.add(pid);
    }
  }
  const killed = [];
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      killed.push(pid);
    } catch {
      // ignore
    }
  }
  return killed;
};

const killUnixListeners = () => {
  let output = "";
  try {
    output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return [];
  }
  const killed = [];
  for (const pid of output.split(/\s+/u).filter(Boolean)) {
    try {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      killed.push(pid);
    } catch {
      // ignore
    }
  }
  return killed;
};

const killed = process.platform === "win32" ? killWindowsListeners() : killUnixListeners();
if (killed.length > 0) {
  console.log(`[kill-port] freed :${port} (pids: ${killed.join(", ")})`);
} else {
  console.log(`[kill-port] no listeners on :${port}`);
}
