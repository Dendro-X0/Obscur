"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountEvent } from "../account-event-contracts";

const DB_NAME = "obscur_account_event_log";
const DB_VERSION = 1;
const EVENTS_STORE = "accountEvents";
const IDENTITY_PARTITION_SEPARATOR = "::";

type StoredAccountEventRecord = Readonly<{
  storageKey: string;
  partitionKey: string;
  idempotencyKey: string;
  sequence: number;
  ingestedAtUnixMs: number;
  event: AccountEvent;
}>;

const buildPartitionKey = (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
}>): string => `${params.profileId}${IDENTITY_PARTITION_SEPARATOR}${params.accountPublicKeyHex}`;

const buildStorageKey = (partitionKey: string, idempotencyKey: string): string => (
  `${partitionKey}${IDENTITY_PARTITION_SEPARATOR}${idempotencyKey}`
);

/** In-memory account event log (IndexedDB permanently excluded). */
const recordsByStorageKey = new Map<string, StoredAccountEventRecord>();

const getRecord = async (_db: null, key: string): Promise<StoredAccountEventRecord | null> => (
  recordsByStorageKey.get(key) ?? null
);

const getLastSequence = async (_db: null, partitionKey: string): Promise<number> => {
  let max = 0;
  for (const record of recordsByStorageKey.values()) {
    if (record.partitionKey === partitionKey && record.sequence > max) {
      max = record.sequence;
    }
  }
  return max;
};

const putRecord = async (_db: null, record: StoredAccountEventRecord): Promise<void> => {
  recordsByStorageKey.set(record.storageKey, record);
};

const deleteRecord = async (_db: null, key: string): Promise<void> => {
  recordsByStorageKey.delete(key);
};

const openDb = async (): Promise<null> => null;

const isDmTimelineEventForMessageIds = (
  event: AccountEvent,
  messageIds: ReadonlySet<string>,
): boolean => {
  if (event.type !== "DM_RECEIVED" && event.type !== "DM_SENT_CONFIRMED") {
    return false;
  }
  const messageId = event.messageId.trim();
  return messageId.length > 0 && messageIds.has(messageId);
};

const loadPartitionRecords = async (_db: null, partitionKey: string): Promise<ReadonlyArray<StoredAccountEventRecord>> => {
  const ordered = [...recordsByStorageKey.values()].filter((record) => record.partitionKey === partitionKey);
  ordered.sort((left, right) => left.sequence - right.sequence);
  return ordered;
};

export const accountEventStore = {
  buildPartitionKey,
  async appendAccountEvents(params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    events: ReadonlyArray<AccountEvent>;
  }>): Promise<Readonly<{
    appendedCount: number;
    dedupeCount: number;
    lastSequence: number;
  }>> {
    if (params.events.length === 0) {
      const lastSequence = await this.getLastSequence({
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
      });
      return { appendedCount: 0, dedupeCount: 0, lastSequence };
    }
    const db = await openDb();
    const partitionKey = buildPartitionKey(params);
    let currentSequence = await getLastSequence(db, partitionKey);
    let appendedCount = 0;
    let dedupeCount = 0;
    for (const event of params.events) {
      const storageKey = buildStorageKey(partitionKey, event.idempotencyKey);
      const existing = await getRecord(db, storageKey);
      if (existing) {
        dedupeCount += 1;
        continue;
      }
      currentSequence += 1;
      const record: StoredAccountEventRecord = {
        storageKey,
        partitionKey,
        idempotencyKey: event.idempotencyKey,
        sequence: currentSequence,
        ingestedAtUnixMs: Date.now(),
        event,
      };
      await putRecord(db, record);
      appendedCount += 1;
    }
    return {
      appendedCount,
      dedupeCount,
      lastSequence: currentSequence,
    };
  },
  async loadEvents(params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
  }>): Promise<ReadonlyArray<Readonly<{ sequence: number; event: AccountEvent }>>> {
    const db = await openDb();
    const partitionKey = buildPartitionKey(params);
    const records = await loadPartitionRecords(db, partitionKey);
    return records.map((record) => ({
      sequence: record.sequence,
      event: record.event,
    }));
  },
  async getLastSequence(params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
  }>): Promise<number> {
    const db = await openDb();
    const partitionKey = buildPartitionKey(params);
    return getLastSequence(db, partitionKey);
  },
  /**
   * Physically remove DM timeline events for the given message ids so replay cannot resurrect them.
   * Used by delete-for-me after durable tombstones are written.
   */
  async redactDmTimelineEvents(params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    messageIds: ReadonlyArray<string>;
  }>): Promise<Readonly<{ redactedCount: number }>> {
    const messageIds = new Set(
      params.messageIds.map((id) => id.trim()).filter((id) => id.length > 0),
    );
    if (messageIds.size === 0) {
      return { redactedCount: 0 };
    }
    const db = await openDb();
    const partitionKey = buildPartitionKey(params);
    const records = await loadPartitionRecords(db, partitionKey);
    let redactedCount = 0;
    for (const record of records) {
      if (!isDmTimelineEventForMessageIds(record.event, messageIds)) {
        continue;
      }
      await deleteRecord(db, record.storageKey);
      redactedCount += 1;
    }
    return { redactedCount };
  },
};

export const accountEventStoreInternals = {
  DB_NAME,
  DB_VERSION,
  EVENTS_STORE,
  buildPartitionKey,
  buildStorageKey,
  openDb,
};
