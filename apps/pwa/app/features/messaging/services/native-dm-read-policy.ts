import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * Native DM display read — delegated to v2 dm-kernel (SQLite + messageBus append-only).
 * Legacy hydrate pipeline must not run when this is true.
 *
 * @see docs/program/obscur-v2-slim-kernel-manifest.md
 */
export const isNativeDmSqliteReadOwner = (): boolean => isDmKernelAuthority();

/**
 * Native DM durable writes use SQLite only (`MessagePersistenceService` → `db_insert_message`).
 * IndexedDB `MessageQueue` must not be treated as durable storage on native.
 */
export const nativeDmSkipsIndexedDbMessageQueue = (): boolean => requiresSqlitePersistence();
