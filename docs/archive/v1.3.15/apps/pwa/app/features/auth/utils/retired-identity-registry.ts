import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const RETIRED_IDENTITY_REGISTRY_STORAGE_KEY = "obscur.retired_identity_registry.v1";
const MAX_RETIRED_IDENTITY_ENTRIES = 64;

type RetiredIdentityRegistryEntry = Readonly<{
  publicKeyHex: PublicKeyHex;
  retiredAtUnixMs: number;
  profileId?: string;
}>;

type RetiredIdentityRegistryPayload = Readonly<{
  entries: ReadonlyArray<RetiredIdentityRegistryEntry>;
}>;

const toSanitizedProfileId = (value: string | undefined): string | undefined => {
  const sanitized = value?.trim();
  return sanitized && sanitized.length > 0 ? sanitized : undefined;
};

const parseRegistryPayload = (value: string | null): RetiredIdentityRegistryPayload => {
  if (!value) {
    return { entries: [] };
  }
  try {
    const parsed = JSON.parse(value) as Partial<RetiredIdentityRegistryPayload> | null;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    const normalizedEntries = parsed.entries
      .map<RetiredIdentityRegistryEntry | null>((entry) => {
        const normalizedPublicKeyHex = normalizePublicKeyHex(entry?.publicKeyHex);
        if (!normalizedPublicKeyHex) {
          return null;
        }
        const retiredAtUnixMs = Number.isFinite(entry?.retiredAtUnixMs)
          ? Math.max(0, Math.floor(entry!.retiredAtUnixMs as number))
          : Date.now();
        const profileId = toSanitizedProfileId(entry?.profileId);
        return {
          publicKeyHex: normalizedPublicKeyHex,
          retiredAtUnixMs,
          ...(profileId ? { profileId } : {}),
        };
      })
      .filter((entry): entry is RetiredIdentityRegistryEntry => entry !== null);
    return { entries: normalizedEntries };
  } catch {
    return { entries: [] };
  }
};

const readRegistryPayload = (): RetiredIdentityRegistryPayload => {
  if (typeof window === "undefined") {
    return { entries: [] };
  }
  return parseRegistryPayload(window.localStorage.getItem(RETIRED_IDENTITY_REGISTRY_STORAGE_KEY));
};

const writeRegistryPayload = (payload: RetiredIdentityRegistryPayload): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (payload.entries.length === 0) {
    window.localStorage.removeItem(RETIRED_IDENTITY_REGISTRY_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(RETIRED_IDENTITY_REGISTRY_STORAGE_KEY, JSON.stringify(payload));
};

export const markRetiredIdentityPublicKey = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): void => {
  const normalizedPublicKeyHex = normalizePublicKeyHex(params.publicKeyHex);
  if (!normalizedPublicKeyHex) {
    return;
  }
  const current = readRegistryPayload();
  const deduped = current.entries.filter((entry) => entry.publicKeyHex !== normalizedPublicKeyHex);
  const nextEntries = [{
    publicKeyHex: normalizedPublicKeyHex,
    retiredAtUnixMs: Date.now(),
    profileId: toSanitizedProfileId(params.profileId),
  } as const, ...deduped].slice(0, MAX_RETIRED_IDENTITY_ENTRIES);
  writeRegistryPayload({ entries: nextEntries });
};

export const isRetiredIdentityPublicKey = (publicKeyHex: string | null | undefined): boolean => {
  const normalizedPublicKeyHex = normalizePublicKeyHex(publicKeyHex ?? undefined);
  if (!normalizedPublicKeyHex) {
    return false;
  }
  return readRegistryPayload().entries.some((entry) => entry.publicKeyHex === normalizedPublicKeyHex);
};

export const captureRetiredIdentityRegistrySnapshot = (): RetiredIdentityRegistryPayload => {
  return readRegistryPayload();
};

export const restoreRetiredIdentityRegistrySnapshot = (payload: RetiredIdentityRegistryPayload): void => {
  const normalizedPayload = parseRegistryPayload(JSON.stringify(payload ?? { entries: [] }));
  writeRegistryPayload(normalizedPayload);
};
