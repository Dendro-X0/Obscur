/**
 * Greenfield persistence policy — IndexedDB is permanently excluded from Obscur.
 * Durable state uses SQLite (@dweb/db) on native and chat-state localStorage on web.
 * @see docs/greenfield/07-repository-strategy.md
 */

import { hasNativeRuntime } from "./runtime-capabilities";

/** IndexedDB must never be opened or used as an authority in this codebase. */
export const INDEXED_DB_PERMANENTLY_EXCLUDED = true as const;

export const indexedDbPermanentlyExcluded = (): boolean => INDEXED_DB_PERMANENTLY_EXCLUDED;

/** DM hydrate: no IndexedDB message-window fallback; persisted chat-state only on web. */
export const getDmHydrateRecoveryFlags = (): Readonly<{
  allowLegacyPersistedAuthority: boolean;
  allowIndexedDbMessageWindowFallback: boolean;
}> => {
  const native = hasNativeRuntime();
  return {
    allowLegacyPersistedAuthority: !native,
    allowIndexedDbMessageWindowFallback: false,
  };
};
