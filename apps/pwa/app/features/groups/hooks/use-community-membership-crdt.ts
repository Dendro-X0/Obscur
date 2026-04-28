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
import type {
  CommunityMembership,
  MemberWithMetadata,
  SerializedMembership,
} from '../services/community-membership-crdt.js';
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
  FEATURE_FLAGS,
} from '../services/community-membership-crdt.js';
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
  // Feature flag check
  const isEnabled = FEATURE_FLAGS.useCRDTMembership;
  
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
  
  // Derived values
  const members = useMemo(() => {
    if (!membership) return [];
    return Array.from(queryMembers(membership));
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
    if (!membershipRef.current || !isEnabled) return;
    
    const updated = addMember(membershipRef.current, pubkey, deviceId);
    setMembership(updated);
    logDebug('add', communityId, { pubkey, count: getMemberCount(updated) });
  }, [deviceId, communityId, isEnabled]);
  
  const removeMemberCallback = useCallback((pubkey: string) => {
    if (!membershipRef.current || !isEnabled) return;
    
    const updated = removeMember(membershipRef.current, pubkey, deviceId);
    setMembership(updated);
    logDebug('remove', communityId, { pubkey, count: getMemberCount(updated) });
  }, [deviceId, communityId, isEnabled]);
  
  const isMemberCallback = useCallback((pubkey: string) => {
    if (!membershipRef.current) return false;
    return isMember(membershipRef.current, pubkey);
  }, []);
  
  const syncWithRemoteCallback = useCallback((serializedRemote: string) => {
    if (!membershipRef.current || !isEnabled) return;
    
    try {
      const remote = deserializeMembership(JSON.parse(serializedRemote));
      const merged = mergeMembership(membershipRef.current, remote);
      setMembership(merged);
      logDebug('sync', communityId, { 
        remoteDevice: remote.localDeviceId,
        count: getMemberCount(merged)
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
    if (!membershipRef.current || !isEnabled) return;
    
    if (needsCompaction(membershipRef.current)) {
      const compacted = compactMembership(membershipRef.current);
      setMembership(compacted);
      logDebug('compact', communityId, compacted);
    }
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

const STORAGE_KEY_PREFIX = 'obscur:membership:crdt:';

async function loadFromStorage(communityId: string): Promise<SerializedMembership | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    // Try IndexedDB first
    const db = await openMembershipDB();
    const data = await db.get('memberships', communityId);
    return (data as SerializedMembership | undefined) ?? null;
  } catch {
    // Fallback to localStorage
    const key = `${STORAGE_KEY_PREFIX}${communityId}`;
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
    // Try IndexedDB first
    const db = await openMembershipDB();
    await db.put('memberships', data, communityId);
  } catch {
    // Fallback to localStorage
    const key = `${STORAGE_KEY_PREFIX}${communityId}`;
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

// Extend IDBDatabase for our store
interface MembershipDB extends IDBDatabase {
  get(storeName: string, key: string): Promise<SerializedMembership | undefined>;
  put(storeName: string, value: SerializedMembership, key: string): Promise<void>;
}

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
  if (!FEATURE_FLAGS.logCRDTOperations) return;
  
  const prefix = `[useCommunityMembershipCRDT:${communityId ?? 'null'}]`;
  console.log(prefix, action, data);
}
