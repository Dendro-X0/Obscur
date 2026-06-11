import type { Page } from "@playwright/test";

const DEFAULT_BASE_URL = "http://127.0.0.1:3340";

export const resolveAppBaseUrl = (baseURL?: string | null): string => (
  (baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "")
);

export const resolveAppUrl = (pathOrUrl: string, baseURL?: string | null): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const base = resolveAppBaseUrl(baseURL);
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${normalizedPath}`;
};

export const gotoApp = async (
  page: Page,
  pathOrUrl: string,
  baseURL?: string | null,
): Promise<void> => {
  await page.goto(resolveAppUrl(pathOrUrl, baseURL));
};
