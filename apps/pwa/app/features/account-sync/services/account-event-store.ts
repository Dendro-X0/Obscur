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

const openDb = async (): Promise<IDBDatabase> => {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable in this runtime.");
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const store = db.createObjectStore(EVENTS_STORE, { keyPath: "storageKey" });
        store.createIndex("partition_sequence", ["partitionKey", "sequence"], { unique: false });
        store.createIndex("partition_idempotency", ["partitionKey", "idempotencyKey"], { unique: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open account event database."));
  });
};

const transactionDone = (transaction: IDBTransaction): Promise<void> => (
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  })
);

const getRecord = async (db: IDBDatabase, key: string): Promise<StoredAccountEventRecord | null> => {
  const transaction = db.transaction(EVENTS_STORE, "readonly");
  const store = transaction.objectStore(EVENTS_STORE);
  const request = store.get(key);
  const record = await new Promise<StoredAccountEventRecord | null>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as StoredAccountEventRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to read account event."));
  });
  await transactionDone(transaction);
  return record;
};

const getLastSequence = async (db: IDBDatabase, partitionKey: string): Promise<number> => {
  const transaction = db.transaction(EVENTS_STORE, "readonly");
  const store = transaction.objectStore(EVENTS_STORE);
  const index = store.index("partition_sequence");
  const lowerBound = [partitionKey, Number.MIN_SAFE_INTEGER];
  const upperBound = [partitionKey, Number.MAX_SAFE_INTEGER];
  const request = index.openCursor(IDBKeyRange.bound(lowerBound, upperBound), "prev");
  const sequence = await new Promise<number>((resolve, reject) => {
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(0);
        return;
      }
      const record = cursor.value as StoredAccountEventRecord;
      resolve(record.sequence);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to inspect account event sequence."));
  });
  await transactionDone(transaction);
  return sequence;
};

const putRecord = async (db: IDBDatabase, record: StoredAccountEventRecord): Promise<void> => {
  const transaction = db.transaction(EVENTS_STORE, "readwrite");
  const store = transaction.objectStore(EVENTS_STORE);
  store.put(record);
  await transactionDone(transaction);
};

const loadPartitionRecords = async (db: IDBDatabase, partitionKey: string): Promise<ReadonlyArray<StoredAccountEventRecord>> => {
  const transaction = db.transaction(EVENTS_STORE, "readonly");
  const store = transaction.objectStore(EVENTS_STORE);
  const index = store.index("partition_sequence");
  const request = index.getAll(IDBKeyRange.bound(
    [partitionKey, Number.MIN_SAFE_INTEGER],
    [partitionKey, Number.MAX_SAFE_INTEGER],
  ));
  const records = await new Promise<ReadonlyArray<StoredAccountEventRecord>>((resolve, reject) => {
    request.onsuccess = () => {
      const value = (request.result as ReadonlyArray<StoredAccountEventRecord> | undefined) ?? [];
      resolve(value);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to load account event records."));
  });
  await transactionDone(transaction);
  const ordered = [...records];
  ordered.sort((left: StoredAccountEventRecord, right: StoredAccountEventRecord) => left.sequence - right.sequence);
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
    db.close();
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
    db.close();
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
    const sequence = await getLastSequence(db, partitionKey);
    db.close();
    return sequence;
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
