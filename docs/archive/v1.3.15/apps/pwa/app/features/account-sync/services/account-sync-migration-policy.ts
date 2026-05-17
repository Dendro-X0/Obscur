"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";

export type AccountSyncMigrationPhase =
  | "shadow"
  | "drift_gate"
  | "read_cutover"
  | "legacy_writes_disabled";

export type AccountSyncMigrationPolicy = Readonly<{
  phase: AccountSyncMigrationPhase;
  rollbackEnabled: boolean;
  updatedAtUnixMs: number;
}>;

export type AccountSyncMigrationScope = Readonly<{
  profileId?: string | null;
  accountPublicKeyHex?: PublicKeyHex | string | null;
}>;

type AccountSyncMigrationPolicyStore = Readonly<{
  version: 2;
  entries: Readonly<Record<string, AccountSyncMigrationPolicy>>;
}>;

const STORAGE_KEY = "obscur.account_sync.migration_policy.v1";
const STORAGE_VERSION = 2;
const DEFAULT_PROFILE_ID = "default";
const DEFAULT_ACCOUNT_PARTITION = "__anonymous__";

const defaultPolicy = (): AccountSyncMigrationPolicy => ({
  phase: "shadow",
  rollbackEnabled: true,
  updatedAtUnixMs: Date.now(),
});

const isMigrationPhase = (value: unknown): value is AccountSyncMigrationPhase => (
  value === "shadow"
  || value === "drift_gate"
  || value === "read_cutover"
  || value === "legacy_writes_disabled"
);

const normalizePartitionSegment = (value: string | null | undefined, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

const buildPartitionKey = (scope?: AccountSyncMigrationScope): string => {
  const profileId = normalizePartitionSegment(
    scope?.profileId ?? getActiveProfileIdSafe(),
    DEFAULT_PROFILE_ID
  );
  const accountPublicKeyHex = normalizePartitionSegment(
    scope?.accountPublicKeyHex ?? null,
    DEFAULT_ACCOUNT_PARTITION
  );
  return `${profileId}::${accountPublicKeyHex}`;
};

const normalizePolicy = (
  value: Partial<AccountSyncMigrationPolicy> | null | undefined
): AccountSyncMigrationPolicy => {
  if (!value || !isMigrationPhase(value.phase)) {
    return defaultPolicy();
  }
  return {
    phase: value.phase,
    rollbackEnabled: value.rollbackEnabled !== false,
    updatedAtUnixMs: typeof value.updatedAtUnixMs === "number" ? value.updatedAtUnixMs : Date.now(),
  };
};

const loadStore = (): AccountSyncMigrationPolicyStore => {
  if (typeof window === "undefined") {
    return {
      version: STORAGE_VERSION,
      entries: {},
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        version: STORAGE_VERSION,
        entries: {},
      };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed
      && typeof parsed === "object"
      && (parsed as { version?: number }).version === STORAGE_VERSION
    ) {
      const entries = ((parsed as { entries?: unknown }).entries ?? {}) as Record<string, Partial<AccountSyncMigrationPolicy>>;
      const normalizedEntries: Record<string, AccountSyncMigrationPolicy> = {};
      Object.entries(entries).forEach(([partitionKey, value]) => {
        normalizedEntries[partitionKey] = normalizePolicy(value);
      });
      return {
        version: STORAGE_VERSION,
        entries: normalizedEntries,
      };
    }

    // Backward compatibility: older builds stored a single policy object.
    const legacyPolicy = normalizePolicy(parsed as Partial<AccountSyncMigrationPolicy>);
    const legacyPartitionKey = buildPartitionKey();
    return {
      version: STORAGE_VERSION,
      entries: {
        [legacyPartitionKey]: legacyPolicy,
      },
    };
  } catch {
    return {
      version: STORAGE_VERSION,
      entries: {},
    };
  }
};

const saveStore = (store: AccountSyncMigrationPolicyStore): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Keep policy non-throwing in degraded storage conditions.
  }
};

const getPolicyForScope = (scope?: AccountSyncMigrationScope): AccountSyncMigrationPolicy => {
  const store = loadStore();
  const partitionKey = buildPartitionKey(scope);
  return store.entries[partitionKey] ?? defaultPolicy();
};

export const getAccountSyncMigrationPolicy = (scope?: AccountSyncMigrationScope): AccountSyncMigrationPolicy => (
  getPolicyForScope(scope)
);

export const setAccountSyncMigrationPolicy = (
  patch: Readonly<{
    phase?: AccountSyncMigrationPhase;
    rollbackEnabled?: boolean;
  }>,
  scope?: AccountSyncMigrationScope
): AccountSyncMigrationPolicy => {
  const store = loadStore();
  const partitionKey = buildPartitionKey(scope);
  const current = store.entries[partitionKey] ?? defaultPolicy();
  const next: AccountSyncMigrationPolicy = {
    phase: patch.phase ?? current.phase,
    rollbackEnabled: patch.rollbackEnabled ?? current.rollbackEnabled,
    updatedAtUnixMs: Date.now(),
  };
  saveStore({
    version: STORAGE_VERSION,
    entries: {
      ...store.entries,
      [partitionKey]: next,
    },
  });
  return next;
};

export const setLegacyWritesDisabled = (
  enabled: boolean,
  scope?: AccountSyncMigrationScope
): AccountSyncMigrationPolicy => (
  setAccountSyncMigrationPolicy({
    phase: enabled ? "legacy_writes_disabled" : "read_cutover",
  }, scope)
);

export const shouldReadProjectionContactsDm = (policy = getAccountSyncMigrationPolicy()): boolean => (
  policy.phase === "read_cutover" || policy.phase === "legacy_writes_disabled"
);

export const shouldWriteLegacyContactsDm = (policy = getAccountSyncMigrationPolicy()): boolean => (
  policy.phase !== "legacy_writes_disabled"
);

export const accountSyncMigrationPolicyInternals = {
  STORAGE_KEY,
  STORAGE_VERSION,
  DEFAULT_PROFILE_ID,
  DEFAULT_ACCOUNT_PARTITION,
  buildPartitionKey,
  defaultPolicy,
  normalizePolicy,
  loadStore,
  saveStore,
};
