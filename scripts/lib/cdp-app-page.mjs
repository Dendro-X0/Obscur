/**
 * Pick the Obscur shell page from a CDP-attached browser (Tauri static, Next :3340, static serve).
 */

/** @param {string} url */
export function isObscurAppUrl(url) {
  const u = String(url ?? "");
  if (
    !u
    || u.startsWith("devtools://")
    || u.startsWith("chrome://")
    || u.startsWith("chrome-extension://")
    || u.startsWith("edge://")
  ) {
    return false;
  }
  if (u.includes("127.0.0.1:3340") || u.includes("localhost:3340")) {
    return true;
  }
  if (u.includes("127.0.0.1:1430") || u.includes("localhost:1430")) {
    return true;
  }
  if (u.startsWith("tauri://")) {
    return true;
  }
  if (u.includes("tauri.localhost")) {
    return true;
  }
  if (u.includes("asset.localhost")) {
    return true;
  }
  return false;
}

/** @param {string} url @param {string} appBase */
export function matchesAppBase(url, appBase) {
  const u = String(url ?? "");
  const base = String(appBase ?? "").replace(/\/$/, "");
  return Boolean(base && u.startsWith(base));
}

/**
 * @param {string} cdpUrl
 * @param {number} [timeoutMs]
 */
export async function probeCdpObscurPage(cdpUrl, timeoutMs = 3000) {
  try {
    const listUrl = `${cdpUrl.replace(/\/$/, "")}/json/list`;
    const response = await fetch(listUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return false;
    }
    const pages = await response.json();
    if (!Array.isArray(pages)) {
      return false;
    }
    return pages.some((entry) => isObscurAppUrl(entry.url));
  } catch {
    return false;
  }
}

/** @param {import('playwright').Browser} browser */
export function listCdpPageUrls(browser) {
  /** @type {string[]} */
  const urls = [];
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      urls.push(page.url());
    }
  }
  return urls;
}

/**
 * @param {import('playwright').Browser} browser
 * @param {string} [appBase]
 */
export async function pickAppPageFromBrowser(browser, appBase = "http://127.0.0.1:3340") {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (matchesAppBase(page.url(), appBase)) {
        return page;
      }
    }
  }

  /** @type {import('playwright').Page[]} */
  const candidates = [];
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (isObscurAppUrl(page.url())) {
        candidates.push(page);
      }
    }
  }

  for (const page of candidates) {
    const hasDevLab = await page
      .evaluate(() => typeof window.obscurDevLab?.runBenchmark === "function")
      .catch(() => false);
    if (hasDevLab) {
      return page;
    }
  }

  return candidates[0] ?? null;
}

/**
 * @param {import('playwright').Browser} browser
 * @param {{ appBase?: string; timeoutMs?: number; pollMs?: number }} [options]
 */
export async function waitForAppPageFromBrowser(browser, options = {}) {
  const appBase = options.appBase ?? "http://127.0.0.1:3340";
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollMs = options.pollMs ?? 400;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const page = await pickAppPageFromBrowser(browser, appBase);
    if (page) {
      return page;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return null;
}

/** @param {import('playwright').Browser} browser @param {string} cdpUrl */
export function formatNoObscurPageError(browser, cdpUrl) {
  const urls = listCdpPageUrls(browser);
  const lines = [
    `No Obscur page on CDP endpoint ${cdpUrl}.`,
    "Launch Tauri with remote debugging, unlock Tester1, then retry:",
    '  export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"',
    "  pnpm dev:desktop:online",
  ];
  if (urls.length > 0) {
    lines.push(`CDP pages seen: ${urls.join(", ")}`);
  } else {
    lines.push("CDP has no open pages — is Tauri running?");
  }
  return lines.join("\n");
}
