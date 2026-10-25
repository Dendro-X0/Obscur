import { reportDevRuntimeIssue } from "@/app/shared/dev-runtime-issue-reporter";

export const WELL_KNOWN_DISCOVERY_TIMEOUT_MS = 7_500;

/** pick: only `api_url` from NIP-96 well-known JSON. */
export const pickWellKnownApiUrl = (data: unknown): string | null => {
  if (!data || typeof data !== "object") {
    return null;
  }
  const apiUrl = (data as Readonly<Record<string, unknown>>).api_url;
  if (typeof apiUrl !== "string") {
    return null;
  }
  const trimmed = apiUrl.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUploadTarget = (url: string): string => {
  const trimmed = url.trim();
  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
};

/**
 * Resolve NIP-96 api_url from `/.well-known/nostr/nip96.json`.
 * Kept off the upload critical path — callers warm cache in the background.
 */
export const resolveApiUrlFromWellKnown = async (originUrl: string): Promise<string | null> => {
  const origin = originUrl.replace(/\/+$/, "");
  const endpoint = `${origin}/.well-known/nostr/nip96.json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WELL_KNOWN_DISCOVERY_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    try {
      const apiUrl = pickWellKnownApiUrl(JSON.parse(text) as unknown);
      return apiUrl ? normalizeUploadTarget(apiUrl) : null;
    } catch {
      return null;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      reportDevRuntimeIssue({
        domain: "upload",
        operation: "provider_discovery",
        severity: "warn",
        reasonCode: "upload_provider_discovery_timeout",
        message: `NIP-96 provider discovery timed out after ${WELL_KNOWN_DISCOVERY_TIMEOUT_MS}ms`,
        retryable: true,
        source: "nip96-well-known-discovery",
        context: {
          endpoint,
          timeoutMs: WELL_KNOWN_DISCOVERY_TIMEOUT_MS,
        },
        fingerprint: `upload|provider_discovery|${origin}`,
      });
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const discoverRootProviderApiUrls = async (
  providerUrl: string,
): Promise<ReadonlyArray<string>> => {
  try {
    const parsed = new URL(providerUrl.trim());
    const rootPath = parsed.pathname === "" || parsed.pathname === "/";
    if (!rootPath) {
      return [];
    }
    const parentHostOrigin = parsed.hostname.startsWith("cdn.")
      ? `${parsed.protocol}//${parsed.hostname.slice(4)}`
      : null;
    const [apiUrlFromSameOrigin, apiUrlFromParent] = await Promise.all([
      resolveApiUrlFromWellKnown(parsed.origin),
      parentHostOrigin
        ? resolveApiUrlFromWellKnown(parentHostOrigin)
        : Promise.resolve(null),
    ]);
    if (apiUrlFromSameOrigin) {
      return [apiUrlFromSameOrigin];
    }
    if (apiUrlFromParent) {
      return [apiUrlFromParent];
    }
    return [];
  } catch {
    return [];
  }
};
