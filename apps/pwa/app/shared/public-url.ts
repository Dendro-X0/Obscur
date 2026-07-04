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

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
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

/** Remote media URLs must be absolute https — never host-only paths that Tauri treats as local objects. */
export const normalizeAttachmentUrl = (
  value: string | null | undefined,
  options?: NormalizePublicUrlOptions,
): string => {
  const trimmed = (value ?? "").trim().replace(/[)\],.;]+$/g, "");
  if (!trimmed) {
    return "";
  }

  const hostLikeRelativePath = trimmed.match(/^\/+([a-z0-9.-]+\.[a-z]{2,}\/.+)/i);
  if (hostLikeRelativePath) {
    return `https://${hostLikeRelativePath[1]}`;
  }

  const normalized = normalizePublicUrl(trimmed, options);
  if (isAbsoluteHttpUrl(normalized)) {
    return normalized;
  }

  if (normalized.startsWith(LOCAL_PATH_PREFIX)) {
    const origin = Object.prototype.hasOwnProperty.call(options ?? {}, "origin")
      ? options?.origin ?? null
      : getWindowOrigin();
    if (!origin) {
      return normalized;
    }
    try {
      return new URL(normalized, origin).toString();
    } catch {
      return normalized;
    }
  }

  const withoutLeadingSlashes = normalized.replace(/^\/+/, "");
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[:/]|$)/i.test(withoutLeadingSlashes)) {
    return `https://${withoutLeadingSlashes}`;
  }

  return normalized;
};

export const isSupportedPublicUrl = (value: string | null | undefined): boolean => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return true;
  }
  if (isAbsoluteHttpUrl(trimmed) || trimmed.startsWith(LOCAL_PATH_PREFIX)) {
    return true;
  }
  const coerced = normalizeAttachmentUrl(trimmed);
  return isAbsoluteHttpUrl(coerced) || coerced.startsWith(LOCAL_PATH_PREFIX);
};

export const publicUrlInternals = {
  isAbsoluteHttpUrl,
};
