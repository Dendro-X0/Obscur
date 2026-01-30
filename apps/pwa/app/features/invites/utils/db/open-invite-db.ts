import { inviteDbName } from "./invite-db-name";
import { inviteDbVersion } from "./invite-db-version";
import { 
  CONTACTS_STORE, 
  CONTACT_GROUPS_STORE, 
  CONTACT_REQUESTS_STORE, 
  INVITE_LINKS_STORE 
} from "../constants";

type OpenInviteDbResult = Readonly<{
  db: IDBDatabase;
}>;

const openDb = (): Promise<OpenInviteDbResult> => {
  return new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(inviteDbName, inviteDbVersion);
    
    request.onupgradeneeded = () => {
      const db: IDBDatabase = request.result;
      
      // Create contacts store with indexes
      if (!db.objectStoreNames.contains(CONTACTS_STORE)) {
        const contactsStore = db.createObjectStore(CONTACTS_STORE, { keyPath: 'id' });
        contactsStore.createIndex('publicKey', 'publicKey', { unique: true });
        contactsStore.createIndex('displayName', 'displayName', { unique: false });
        contactsStore.createIndex('trustLevel', 'trustLevel', { unique: false });
        contactsStore.createIndex('addedAt', 'addedAt', { unique: false });
      }
      
      // Create contact groups store
      if (!db.objectStoreNames.contains(CONTACT_GROUPS_STORE)) {
        const groupsStore = db.createObjectStore(CONTACT_GROUPS_STORE, { keyPath: 'id' });
        groupsStore.createIndex('name', 'name', { unique: false });
        groupsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Create contact requests store
      if (!db.objectStoreNames.contains(CONTACT_REQUESTS_STORE)) {
        const requestsStore = db.createObjectStore(CONTACT_REQUESTS_STORE, { keyPath: 'id' });
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
      resolve({ db: request.result });
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