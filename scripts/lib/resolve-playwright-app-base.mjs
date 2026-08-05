/**
 * Resolve Playwright / Soft L3 app origin for Obscur desktop.
 * Production-parity static shell is :1430; webpack live is :3340.
 *
 * @see specs/backend/soft-l3-automation-track-a-design-2026-08.md
 */

const STATIC_SHELL = "http://127.0.0.1:1430";
const WEBPACK_LIVE = "http://127.0.0.1:3340";

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 * @param {typeof fetch} [fetchImpl]
 */
export async function isHttpReachable(url, timeoutMs = 1_500, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, method: "GET" });
    return response.ok || response.status === 304 || response.status === 404;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {Readonly<{
 *   env?: NodeJS.ProcessEnv;
 *   fetchImpl?: typeof fetch;
 *   probeTimeoutMs?: number;
 * }>} [options]
 * @returns {Promise<Readonly<{
 *   appBase: string;
 *   source: "env" | "static_shell" | "webpack_live" | "default_static";
 *   probed: Readonly<{ staticShell: boolean; webpackLive: boolean }>;
 * }>>}
 */
export async function resolvePlaywrightAppBase(options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const probeTimeoutMs = options.probeTimeoutMs ?? 1_500;
  const fromEnv = typeof env.PLAYWRIGHT_BASE_URL === "string"
    ? env.PLAYWRIGHT_BASE_URL.trim()
    : "";

  if (fromEnv) {
    return {
      appBase: fromEnv.replace(/\/$/, ""),
      source: "env",
      probed: { staticShell: false, webpackLive: false },
    };
  }

  const staticShell = await isHttpReachable(STATIC_SHELL, probeTimeoutMs, fetchImpl);
  if (staticShell) {
    return {
      appBase: STATIC_SHELL,
      source: "static_shell",
      probed: { staticShell: true, webpackLive: false },
    };
  }

  const webpackLive = await isHttpReachable(WEBPACK_LIVE, probeTimeoutMs, fetchImpl);
  if (webpackLive) {
    return {
      appBase: WEBPACK_LIVE,
      source: "webpack_live",
      probed: { staticShell: false, webpackLive: true },
    };
  }

  return {
    appBase: STATIC_SHELL,
    source: "default_static",
    probed: { staticShell: false, webpackLive: false },
  };
}

export const playwrightAppBaseDefaults = Object.freeze({
  STATIC_SHELL,
  WEBPACK_LIVE,
});
