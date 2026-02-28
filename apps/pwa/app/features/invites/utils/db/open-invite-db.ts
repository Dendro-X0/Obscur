import { inviteDbName } from "./invite-db-name";
import { inviteDbVersion } from "./invite-db-version";
import {
  CONNECTIONS_STORE,
  CONNECTION_GROUPS_STORE,
  CONNECTION_REQUESTS_STORE,
  INVITE_LINKS_STORE
} from "../constants";

type OpenInviteDbResult = Readonly<{
  db: IDBDatabase;
}>;

const REQUIRED_STORES: ReadonlyArray<string> = [
  CONNECTIONS_STORE,
  CONNECTION_GROUPS_STORE,
  CONNECTION_REQUESTS_STORE,
  INVITE_LINKS_STORE,
];

const hasAllRequiredStores = (db: IDBDatabase): boolean => {
  return REQUIRED_STORES.every((name: string) => db.objectStoreNames.contains(name));
};

const openDb = (versionOverride?: number): Promise<OpenInviteDbResult> => {
  return new Promise((resolve, reject) => {
    const versionToOpen: number = versionOverride ?? inviteDbVersion;
    const request: IDBOpenDBRequest = indexedDB.open(inviteDbName, versionToOpen);

    request.onupgradeneeded = () => {
      const db: IDBDatabase = request.result;

      // Create connections store with indexes
      if (!db.objectStoreNames.contains(CONNECTIONS_STORE)) {
        const connectionsStore = db.createObjectStore(CONNECTIONS_STORE, { keyPath: 'id' });
        connectionsStore.createIndex('publicKey', 'publicKey', { unique: true });
        connectionsStore.createIndex('displayName', 'displayName', { unique: false });
        connectionsStore.createIndex('trustLevel', 'trustLevel', { unique: false });
        connectionsStore.createIndex('addedAt', 'addedAt', { unique: false });
      }

      // Create connection groups store
      if (!db.objectStoreNames.contains(CONNECTION_GROUPS_STORE)) {
        const groupsStore = db.createObjectStore(CONNECTION_GROUPS_STORE, { keyPath: 'id' });
        groupsStore.createIndex('name', 'name', { unique: false });
        groupsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Create connection requests store
      if (!db.objectStoreNames.contains(CONNECTION_REQUESTS_STORE)) {
        const requestsStore = db.createObjectStore(CONNECTION_REQUESTS_STORE, { keyPath: 'id' });
        requestsStore.createIndex('type', 'type', { unique: false });
        requestsStore.createIndex('status', 'status', { unique: false });
        requestsStore.createIndex('senderPublicKey', 'senderPublicKey', { unique: false });
        requestsStore.createIndex('recipientPublicKey', 'recipientPublicKey', { unique: false });
        requestsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Create invite links store
      if (!db.objectStoreNames.contains(INVITE_LINKS_STORE)) {
        const linksStore = db.createObjectStore(INVITE_LINKS_STORE, { keyPath: 'id' });
        linksStore.createIndex('shortCode', 'shortCode', { unique: true });
        linksStore.createIndex('createdBy', 'createdBy', { unique: false });
        linksStore.createIndex('isActive', 'isActive', { unique: false });
        linksStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      const db: IDBDatabase = request.result;
      if (hasAllRequiredStores(db)) {
        resolve({ db });
        return;
      }

      // Self-repair: force an upgrade transaction to create missing stores.
      // This handles cases where the DB exists at the expected version but is missing stores
      // (e.g., schema drift or partial creation).
      const repairVersion: number = versionToOpen + 1;
      try {
        db.close();
      } catch {
        // ignore
      }
      openDb(repairVersion).then(resolve).catch(reject);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB"));
    };
  });
};

export const openInviteDb = async (): Promise<IDBDatabase> => {
  const result: OpenInviteDbResult = await openDb();
  return result.db;
};