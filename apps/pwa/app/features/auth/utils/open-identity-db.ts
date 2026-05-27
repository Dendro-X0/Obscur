import { identityDbName } from "./identity-db-name";
import { identityDbVersion } from "./identity-db-version";
import { identityStoreName } from "./identity-store-name";
import { openInMemoryIdb } from "@/app/features/storage/in-memory-idb-shim";

/** Identity DB — in-memory only (IndexedDB permanently excluded). */
export const openIdentityDb = async (): Promise<IDBDatabase> => (
  openInMemoryIdb(identityDbName, identityDbVersion, {
    stores: [{ name: identityStoreName, keyPath: null }],
  })
);

export const openIdentityDbInternals = {
  IDENTITY_DB_OPEN_TIMEOUT_MS: 0,
} as const;
