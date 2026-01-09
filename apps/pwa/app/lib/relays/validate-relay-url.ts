const TRAILING_SLASH_REGEX: RegExp = /\/+$/;

type RelayUrlValidationResult = Readonly<{
  normalizedUrl: string;
}>;

const validateRelayUrl = (rawUrl: string): RelayUrlValidationResult | null => {
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
  if (url.protocol !== "wss:") {
    return null;
  }
  if (!url.hostname) {
    return null;
  }
  const normalized: string = url.toString().replace(TRAILING_SLASH_REGEX, "");
  if (!normalized.startsWith("wss://")) {
    return null;
  }
  if (normalized.length <= "wss://".length) {
    return null;
  }
  return { normalizedUrl: normalized };
};

export { validateRelayUrl };
