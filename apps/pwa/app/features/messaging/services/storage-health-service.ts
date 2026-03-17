"use client";

import { messagingDB } from "@dweb/storage/indexed-db";
import {
  getLocalMediaIndexSnapshot,
  repairLocalMediaIndex,
} from "@/app/features/vault/services/local-media-store";
import { incrementReliabilityMetric } from "@/app/shared/reliability-observability";

export type StorageHealthState = Readonly<{
  messageStoreOk: boolean;
  queueStoreOk: boolean;
  mediaIndexOk: boolean;
  checkedAtUnixMs: number;
  errorMessage?: string;
}>;

export type StorageRecoveryReport = Readonly<{
  status: "ok" | "repaired";
  repairedEntries: number;
  removedEntries: number;
  recoveredEntries: number;
  durationMs: number;
  ranAtUnixMs: number;
}>;

const DEFAULT_HEALTH: StorageHealthState = {
  messageStoreOk: true,
  queueStoreOk: true,
  mediaIndexOk: true,
  checkedAtUnixMs: 0,
};

let lastHealthState: StorageHealthState = DEFAULT_HEALTH;

const validateMediaIndexIntegrity = (): boolean => {
  const index = getLocalMediaIndexSnapshot();
  const entries = Object.values(index);
  return entries.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    if (typeof entry.remoteUrl !== "string" || entry.remoteUrl.length === 0) return false;
    if (typeof entry.relativePath !== "string" || entry.relativePath.length === 0) return false;
    if (!Number.isFinite(entry.savedAtUnixMs)) return false;
    if (!Number.isFinite(entry.size)) return false;
    return true;
  });
};

export const checkStorageHealth = async (): Promise<StorageHealthState> => {
  let messageStoreOk = true;
  let queueStoreOk = true;
  let mediaIndexOk = true;
  let errorMessage: string | undefined;

  try {
    await messagingDB.getAllByIndex("messages", "conversation_timestamp", IDBKeyRange.bound(["", 0], ["~", Date.now()]), 1);
  } catch (error) {
    messageStoreOk = false;
    incrementReliabilityMetric("storage_write_retry");
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  try {
    await messagingDB.get("chatState", "__health__");
  } catch (error) {
    queueStoreOk = false;
    incrementReliabilityMetric("storage_write_retry");
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  try {
    mediaIndexOk = validateMediaIndexIntegrity();
  } catch (error) {
    mediaIndexOk = false;
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  if (!messageStoreOk || !queueStoreOk || !mediaIndexOk) {
    incrementReliabilityMetric("storage_health_failed");
  }

  lastHealthState = {
    messageStoreOk,
    queueStoreOk,
    mediaIndexOk,
    checkedAtUnixMs: Date.now(),
    errorMessage,
  };
  return lastHealthState;
};

export const getLastStorageHealthState = (): StorageHealthState => lastHealthState;

export const runStorageRecovery = async (): Promise<StorageRecoveryReport> => {
  const startedAt = Date.now();
  incrementReliabilityMetric("storage_recovery_runs");
  const result = repairLocalMediaIndex();
  const repairedEntries = result.repaired + result.removed;
  if (repairedEntries > 0) {
    incrementReliabilityMetric("storage_recovery_records", repairedEntries);
  }
  return {
    status: repairedEntries > 0 ? "repaired" : "ok",
    repairedEntries: result.repaired,
    removedEntries: result.removed,
    recoveredEntries: repairedEntries,
    durationMs: Date.now() - startedAt,
    ranAtUnixMs: Date.now(),
  };
};
