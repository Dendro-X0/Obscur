"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import type { AccountSyncSnapshot } from "../account-sync-contracts";

const STORAGE_KEY = "obscur.account_sync.status.v1";

const defaultSnapshot: AccountSyncSnapshot = {
  publicKeyHex: null,
  status: "identity_only",
  portabilityStatus: "unknown",
  phase: "idle",
  message: "Idle",
};

const listeners = new Set<(snapshot: AccountSyncSnapshot) => void>();
let currentSnapshot: AccountSyncSnapshot = defaultSnapshot;
let hasLoadedFromStorage = false;

const getStorageKey = (): string => getScopedStorageKey(STORAGE_KEY);

const loadSnapshotFromStorage = (): AccountSyncSnapshot => {
  if (typeof window === "undefined") {
    return currentSnapshot;
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) {
      return defaultSnapshot;
    }
    const parsed = JSON.parse(raw) as Partial<AccountSyncSnapshot>;
    return {
      ...defaultSnapshot,
      ...parsed,
    };
  } catch {
    return defaultSnapshot;
  }
};

const readSnapshot = (): AccountSyncSnapshot => {
  if (!hasLoadedFromStorage) {
    currentSnapshot = loadSnapshotFromStorage();
    hasLoadedFromStorage = true;
  }
  return currentSnapshot;
};

const writeSnapshot = (snapshot: AccountSyncSnapshot): void => {
  currentSnapshot = snapshot;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(snapshot));
    } catch {
      // Keep sync status non-fatal.
    }
  }
  for (const listener of listeners) {
    listener(snapshot);
  }
};

const mergeSnapshot = (patch: Partial<AccountSyncSnapshot>): AccountSyncSnapshot => {
  const next: AccountSyncSnapshot = {
    ...readSnapshot(),
    ...patch,
  };
  const normalized: AccountSyncSnapshot = {
    ...next,
    portabilityStatus: patch.portabilityStatus ?? derivePortabilityStatus(next),
  };
  writeSnapshot(normalized);
  return normalized;
};

const resetSnapshot = (publicKeyHex: PublicKeyHex | null = null): AccountSyncSnapshot => {
  const next: AccountSyncSnapshot = {
    ...defaultSnapshot,
    publicKeyHex,
  };
  writeSnapshot(next);
  return next;
};

const derivePortabilityStatus = (snapshot: AccountSyncSnapshot): AccountSyncSnapshot["portabilityStatus"] => {
  const profileStatus = snapshot.profileProof?.deliveryStatus ?? "unknown";
  const backupStatus = snapshot.backupProof?.deliveryStatus ?? "unknown";
  if (snapshot.status === "degraded") {
    return "degraded";
  }
  const profileGood = profileStatus === "sent_quorum" || profileStatus === "sent_partial";
  const backupGood = backupStatus === "sent_quorum" || backupStatus === "sent_partial";
  if (profileGood && backupGood) {
    return "portable";
  }
  if (profileGood) {
    return "profile_only";
  }
  if (
    profileStatus === "queued"
    || backupStatus === "queued"
    || profileStatus === "failed"
    || backupStatus === "failed"
  ) {
    return "local_only";
  }
  return "unknown";
};

const setProfileProof = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  eventId?: string;
  deliveryStatus: "sent_quorum" | "sent_partial" | "queued" | "failed";
  successCount?: number;
  totalRelays?: number;
  message?: string;
}>): AccountSyncSnapshot => {
  const current = readSnapshot();
  const next: AccountSyncSnapshot = {
    ...current,
    publicKeyHex: params.publicKeyHex,
    latestProfileEventId: params.eventId ?? current.latestProfileEventId,
    profileProof: {
      eventId: params.eventId,
      deliveryStatus: params.deliveryStatus,
      successCount: params.successCount,
      totalRelays: params.totalRelays,
      message: params.message,
      updatedAtUnixMs: Date.now(),
    },
  };
  const normalized = { ...next, portabilityStatus: derivePortabilityStatus(next) };
  writeSnapshot(normalized);
  return normalized;
};

const setBackupProof = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  eventId?: string;
  deliveryStatus: "sent_quorum" | "sent_partial" | "queued" | "failed";
  successCount?: number;
  totalRelays?: number;
  message?: string;
}>): AccountSyncSnapshot => {
  const current = readSnapshot();
  const next: AccountSyncSnapshot = {
    ...current,
    publicKeyHex: params.publicKeyHex,
    latestBackupEventId: params.eventId ?? current.latestBackupEventId,
    backupProof: {
      eventId: params.eventId,
      deliveryStatus: params.deliveryStatus,
      successCount: params.successCount,
      totalRelays: params.totalRelays,
      message: params.message,
      updatedAtUnixMs: Date.now(),
    },
  };
  const normalized = { ...next, portabilityStatus: derivePortabilityStatus(next) };
  writeSnapshot(normalized);
  return normalized;
};

export const accountSyncStatusStore = {
  getSnapshot: (): AccountSyncSnapshot => readSnapshot(),
  subscribe: (listener: (snapshot: AccountSyncSnapshot) => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setSnapshot: writeSnapshot,
  updateSnapshot: mergeSnapshot,
  setProfileProof,
  setBackupProof,
  derivePortabilityStatus,
  resetSnapshot,
};

export const accountSyncStatusStoreInternals = {
  getStorageKey,
  readSnapshot,
  loadSnapshotFromStorage,
  derivePortabilityStatus,
};
