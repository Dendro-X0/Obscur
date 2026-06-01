/**
 * Shared health/wait helpers for local dev infrastructure scripts.
 */

export const DEFAULT_COORDINATION_READY_TIMEOUT_MS = process.platform === "win32"
  ? 240_000
  : 120_000;

export const DEFAULT_RELAY_READY_TIMEOUT_MS = 90_000;

export const resolveReadyTimeoutMs = (envValue, fallbackMs) => {
  const parsed = Number.parseInt(String(envValue ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return parsed;
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
