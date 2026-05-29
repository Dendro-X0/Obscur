import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

export const COORDINATION_FETCH_TIMEOUT_MS = 8_000;

export type CoordinationFetchErrorCode = "network_unreachable" | "timeout" | "unknown";

export class CoordinationFetchError extends Error {
  readonly code: CoordinationFetchErrorCode;

  constructor(code: CoordinationFetchErrorCode, cause?: unknown) {
    const message = code === "timeout"
      ? "coordination_timeout"
      : code === "network_unreachable"
        ? "coordination_unreachable"
        : "coordination_fetch_failed";
    super(message);
    this.name = "CoordinationFetchError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/** Swap loopback hostname on the full request URL (path + query preserved). */
export const alternateLoopbackCoordinationUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    } else if (parsed.hostname === "127.0.0.1") {
      parsed.hostname = "localhost";
    } else {
      return null;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    // ignore malformed URLs
  }
  return null;
};

const classifyFetchFailure = (error: unknown): CoordinationFetchError => {
  if (error instanceof CoordinationFetchError) {
    return error;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new CoordinationFetchError("timeout", error);
  }
  return new CoordinationFetchError("network_unreachable", error);
};

const toHeaderRecord = (headers?: HeadersInit): Record<string, string> | undefined => {
  if (!headers) {
    return undefined;
  }
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
};

type CoordinationFetchImpl = (
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
) => Promise<Response>;

let cachedNativeFetchImpl: CoordinationFetchImpl | null = null;

const createBrowserFetchImpl = (): CoordinationFetchImpl => async (url, init, timeoutMs) => {
  if (typeof AbortController === "undefined") {
    try {
      return await fetch(url, init);
    } catch (error) {
      throw classifyFetchFailure(error);
    }
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw classifyFetchFailure(error);
  } finally {
    clearTimeout(timeoutId);
  }
};

const createNativeFetchImpl = (): CoordinationFetchImpl => async (url, init, timeoutMs) => {
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = toHeaderRecord(init?.headers);
  const bodyText = typeof init?.body === "string" ? init.body : undefined;
  try {
    return await tauriFetch(url, {
      method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
      headers,
      ...(bodyText
        ? { body: { type: "Text", payload: bodyText } as const }
        : {}),
      connectTimeout: timeoutMs,
    } as Parameters<typeof tauriFetch>[1]);
  } catch (error) {
    throw classifyFetchFailure(error);
  }
};

/** Loopback coordination is reached reliably via WebView fetch (CORS *); Tauri native POST often 502 on Windows. */
export const isLoopbackCoordinationUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
};

const resolveFetchImpl = async (url: string): Promise<CoordinationFetchImpl> => {
  if (isLoopbackCoordinationUrl(url)) {
    return createBrowserFetchImpl();
  }
  if (!hasNativeRuntime()) {
    return createBrowserFetchImpl();
  }
  if (!cachedNativeFetchImpl) {
    cachedNativeFetchImpl = createNativeFetchImpl();
  }
  return cachedNativeFetchImpl;
};

const fetchOnce = async (
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> => {
  const fetchImpl = await resolveFetchImpl(url);
  const response = await fetchImpl(url, init, timeoutMs);
  if (
    hasNativeRuntime()
    && !isLoopbackCoordinationUrl(url)
    && (response.status === 502 || response.status === 503 || response.status === 504)
  ) {
    return createBrowserFetchImpl()(url, init, timeoutMs);
  }
  return response;
};

export const fetchCoordinationWithTimeout = async (
  url: string,
  init?: RequestInit,
  options?: Readonly<{ timeoutMs?: number; retryAlternateLoopback?: boolean }>,
): Promise<Response> => {
  const timeoutMs = options?.timeoutMs ?? COORDINATION_FETCH_TIMEOUT_MS;
  const retryAlternateLoopback = options?.retryAlternateLoopback ?? true;
  try {
    const response = await fetchOnce(url, init, timeoutMs);
    if (
      retryAlternateLoopback
      && !response.ok
      && (response.status === 502 || response.status === 503 || response.status === 504)
    ) {
      const alternateUrl = alternateLoopbackCoordinationUrl(url);
      if (alternateUrl && alternateUrl !== url) {
        const retryResponse = await fetchOnce(alternateUrl, init, timeoutMs);
        if (retryResponse.ok) {
          return retryResponse;
        }
      }
    }
    return response;
  } catch (firstError) {
    const classified = classifyFetchFailure(firstError);
    if (!retryAlternateLoopback || classified.code !== "network_unreachable") {
      throw classified;
    }
    const alternateUrl = alternateLoopbackCoordinationUrl(url);
    if (!alternateUrl || alternateUrl === url) {
      throw classified;
    }
    return fetchOnce(alternateUrl, init, timeoutMs);
  }
};

export const describeCoordinationFetchError = (code: string | undefined): string => {
  switch (code) {
    case "coordination_unreachable":
    case "coordination_timeout":
      return "Coordination service is not reachable from the desktop app. If curl http://127.0.0.1:8787/health works in a terminal, keep coordination running and restart the desktop app after updating.";
    case "coordination_not_configured":
      return "Coordination URL is not configured. Set NEXT_PUBLIC_COORDINATION_URL or use Settings → Relays → operator trust setup.";
    case "sign_failed":
    case "native_signing_unavailable":
      return "Could not sign the membership update with your identity key. Unlock the profile or restart the desktop app.";
    default:
      return code?.startsWith("http_")
        ? `Coordination service returned ${code.replace("http_", "")}.`
        : "Coordination membership publish failed.";
  }
};

/** Test-only reset for cached native fetch implementation. */
export const resetCoordinationFetchImplForTests = (): void => {
  cachedNativeFetchImpl = null;
};
