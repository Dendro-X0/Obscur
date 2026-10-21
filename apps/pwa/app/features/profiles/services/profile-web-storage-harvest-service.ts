import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { shouldSkipProfileWebStorageHarvest } from "@/app/features/runtime/unlock-hydrate-policy";

export type HarvestedLedgerSnapshot = Readonly<{
  profileSlot: string;
  publicKeyHex: string;
  entries: ReadonlyArray<Record<string, unknown>>;
  sourcePath: string;
}>;

export type HarvestedDirectorySnapshot = Readonly<{
  profileSlot: string;
  records: ReadonlyArray<Record<string, unknown>>;
  sourcePath: string;
}>;

export type HarvestedIdentitySnapshot = Readonly<{
  profileSlot: string;
  profileId: string;
  publicKeyHex: string;
  record: Record<string, unknown>;
  isPasswordless: boolean;
  sourcePath: string;
}>;

export type ProfileWebStorageHarvestResult = Readonly<{
  ledgers: ReadonlyArray<HarvestedLedgerSnapshot>;
  directories: ReadonlyArray<HarvestedDirectorySnapshot>;
  identities: ReadonlyArray<HarvestedIdentitySnapshot>;
  scannedFileCount: number;
}>;

const EMPTY_HARVEST: ProfileWebStorageHarvestResult = {
  ledgers: [],
  directories: [],
  identities: [],
  scannedFileCount: 0,
};

/** N1b / E20: picker preview reload must not re-harvest on every isolation snapshot. */
const HARVEST_CACHE_TTL_MS = 60_000;
let harvestCache: Readonly<{
  atMs: number;
  includeDefaultAppData: boolean;
  value: ProfileWebStorageHarvestResult;
}> | null = null;

export const invalidateProfileWebStorageHarvestCache = (): void => {
  harvestCache = null;
};

const parseLedgerEntries = (value: unknown): ReadonlyArray<Record<string, unknown>> => (
  Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => (
      !!entry && typeof entry === "object" && !Array.isArray(entry)
    ))
    : []
);

const parseDirectoryRecords = (value: unknown): ReadonlyArray<Record<string, unknown>> => (
  Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => (
      !!entry && typeof entry === "object" && !Array.isArray(entry)
    ))
    : []
);

const parseIdentityRecordPayload = (value: unknown): Record<string, unknown> | undefined => (
  !!value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
);

export const harvestProfileWebStorage = async (
  options?: Readonly<{ includeDefaultAppData?: boolean }>,
): Promise<ProfileWebStorageHarvestResult> => {
  if (!hasNativeRuntime()) {
    return EMPTY_HARVEST;
  }
  // Desktop thin shell: harvest is dual-bridged unlock tax — skip until Rust-owned job exists.
  if (shouldSkipProfileWebStorageHarvest()) {
    return EMPTY_HARVEST;
  }
  const includeDefaultAppData = options?.includeDefaultAppData ?? true;
  const nowMs = Date.now();
  if (
    harvestCache
    && harvestCache.includeDefaultAppData === includeDefaultAppData
    && nowMs - harvestCache.atMs < HARVEST_CACHE_TTL_MS
  ) {
    return harvestCache.value;
  }
  const result = await invokeNativeCommand<ProfileWebStorageHarvestResult>(
    "desktop_harvest_profile_web_storage",
    {
      includeDefaultAppData,
    },
  );
  if (!result.ok || !result.value) {
    return EMPTY_HARVEST;
  }
  const value: ProfileWebStorageHarvestResult = {
    scannedFileCount: result.value.scannedFileCount ?? 0,
    ledgers: (result.value.ledgers ?? []).map((snapshot) => ({
      profileSlot: snapshot.profileSlot,
      publicKeyHex: snapshot.publicKeyHex,
      entries: parseLedgerEntries(snapshot.entries),
      sourcePath: snapshot.sourcePath,
    })),
    directories: (result.value.directories ?? []).map((snapshot) => ({
      profileSlot: snapshot.profileSlot,
      records: parseDirectoryRecords(snapshot.records),
      sourcePath: snapshot.sourcePath,
    })),
    identities: (result.value.identities ?? []).flatMap((snapshot) => {
      const record = parseIdentityRecordPayload(snapshot.record);
      if (!record) {
        return [];
      }
      return [{
        profileSlot: snapshot.profileSlot,
        profileId: snapshot.profileId,
        publicKeyHex: snapshot.publicKeyHex,
        record,
        isPasswordless: snapshot.isPasswordless === true,
        sourcePath: snapshot.sourcePath,
      }];
    }),
  };
  harvestCache = { atMs: nowMs, includeDefaultAppData, value };
  return value;
};

export const listHarvestedLedgerEntriesForPubkey = (
  harvest: ProfileWebStorageHarvestResult,
  publicKeyHex: PublicKeyHex,
): ReadonlyArray<Record<string, unknown>> => {
  const normalized = publicKeyHex.trim().toLowerCase();
  return harvest.ledgers
    .filter((snapshot) => snapshot.publicKeyHex.trim().toLowerCase() === normalized)
    .flatMap((snapshot) => snapshot.entries);
};

export const listHarvestedJoinedLedgerEntriesAcrossProfiles = (
  harvest: ProfileWebStorageHarvestResult,
): ReadonlyArray<Record<string, unknown>> => (
  harvest.ledgers.flatMap((snapshot) => (
    snapshot.entries.filter((entry) => entry.status === "joined")
  ))
);

export type ProfilePickerHarvestHint = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex;
  username: string;
}>;

/** Cross-profile identity hints for the desktop picker (each WebView has isolated storage). */
export const buildProfilePickerHintsFromHarvest = async (): Promise<ReadonlyMap<string, ProfilePickerHarvestHint>> => {
  const harvest = await harvestProfileWebStorage({ includeDefaultAppData: true });
  const hints = new Map<string, ProfilePickerHarvestHint>();
  for (const snapshot of harvest.identities) {
    const username = typeof snapshot.record.username === "string" ? snapshot.record.username.trim() : "";
    const candidate: ProfilePickerHarvestHint = {
      profileId: snapshot.profileId,
      publicKeyHex: snapshot.publicKeyHex as PublicKeyHex,
      username,
    };
    for (const key of [snapshot.profileId, snapshot.profileSlot]) {
      const normalizedKey = key.trim();
      if (!normalizedKey) {
        continue;
      }
      const existing = hints.get(normalizedKey);
      if (!existing || (!existing.username && username)) {
        hints.set(normalizedKey, { ...candidate, profileId: normalizedKey });
      }
    }
  }
  return hints;
};

export const listHarvestedDirectoryCommunityIds = (
  harvest: ProfileWebStorageHarvestResult,
): ReadonlyArray<string> => {
  const communityIds = new Set<string>();
  harvest.directories.forEach((snapshot) => {
    snapshot.records.forEach((record) => {
      const communityId = typeof record.communityId === "string" ? record.communityId.trim() : "";
      if (communityId.length > 0) {
        communityIds.add(communityId);
      }
    });
  });
  return Array.from(communityIds);
};
