import { inviteDbName } from "./invite-db-name";
import { inviteDbVersion } from "./invite-db-version";
import {
  CONNECTIONS_STORE,
  CONNECTION_GROUPS_STORE,
  CONNECTION_REQUESTS_STORE,
  INVITE_LINKS_STORE
} from "../constants";
import { openInMemoryIdb } from "@/app/features/storage/in-memory-idb-shim";

const INVITE_DB_SCHEMA = {
  stores: [
    {
      name: CONNECTIONS_STORE,
      keyPath: "id",
      indexes: [
        { name: "publicKey", keyPath: "publicKey", unique: true },
        { name: "displayName", keyPath: "displayName", unique: false },
        { name: "trustLevel", keyPath: "trustLevel", unique: false },
        { name: "addedAt", keyPath: "addedAt", unique: false },
      ],
    },
    { name: CONNECTION_GROUPS_STORE, keyPath: "id" },
    { name: CONNECTION_REQUESTS_STORE, keyPath: "id" },
    { name: INVITE_LINKS_STORE, keyPath: "id" },
  ],
} as const;

/** Invite/connection DB — in-memory only (IndexedDB permanently excluded). */
export const openInviteDb = async (): Promise<IDBDatabase> => (
  openInMemoryIdb(inviteDbName, inviteDbVersion, INVITE_DB_SCHEMA)
);
