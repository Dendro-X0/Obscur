/**
 * P2-S S1 — inbound DM/group attachment policy (Storage plane).
 * Pure allow/deny; does not write disk or render. Quarantine paths = S2.
 *
 * @see specs/backend/sandboxed-storage-security-design-2026-11.md
 */

export const INBOUND_MEDIA_DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

/** Dangerous by extension even if MIME claims image/* */
const DENY_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "cpl",
  "scr",
  "msi",
  "msp",
  "js",
  "mjs",
  "cjs",
  "vbs",
  "vbe",
  "wsf",
  "wsh",
  "ps1",
  "psm1",
  "sh",
  "bash",
  "dll",
  "so",
  "dylib",
  "jar",
  "apk",
  "app",
  "dmg",
  "pkg",
  "deb",
  "rpm",
  "html",
  "htm",
  "xhtml",
  "svg",
  "svgz",
  "hta",
  "url",
  "lnk",
  "reg",
]);

const DENY_MIME_PREFIXES = [
  "text/html",
  "application/xhtml",
  "image/svg",
  "application/javascript",
  "text/javascript",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
  "application/x-bat",
  "application/vnd.microsoft.portable-executable",
] as const;

/** Preview-safe allowlist (deny-by-default for everything else). */
const ALLOW_MIME_EXACT = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "application/pdf",
  "text/plain",
  "application/json",
]);

const ALLOW_MIME_PREFIXES = ["image/jpeg", "image/png", "audio/", "video/"] as const;

export type InboundMediaPolicyDecision =
  | Readonly<{ ok: true; action: "allow_preview" }>
  | Readonly<{
      ok: false;
      action: "deny";
      reason:
        | "too_large"
        | "deny_extension"
        | "deny_mime"
        | "unknown_type"
        | "missing_type";
      detail?: string;
    }>;

export type InboundMediaPolicyInput = Readonly<{
  mimeType?: string | null;
  fileName?: string | null;
  byteLength?: number | null;
  maxBytes?: number;
}>;

const normalizeMime = (mimeType: string): string => mimeType.trim().toLowerCase().split(";")[0]?.trim() ?? "";

const extensionOf = (fileName: string): string => {
  const base = fileName.trim().toLowerCase().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return "";
  }
  return base.slice(dot + 1);
};

const isDeniedMime = (mime: string): boolean => {
  if (!mime) {
    return false;
  }
  return DENY_MIME_PREFIXES.some((prefix) => mime === prefix || mime.startsWith(`${prefix}+`) || mime.startsWith(prefix));
};

const isAllowedMime = (mime: string): boolean => {
  if (!mime) {
    return false;
  }
  if (ALLOW_MIME_EXACT.has(mime)) {
    return true;
  }
  return ALLOW_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
};

/**
 * Evaluate whether inbound attachment metadata may enter the preview pipeline.
 * Denied types must stay quarantine-only / non-rendered until explicit export (S4).
 */
export const evaluateInboundMediaPolicy = (
  input: InboundMediaPolicyInput,
): InboundMediaPolicyDecision => {
  const maxBytes = input.maxBytes ?? INBOUND_MEDIA_DEFAULT_MAX_BYTES;
  const byteLength = typeof input.byteLength === "number" ? input.byteLength : null;
  if (byteLength !== null && (byteLength < 0 || byteLength > maxBytes)) {
    return {
      ok: false,
      action: "deny",
      reason: "too_large",
      detail: `maxBytes=${maxBytes}`,
    };
  }

  const fileName = input.fileName?.trim() ?? "";
  if (fileName) {
    const ext = extensionOf(fileName);
    if (ext && DENY_EXTENSIONS.has(ext)) {
      return {
        ok: false,
        action: "deny",
        reason: "deny_extension",
        detail: ext,
      };
    }
  }

  const mime = input.mimeType ? normalizeMime(input.mimeType) : "";
  if (mime && isDeniedMime(mime)) {
    return {
      ok: false,
      action: "deny",
      reason: "deny_mime",
      detail: mime,
    };
  }

  if (!mime && !fileName) {
    return {
      ok: false,
      action: "deny",
      reason: "missing_type",
    };
  }

  if (mime && isAllowedMime(mime)) {
    return { ok: true, action: "allow_preview" };
  }

  // Named file with non-denied extension but unknown MIME — still deny preview (S1 deny-by-default).
  return {
    ok: false,
    action: "deny",
    reason: mime ? "unknown_type" : "missing_type",
    detail: mime || undefined,
  };
};

export const inboundMediaPolicyInternals = {
  DENY_EXTENSIONS,
  ALLOW_MIME_EXACT,
  normalizeMime,
  extensionOf,
};
