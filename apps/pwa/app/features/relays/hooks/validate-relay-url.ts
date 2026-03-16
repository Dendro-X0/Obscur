const TRAILING_SLASH_REGEX: RegExp = /\/+$/;

type RelayUrlValidationResult = Readonly<{
  normalizedUrl: string;
}>;

export type RelayUrlValidationOptions = Readonly<{
  allowLocalhostWs?: boolean;
}>;

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
  const allowsLocalhostWs = options?.allowLocalhostWs === true;
  const isTrustedWss = protocol === "wss:";
  const isAllowedLocalWs = allowsLocalhostWs && protocol === "ws:" && hostname === "localhost";

  if (!isTrustedWss && !isAllowedLocalWs) {
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
  if (isAllowedLocalWs && !normalized.startsWith("ws://localhost")) {
    return null;
  }

  const minimumLength = isAllowedLocalWs ? "ws://localhost".length : "wss://".length;
  if (normalized.length <= minimumLength) {
    return null;
  }
  return { normalizedUrl: normalized };
};

export { validateRelayUrl };
