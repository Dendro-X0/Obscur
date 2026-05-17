"use client";

const FALLBACK_INVITE_CODE_PREFIX = "OBSCUR";
const INVITE_CODE_RANDOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INVITE_CODE_SUFFIX_LENGTH = 6;

const sanitizeInviteCodePrefix = (value: string | undefined | null): string => {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.length > 0 ? normalized : FALLBACK_INVITE_CODE_PREFIX;
};

export const INVITE_CODE_PREFIX = sanitizeInviteCodePrefix(
  process.env.NEXT_PUBLIC_INVITE_CODE_PREFIX
  ?? process.env.NEXT_PUBLIC_APP_NAME
  ?? FALLBACK_INVITE_CODE_PREFIX,
);

export const normalizeInviteCodeSuffixInput = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  const maybeWithoutPrefix = normalized.startsWith(`${INVITE_CODE_PREFIX}-`)
    ? normalized.slice(INVITE_CODE_PREFIX.length + 1)
    : normalized.includes("-")
      ? normalized.slice(normalized.indexOf("-") + 1)
      : normalized;
  return maybeWithoutPrefix.replace(/[^A-Z0-9]/g, "").slice(0, INVITE_CODE_SUFFIX_LENGTH);
};

export const buildInviteCodeFromSuffix = (suffix: string): string => {
  const normalizedSuffix = normalizeInviteCodeSuffixInput(suffix);
  return normalizedSuffix.length > 0 ? `${INVITE_CODE_PREFIX}-${normalizedSuffix}` : "";
};

export const extractInviteCodeSuffix = (inviteCode: string | undefined | null): string => {
  if (!inviteCode) {
    return "";
  }
  const normalized = inviteCode.trim().toUpperCase();
  if (normalized.startsWith(`${INVITE_CODE_PREFIX}-`)) {
    return normalized.slice(INVITE_CODE_PREFIX.length + 1).slice(0, INVITE_CODE_SUFFIX_LENGTH);
  }
  return normalizeInviteCodeSuffixInput(normalized);
};

export const isCanonicalInviteCode = (inviteCode: string | undefined | null): boolean => {
  if (!inviteCode) {
    return false;
  }
  const normalized = inviteCode.trim().toUpperCase();
  return normalized === `${INVITE_CODE_PREFIX}-${extractInviteCodeSuffix(normalized)}`
    && extractInviteCodeSuffix(normalized).length === INVITE_CODE_SUFFIX_LENGTH;
};

const randomInt = (maxExclusive: number): number => {
  if (
    typeof globalThis !== "undefined"
    && typeof globalThis.crypto !== "undefined"
    && typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint32Array(1);
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0]! % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
};

export const generateRandomInviteCode = (): string => {
  let suffix = "";
  for (let i = 0; i < INVITE_CODE_SUFFIX_LENGTH; i += 1) {
    suffix += INVITE_CODE_RANDOM_ALPHABET[randomInt(INVITE_CODE_RANDOM_ALPHABET.length)];
  }
  return buildInviteCodeFromSuffix(suffix);
};

