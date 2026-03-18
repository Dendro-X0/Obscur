import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";

const PLACEHOLDER_PREFIX_LENGTHS = [8, 10, 12, 16] as const;
const PLACEHOLDER_SUFFIX_LENGTHS = [8, 10] as const;

const toLower = (value: string): string => value.trim().toLowerCase();

const addUnique = (parts: Array<string>, value: string | null | undefined): void => {
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  if (!parts.includes(trimmed)) {
    parts.push(trimmed);
  }
};

const buildFallback = (pubkey: string): string => {
  if (pubkey.length < 20) {
    return pubkey;
  }
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
};

const isPreviewFromPubkey = (displayName: string, normalizedPubkey: string): boolean => {
  const lower = toLower(displayName);
  const sanitized = lower.replace(/\u2026/g, "...");

  for (const prefixLength of PLACEHOLDER_PREFIX_LENGTHS) {
    const prefix = normalizedPubkey.slice(0, prefixLength);
    if (lower === prefix || sanitized === `${prefix}...`) {
      return true;
    }
  }

  for (const prefixLength of PLACEHOLDER_PREFIX_LENGTHS) {
    for (const suffixLength of PLACEHOLDER_SUFFIX_LENGTHS) {
      const preview = `${normalizedPubkey.slice(0, prefixLength)}...${normalizedPubkey.slice(-suffixLength)}`;
      if (sanitized === preview) {
        return true;
      }
    }
  }

  return false;
};

export const isPubkeyPlaceholderName = (displayName: string | null | undefined, pubkey: string): boolean => {
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

  const normalizedNamePubkey = normalizePublicKeyHex(normalizedName);
  if (normalizedNamePubkey?.toLowerCase() === keyLower) {
    return true;
  }

  return isPreviewFromPubkey(normalizedName, keyLower);
};

const asMeaningfulName = (displayName: string | null | undefined, pubkey: string): string | null => {
  if (!displayName) {
    return null;
  }
  const trimmed = displayName.trim();
  if (!trimmed) {
    return null;
  }
  if (isPubkeyPlaceholderName(trimmed, pubkey)) {
    return null;
  }
  return trimmed;
};

export const resolveInviteConnectionDisplayName = (input: {
  pubkey: string;
  metadataDisplayName?: string | null;
  connectionDisplayName?: string | null;
}): string => {
  const metadataName = asMeaningfulName(input.metadataDisplayName, input.pubkey);
  if (metadataName) {
    return metadataName;
  }

  const connectionName = asMeaningfulName(input.connectionDisplayName, input.pubkey);
  if (connectionName) {
    return connectionName;
  }

  return buildFallback(input.pubkey);
};

export const toInviteConnectionSearchText = (input: {
  pubkey: string;
  resolvedDisplayName: string;
  metadataDisplayName?: string | null;
  connectionDisplayName?: string | null;
}): string => {
  const terms: Array<string> = [];
  addUnique(terms, input.resolvedDisplayName);
  addUnique(terms, input.metadataDisplayName);
  addUnique(terms, input.connectionDisplayName);
  addUnique(terms, input.pubkey);
  return terms.join(" ").toLowerCase();
};
