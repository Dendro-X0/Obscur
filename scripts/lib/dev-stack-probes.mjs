/**
 * Shared health/wait helpers for local dev infrastructure scripts.
 */
import net from "node:net";
import { spawnSync } from "node:child_process";
import path from "node:path";

export const DEFAULT_COORDINATION_READY_TIMEOUT_MS = process.platform === "win32"
  ? 360_000
  : 120_000;

export const DEFAULT_RELAY_READY_TIMEOUT_MS = 90_000;

export const PWA_DEV_URL = "http://127.0.0.1:3340/";
export const PWA_DEV_PORT = 3340;

export const resolveReadyTimeoutMs = (envValue, fallbackMs) => {
  const parsed = Number.parseInt(String(envValue ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return parsed;
};

/** Close socket before resolving — avoids Windows libuv UV_HANDLE_CLOSING on process.exit. */
export const probePortOpen = (host, port, timeoutMs = 1500) => new Promise((resolve) => {
  const socket = net.connect({ host, port, timeout: timeoutMs });
  let settled = false;

  const finish = (value) => {
    if (settled) {
      return;
    }
    settled = true;
    socket.removeAllListeners();

    const done = () => resolve(value);
    if (socket.destroyed) {
      done();
      return;
    }

    socket.once("close", done);
    if (socket.connecting) {
      socket.destroy();
    } else {
      socket.end();
    }
    setTimeout(done, 250);
  };

  socket.once("connect", () => finish(true));
  socket.once("error", () => finish(false));
  socket.once("timeout", () => finish(false));
});

/** Yield so libuv can finish closing sockets/fetch handles before process.exit on Windows. */
export const exitProcessSafely = async (code = 0) => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 50));
  process.exit(code);
};

export const probeHttpOk = async (url, timeoutMs = 5000) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return false;
    }
    const json = await response.json().catch(() => null);
    return Boolean(json?.ok);
  } catch {
    return false;
  }
};

/** Next dev on :3340 serves HTML — not coordination-style `{ ok: true }` JSON. */
export const probePwaDevReady = async (url = PWA_DEV_URL, timeoutMs = 5000) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (!response.ok) {
      return false;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return false;
    }
    const html = await response.text();
    return html.length > 256 && (html.includes("<html") || html.includes("<!DOCTYPE"));
  } catch {
    return false;
  }
};

/** Matches `<meta name="obscur-dev-stack" content="…">` emitted by app/layout.tsx in dev. */
export const buildPwaDevStackFingerprint = (env = process.env) => (
  [
    env.NEXT_PUBLIC_DESKTOP_SHELL === "1" ? "desktop" : "web",
    env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE === "1" ? "online" : "offline-stub",
  ].join(":")
);

/**
 * @returns {boolean | null} true when fingerprint matches; false when mismatched; null when tag missing.
 */
export const probePwaDevStackFingerprint = async (
  expectedFingerprint,
  url = PWA_DEV_URL,
  timeoutMs = 5000,
) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (!response.ok) {
      return false;
    }
    const html = await response.text();
    const match = html.match(/name=["']obscur-dev-stack["']\s+content=["']([^"']+)["']/i);
    if (!match?.[1]) {
      return null;
    }
    return match[1] === expectedFingerprint;
  } catch {
    return false;
  }
};

export const freePwaDevPort = (repoRoot) => {
  spawnSync(process.execPath, [
    path.join(repoRoot, "scripts", "kill-listeners-on-port.mjs"),
    String(PWA_DEV_PORT),
  ], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
};

export const waitForPwaDevReady = async (options = {}) => {
  const url = options.url ?? PWA_DEV_URL;
  const maxMs = options.maxMs ?? 180_000;
  const pollMs = options.pollMs ?? 750;
  const started = Date.now();

  while (Date.now() - started < maxMs) {
    if (await probePwaDevReady(url, 3000)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
};

export const waitForReady = async (label, probe, options = {}) => {
  const maxMs = options.maxMs ?? DEFAULT_COORDINATION_READY_TIMEOUT_MS;
  const pollMs = options.pollMs ?? 750;
  const progressEveryMs = options.progressEveryMs ?? 15_000;
  const onProgress = options.onProgress ?? (() => {});

  const started = Date.now();
  let lastProgressAt = started;

  while (Date.now() - started < maxMs) {
    if (await probe()) {
      return { ok: true, elapsedMs: Date.now() - started };
    }

    const now = Date.now();
    if (now - lastProgressAt >= progressEveryMs) {
      onProgress({
        label,
        elapsedMs: now - started,
        maxMs,
      });
      lastProgressAt = now;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return { ok: false, elapsedMs: Date.now() - started, maxMs };
};
