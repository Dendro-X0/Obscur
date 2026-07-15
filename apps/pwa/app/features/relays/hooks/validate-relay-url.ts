const TRAILING_SLASH_REGEX: RegExp = /\/+$/;

type RelayUrlValidationResult = Readonly<{
  normalizedUrl: string;
}>;

export type RelayUrlValidationOptions = Readonly<{
  /**
   * Allow clearnet private-mesh endpoints on loopback:
   * - `ws://` localhost (workspace / local Nostr)
   * - `http(s)://` localhost (team_relay mesh HTTP gateway, C8+)
   */
  allowLocalhostWs?: boolean;
}>;

const isLoopbackHost = (hostname: string): boolean => (
  hostname === "localhost"
  || hostname === "127.0.0.1"
  || hostname === "[::1]"
);

const validateRelayUrl = (
  rawUrl: string,
  options?: RelayUrlValidationOptions,
): RelayUrlValidationResult | null => {
  const trimmed: string = rawUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  const allowsLocalhost = options?.allowLocalhostWs === true;
  const isTrustedWss = protocol === "wss:";
  const isAllowedLocalWs = allowsLocalhost && protocol === "ws:" && isLoopbackHost(hostname);
  const isAllowedLocalHttp = allowsLocalhost
    && (protocol === "http:" || protocol === "https:")
    && isLoopbackHost(hostname);

  if (!isTrustedWss && !isAllowedLocalWs && !isAllowedLocalHttp) {
    return null;
  }
  if (!hostname) {
    return null;
  }
  if (url.username || url.password) {
    return null;
  }

  const normalized: string = url.toString().replace(TRAILING_SLASH_REGEX, "");
  if (isTrustedWss && !normalized.startsWith("wss://")) {
    return null;
  }
  if (isAllowedLocalWs && !(
    normalized.startsWith("ws://localhost")
    || normalized.startsWith("ws://127.0.0.1")
    || normalized.startsWith("ws://[::1]")
  )) {
    return null;
  }
  if (isAllowedLocalHttp && !(
    normalized.startsWith("http://localhost")
    || normalized.startsWith("http://127.0.0.1")
    || normalized.startsWith("http://[::1]")
    || normalized.startsWith("https://localhost")
    || normalized.startsWith("https://127.0.0.1")
    || normalized.startsWith("https://[::1]")
  )) {
    return null;
  }

  const minimumLength = isAllowedLocalHttp
    ? "http://127.0.0.1".length
    : isAllowedLocalWs
      ? "ws://127.0.0.1".length
      : "wss://".length;
  if (normalized.length <= minimumLength) {
    return null;
  }
  return { normalizedUrl: normalized };
};

export { validateRelayUrl };
