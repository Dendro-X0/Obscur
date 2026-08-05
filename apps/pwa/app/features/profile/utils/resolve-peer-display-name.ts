import { normalizePublicKeyHex } from "./normalize-public-key-hex";

const PLACEHOLDER_PREFIX_LENGTHS = [8, 10, 12, 16] as const;
const PLACEHOLDER_SUFFIX_LENGTHS = [8, 10] as const;

const toLower = (value: string): string => value.trim().toLowerCase();

/** Compact pubkey label for UI when kind-0 / connection name is missing. */
export const formatPeerPubkeyPreview = (pubkey: string): string => {
  const normalized = normalizePublicKeyHex(pubkey)?.toLowerCase()
    ?? pubkey.trim().toLowerCase().replace(/^0x/, "");
  if (normalized.length < 16) {
    return normalized.length > 0 ? normalized : "Unknown contact";
  }
  return `${normalized.slice(0, 8)}…${normalized.slice(-8)}`;
};

/**
 * True when a candidate "name" is just the pubkey (full or truncated preview).
 * M2 — do not treat these as human display names.
 */
export const isPeerPubkeyPlaceholderName = (
  displayName: string | null | undefined,
  pubkey: string,
): boolean => {
  if (!displayName) {
    return false;
  }
  const normalizedName = displayName.trim();
  if (!normalizedName) {
    return false;
  }

  const normalizedPubkey = normalizePublicKeyHex(pubkey);
  if (!normalizedPubkey) {
    return false;
  }
  const keyLower = normalizedPubkey.toLowerCase();
  const nameLower = toLower(normalizedName);

  if (nameLower.startsWith("npub1") || nameLower.startsWith("nprofile1")) {
    return true;
  }
  if (nameLower === keyLower) {
    return true;
  }
  const asKey = normalizePublicKeyHex(normalizedName);
  if (asKey?.toLowerCase() === keyLower) {
    return true;
  }

  const sanitized = nameLower.replace(/\u2026/g, "...");
  for (const prefixLength of PLACEHOLDER_PREFIX_LENGTHS) {
    const prefix = keyLower.slice(0, prefixLength);
    if (nameLower === prefix || sanitized === `${prefix}...`) {
      return true;
    }
  }
  for (const prefixLength of PLACEHOLDER_PREFIX_LENGTHS) {
    for (const suffixLength of PLACEHOLDER_SUFFIX_LENGTHS) {
      const preview = `${keyLower.slice(0, prefixLength)}...${keyLower.slice(-suffixLength)}`;
      if (sanitized === preview) {
        return true;
      }
    }
  }
  return false;
};

const asMeaningfulName = (
  displayName: string | null | undefined,
  pubkey: string,
): string | null => {
  if (!displayName) {
    return null;
  }
  const trimmed = displayName.trim();
  if (!trimmed) {
    return null;
  }
  if (isPeerPubkeyPlaceholderName(trimmed, pubkey)) {
    return null;
  }
  return trimmed;
};

/**
 * DM / peer UI display label — never silent full-hex titles.
 * Prefer kind-0 metadata, then conversation/connection fallback, then short preview.
 */
export const resolvePeerDisplayName = (params: Readonly<{
  pubkey: string;
  metadataDisplayName?: string | null;
  fallbackDisplayName?: string | null;
}>): string => {
  const metadataName = asMeaningfulName(params.metadataDisplayName, params.pubkey);
  if (metadataName) {
    return metadataName;
  }
  const fallbackName = asMeaningfulName(params.fallbackDisplayName, params.pubkey);
  if (fallbackName) {
    return fallbackName;
  }
  return formatPeerPubkeyPreview(params.pubkey);
};
