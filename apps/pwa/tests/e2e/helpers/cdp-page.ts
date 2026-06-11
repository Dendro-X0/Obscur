import type { Browser, Page } from "@playwright/test";
import { resolveAppBaseUrl } from "./app-url";

const isObscurAppUrl = (url: string): boolean => {
  if (
    !url
    || url.startsWith("devtools://")
    || url.startsWith("chrome://")
    || url.startsWith("chrome-extension://")
    || url.startsWith("edge://")
  ) {
    return false;
  }
  if (url.includes("127.0.0.1:3340") || url.includes("localhost:3340")) {
    return true;
  }
  if (url.startsWith("tauri://")) {
    return true;
  }
  if (url.includes("tauri.localhost")) {
    return true;
  }
  if (url.includes("asset.localhost")) {
    return true;
  }
  return false;
};

const matchesAppBase = (url: string, appBase: string): boolean => {
  const base = appBase.replace(/\/$/, "");
  return Boolean(base && url.startsWith(base));
};

export const pickAppPageFromCdpBrowser = (
  browser: Browser,
  baseURL?: string | null,
): Page | null => {
  const base = resolveAppBaseUrl(baseURL);
  for (const context of browser.contexts()) {
    for (const candidate of context.pages()) {
      if (matchesAppBase(candidate.url(), base)) {
        return candidate;
      }
    }
  }
  for (const context of browser.contexts()) {
    for (const candidate of context.pages()) {
      if (isObscurAppUrl(candidate.url())) {
        return candidate;
      }
    }
  }
  return null;
};

export const pickAppPageFromCdpBrowserAsync = async (
  browser: Browser,
  baseURL?: string | null,
): Promise<Page | null> => {
  const base = resolveAppBaseUrl(baseURL);
  for (const context of browser.contexts()) {
    for (const candidate of context.pages()) {
      if (matchesAppBase(candidate.url(), base)) {
        return candidate;
      }
    }
  }

  const candidates: Page[] = [];
  for (const context of browser.contexts()) {
    for (const candidate of context.pages()) {
      if (isObscurAppUrl(candidate.url())) {
        candidates.push(candidate);
      }
    }
  }

  for (const candidate of candidates) {
    const hasDevLab = await candidate
      .evaluate(() => typeof window.obscurDevLab?.runBenchmark === "function")
      .catch(() => false);
    if (hasDevLab) {
      return candidate;
    }
  }

  return candidates[0] ?? null;
};
