/**
 * React Hook for Community Membership CRDT
 * 
 * Provides reactive CRDT-based membership management for communities.
 * Replaces the snapshot-based `useSealedCommunity` for membership tracking.
 * 
 * @example
 * ```tsx
 * function CommunityMembers({ communityId }: { communityId: string }) {
 *   const { members, addMember, removeMember, isLoading, error } = useCommunityMembershipCRDT(
 *     communityId,
 *     currentUserPubkey,
 *     currentDeviceId
 *   );
 *   
 *   return (
 *     <MemberList
 *       members={members}
 *       onAdd={addMember}
 *       onRemove={removeMember}
 *       isLoading={isLoading}
 *     />
 *   );
 * }
 * ```
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type {
  CommunityMembership,
  MemberWithMetadata,
  SerializedMembership,
} from '../services/community-membership-crdt';
import {
  createCommunityMembership,
  addMember,
  removeMember,
  mergeMembership,
  queryMembers,
  queryMembersWithMetadata,
  isMember,
  serializeMembership,
  deserializeMembership,
  getMemberCount,
  needsCompaction,
  compactMembership,
  getMembershipDiagnostics,
  migrateFromLegacy,
} from '../services/community-membership-crdt';
import { createVectorClock } from '@dweb/crdt/vector-clock';

/**
 * Hook return value interface.
 */
export interface UseCommunityMembershipCRDTReturn {
  /** Current member pubkeys */
  members: string[];
  
  /** Members with full metadata */
  membersWithMetadata: MemberWithMetadata[];
  
  /** Member count */
  memberCount: number;
  
  /** Add a member */
  addMember: (pubkey: string) => void;
  
  /** Remove a member */
  removeMember: (pubkey: string) => void;

  /** Remove many members in one state update */
  removeMembers: (pubkeys: ReadonlyArray<string>) => void;
  
  /** Check if pubkey is member */
  isMember: (pubkey: string) => boolean;
  
  /** Manual sync with remote state (for gossip/reconciliation) */
  syncWithRemote: (serializedRemote: string) => void;
  
  /** Export current state for persistence/gossip */
  exportState: () => string;
  
  /** Import state (for restore from backup) */
  importState: (serialized: string) => void;
  
  /** Is CRDT feature enabled */
  isEnabled: boolean;
  
  /** Is loading from storage */
  isLoading: boolean;
  
  /** Any errors */
  error: Error | null;
  
  /** Diagnostics for debugging */
  diagnostics: ReturnType<typeof getMembershipDiagnostics> | null;
  
  /** Force compaction */
  compact: () => void;
}

/**
 * React hook for CRDT-based community membership.
 */
export function useCommunityMembershipCRDT(
  communityId: string | null,
  localPubkey: string,
  deviceId: string
): UseCommunityMembershipCRDTReturn {
  // CRDT is always enabled (feature flags removed)
  const isEnabled = true;
  
  // State
  const [membership, setMembership] = useState<CommunityMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Refs for stable callbacks
  const membershipRef = useRef(membership);
  membershipRef.current = membership;
  
  // Initialize membership
  useEffect(() => {
    if (!isEnabled || !communityId) {
      setIsLoading(false);
      return;
    }
    
    const init = async () => {
      try {
        setIsLoading(true);
        
        // Try to restore from storage
        const stored = await loadFromStorage(communityId);
        
        if (stored) {
          const restored = deserializeMembership(stored);
          setMembership(restored);
          logDebug('restored', communityId, restored);
        } else {
          // Create new membership
          const initial = createCommunityMembership(
            communityId,
            deviceId,
            createVectorClock(deviceId, 0)
          );
          setMembership(initial);
          logDebug('created', communityId, initial);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };
    
    init();
  }, [communityId, deviceId, isEnabled]);
  
  // Persist to storage on change
  useEffect(() => {
    if (!membership || !isEnabled) return;
    
    const persist = async () => {
      try {
        await saveToStorage(membership.communityId, serializeMembership(membership));
      } catch (err) {
        console.error('Failed to persist membership:', err);
      }
    };
    
    // Debounce persistence
    const timeoutId = setTimeout(persist, 100);
    return () => clearTimeout(timeoutId);
  }, [membership, isEnabled]);
  
  // Derived values — keep array reference stable when membership metadata changes without roster drift.
  const membersStableRef = useRef<string[]>([]);
  const members = useMemo(() => {
    if (!membership) {
      membersStableRef.current = [];
      return membersStableRef.current;
    }
    const next = Array.from(queryMembers(membership));
    const nextFingerprint = next.slice().sort().join(",");
    const prevFingerprint = membersStableRef.current.slice().sort().join(",");
    if (nextFingerprint === prevFingerprint) {
      return membersStableRef.current;
    }
    membersStableRef.current = next;
    return next;
  }, [membership]);
  
  const membersWithMetadata = useMemo(() => {
    if (!membership) return [];
    return queryMembersWithMetadata(membership);
  }, [membership]);
  
  const memberCount = useMemo(() => {
    if (!membership) return 0;
    return getMemberCount(membership);
  }, [membership]);
  
  const diagnostics = useMemo(() => {
    if (!membership) return null;
    return getMembershipDiagnostics(membership);
  }, [membership]);
  
  // Callbacks
  const addMemberCallback = useCallback((pubkey: string) => {
    setMembership((prev) => {
      if (!prev || !isEnabled) return prev;
      if (isMember(prev, pubkey)) return prev;
      const updated = addMember(prev, pubkey, deviceId);
      logDebug('add', communityId, { pubkey, count: getMemberCount(updated) });
      return updated;
    });
  }, [deviceId, communityId, isEnabled]);
  
  const removeMemberCallback = useCallback((pubkey: string) => {
    setMembership((prev) => {
      if (!prev || !isEnabled) return prev;
      if (!isMember(prev, pubkey)) return prev;
      const updated = removeMember(prev, pubkey, deviceId);
      logDebug('remove', communityId, { pubkey, count: getMemberCount(updated) });
      return updated;
    });
  }, [deviceId, communityId, isEnabled]);

  const removeMembersCallback = useCallback((pubkeys: ReadonlyArray<string>) => {
    if (pubkeys.length === 0) return;
    setMembership((prev) => {
      if (!prev || !isEnabled) return prev;
      let updated = prev;
      let changed = false;
      for (const pubkey of pubkeys) {
        if (!isMember(updated, pubkey)) continue;
        updated = removeMember(updated, pubkey, deviceId);
        changed = true;
      }
      if (!changed) return prev;
      logDebug('remove-batch', communityId, { count: getMemberCount(updated) });
      return updated;
    });
  }, [deviceId, communityId, isEnabled]);
  
  const isMemberCallback = useCallback((pubkey: string) => {
    if (!membershipRef.current) return false;
    return isMember(membershipRef.current, pubkey);
  }, []);
  
  const syncWithRemoteCallback = useCallback((serializedRemote: string) => {
    try {
      const remote = deserializeMembership(JSON.parse(serializedRemote));
      setMembership((prev) => {
        if (!prev || !isEnabled) return prev;
        const merged = mergeMembership(prev, remote);
        logDebug('sync', communityId, {
          remoteDevice: remote.localDeviceId,
          count: getMemberCount(merged),
        });
        return merged;
      });
    } catch (err) {
      console.error('Failed to sync with remote:', err);
    }
  }, [communityId, isEnabled]);
  
  const exportStateCallback = useCallback(() => {
    if (!membershipRef.current) return '';
    return JSON.stringify(serializeMembership(membershipRef.current));
  }, []);
  
  const importStateCallback = useCallback((serialized: string) => {
    if (!isEnabled) return;
    
    try {
      const imported = deserializeMembership(JSON.parse(serialized));
      
      // Validate community ID matches
      if (imported.communityId !== communityId) {
        throw new Error(
          `Community ID mismatch: expected ${communityId}, got ${imported.communityId}`
        );
      }
      
      setMembership(imported);
      logDebug('import', communityId, imported);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [communityId, isEnabled]);
  
  const compactCallback = useCallback(() => {
    setMembership((prev) => {
      if (!prev || !isEnabled) return prev;
      if (!needsCompaction(prev)) return prev;
      const compacted = compactMembership(prev);
      logDebug('compact', communityId, compacted);
      return compacted;
    });
  }, [communityId, isEnabled]);
  
  // Periodic compaction check
  useEffect(() => {
    if (!isEnabled || !membership) return;
    
    const interval = setInterval(() => {
      if (needsCompaction(membership)) {
        compactCallback();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [membership, isEnabled, compactCallback]);
  
  return {
    members,
    membersWithMetadata,
    memberCount,
    addMember: addMemberCallback,
    removeMember: removeMemberCallback,
    removeMembers: removeMembersCallback,
    isMember: isMemberCallback,
    syncWithRemote: syncWithRemoteCallback,
    exportState: exportStateCallback,
    importState: importStateCallback,
    isEnabled,
    isLoading,
    error,
    diagnostics,
    compact: compactCallback,
  };
}

/**
 * Legacy migration hook.
 * Converts snapshot-based members to CRDT on first use.
 */
export function useMigrateToCRDT(
  communityId: string,
  deviceId: string,
  legacyMembers: string[] | null
): { migrated: boolean; membership: CommunityMembership | null } {
  const [state, setState] = useState<{ 
    migrated: boolean; 
    membership: CommunityMembership | null 
  }>({ migrated: false, membership: null });
  
  useEffect(() => {
    if (!legacyMembers || state.migrated) return;
    
    const migrate = async () => {
      // Check if CRDT already exists
      const existing = await loadFromStorage(communityId);
      
      if (existing) {
        // Already migrated
        setState({ migrated: true, membership: deserializeMembership(existing) });
        return;
      }
      
      // Perform migration
      const migrated = migrateFromLegacy(communityId, deviceId, legacyMembers);
      await saveToStorage(communityId, serializeMembership(migrated));
      
      setState({ migrated: true, membership: migrated });
      logDebug('migrate', communityId, { 
        legacyCount: legacyMembers.length,
        migratedCount: migrated.memberSet.adds.size
      });
    };
    
    migrate();
  }, [communityId, deviceId, legacyMembers, state.migrated]);
  
  return state;
}

// ============================================================================
// Storage helpers (use IndexedDB or localStorage)
// ============================================================================

const STORAGE_KEY_PREFIX = 'obscur:membership:crdt:v1';

const toMembershipCrdtStorageKey = (communityId: string, profileId?: string): string => (
  getScopedStorageKey(`${STORAGE_KEY_PREFIX}:${communityId}`, profileId ?? getResolvedProfileId())
);

const toMembershipPersistenceKey = (communityId: string, profileId?: string): string => (
  toMembershipCrdtStorageKey(communityId, profileId)
);

async function loadFromStorage(communityId: string): Promise<SerializedMembership | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    const persistenceKey = toMembershipPersistenceKey(communityId);
    // Try IndexedDB first
    const db = await openMembershipDB();
    const data = await db.get('memberships', persistenceKey);
    return (data as SerializedMembership | undefined) ?? null;
  } catch {
    // Fallback to localStorage
    const key = toMembershipPersistenceKey(communityId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as SerializedMembership : null;
  }
}

async function saveToStorage(
  communityId: string, 
  data: SerializedMembership
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const persistenceKey = toMembershipPersistenceKey(communityId);
    // Try IndexedDB first
    const db = await openMembershipDB();
    await db.put('memberships', data, persistenceKey);
  } catch {
    // Fallback to localStorage
    const key = toMembershipPersistenceKey(communityId);
    localStorage.setItem(key, JSON.stringify(data));
  }
}

// Simple IndexedDB wrapper
let dbPromise: Promise<IDBDatabase> | null = null;

function openMembershipDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('ObscurMembershipCRDT', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('memberships')) {
        db.createObjectStore('memberships');
      }
    };
  });
  
  return dbPromise;
}

/** Clears IndexedDB handle + deletes DB so Vitest runs do not leak CRDT state across cases. Test-only. */
export async function resetMembershipCrdtPersistenceForTests(): Promise<void> {
  if (typeof localStorage !== "undefined") {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
        localStorage.removeItem(key);
      }
    }
  }
  if (typeof indexedDB === "undefined") return;
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
    dbPromise = null;
  }
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("ObscurMembershipCRDT");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    }),
  ]);
}

// Extend IDBDatabase for our store
declare global {
  interface IDBDatabase {
    get(storeName: string, key: string): Promise<unknown>;
    put(storeName: string, value: unknown, key: string): Promise<void>;
  }
}

// ============================================================================
// Logging
// ============================================================================

function logDebug(
  action: string,
  communityId: string | null,
  data: unknown
): void {
  const prefix = `[useCommunityMembershipCRDT:${communityId ?? 'null'}]`;
  console.log(prefix, action, data);
}
