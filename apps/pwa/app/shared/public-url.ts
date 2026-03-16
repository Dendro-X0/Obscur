type NormalizePublicUrlOptions = Readonly<{
  origin?: string | null;
}>;

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const LOCAL_PATH_PREFIX = "/";

const getWindowOrigin = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.location?.origin ?? null;
};

const isAbsoluteHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return HTTP_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
};

export const normalizePublicUrl = (
  value: string | null | undefined,
  options?: NormalizePublicUrlOptions
): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "";
  }

  if (isAbsoluteHttpUrl(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith(LOCAL_PATH_PREFIX)) {
    const origin = Object.prototype.hasOwnProperty.call(options ?? {}, "origin")
      ? options?.origin ?? null
      : getWindowOrigin();
    if (!origin) {
      return trimmed;
    }
    try {
      return new URL(trimmed, origin).toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

export const isSupportedPublicUrl = (value: string | null | undefined): boolean => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return true;
  }
  return isAbsoluteHttpUrl(trimmed) || trimmed.startsWith(LOCAL_PATH_PREFIX);
};

export const publicUrlInternals = {
  isAbsoluteHttpUrl,
};
