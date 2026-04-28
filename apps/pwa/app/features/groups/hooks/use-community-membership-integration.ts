/**
 * Community Membership Integration Hook
 * 
 * Bridges the CRDT-based membership container with the existing group provider.
 * This allows gradual rollout behind a feature flag.
 * 
 * When `useCRDTMembership` is false (default), uses existing snapshot-based system.
 * When `useCRDTMembership` is true, uses OR-Set CRDT for membership tracking.
 * 
 * @example
 * ```tsx
 * function GroupMemberList({ group }: { group: GroupConversation }) {
 *   const { memberPubkeys, isLoading, addMember, removeMember } = useCommunityMembershipIntegration(
 *     group.id,
 *     group.memberPubkeys
 *   );
 *   
 *   return <MemberList members={memberPubkeys} onAdd={addMember} onRemove={removeMember} />;
 * }
 * ```
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useIdentity } from '@/app/features/auth/hooks/use-identity';
import { FEATURE_FLAGS, type CommunityMembership } from '../services/community-membership-crdt.js';
import {
  createCommunityMembership,
  addMember,
  removeMember,
  mergeMembership,
  queryMembers,
  serializeMembership,
  deserializeMembership,
  migrateFromLegacy,
} from '../services/community-membership-crdt.js';
import { createVectorClock } from '@dweb/crdt/vector-clock';
import { logAppEvent } from '@/app/shared/log-app-event';

/**
 * Integration hook return value.
 */
export interface UseCommunityMembershipIntegrationReturn {
  /** Current member pubkeys (from CRDT or legacy) */
  memberPubkeys: string[];
  
  /** Is CRDT path active */
  isCRDTActive: boolean;
  
  /** Is loading from storage */
  isLoading: boolean;
  
  /** Add a member (CRDT or legacy) */
  addMember: (pubkey: string) => Promise<void>;
  
  /** Remove a member (CRDT or legacy) */
  removeMember: (pubkey: string) => Promise<void>;
  
  /** Export CRDT state for gossip/backup */
  exportCRDTState: () => string | null;
  
  /** Import CRDT state (for restore/merge) */
  importCRDTState: (serialized: string) => void;
}

/**
 * Storage key for CRDT membership persistence.
 */
const STORAGE_KEY_PREFIX = 'obscur:membership:crdt:v1:';

/**
 * Integration hook that bridges CRDT and legacy membership systems.
 */
export function useCommunityMembershipIntegration(
  communityId: string,
  legacyMemberPubkeys: string[]
): UseCommunityMembershipIntegrationReturn {
  const identity = useIdentity();
  const deviceId = useMemo(() => {
    return identity.state.publicKeyHex ?? 'unknown-device';
  }, [identity.state.publicKeyHex]);
  
  // CRDT state (only used when feature flag is enabled)
  const crdtRef = useRef<CommunityMembership | null>(null);
  const isLoadingRef = useRef(false);
  
  // Initialize CRDT from storage or legacy
  useEffect(() => {
    if (!FEATURE_FLAGS.useCRDTMembership) return;
    if (isLoadingRef.current) return;
    
    const init = async () => {
      isLoadingRef.current = true;
      
      try {
        // Try to load existing CRDT state
        const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${communityId}`);
        
        if (stored) {
          crdtRef.current = deserializeMembership(JSON.parse(stored));
          logAppEvent({
            name: 'crdt.membership.restored',
            level: 'info',
            scope: { feature: 'crdt', action: 'membership' },
            context: { communityId, memberCount: crdtRef.current.memberSet.adds.size }
          });
        } else if (legacyMemberPubkeys.length > 0) {
          // Migrate from legacy
          crdtRef.current = migrateFromLegacy(
            communityId,
            deviceId,
            legacyMemberPubkeys,
            createVectorClock(deviceId, 0)
          );
          
          // Persist immediately
          await persistCRDT(crdtRef.current);
          
          logAppEvent({
            name: 'crdt.membership.migrated',
            level: 'info',
            scope: { feature: 'crdt', action: 'membership' },
            context: { 
              communityId, 
              legacyCount: legacyMemberPubkeys.length,
              migratedCount: crdtRef.current.memberSet.adds.size 
            }
          });
        } else {
          // Create new empty CRDT
          crdtRef.current = createCommunityMembership(
            communityId,
            deviceId,
            createVectorClock(deviceId, 0)
          );
        }
      } catch (error) {
        logAppEvent({
          name: 'crdt.membership.init_error',
          level: 'error',
          scope: { feature: 'crdt', action: 'membership' },
          context: { communityId, error: String(error) }
        });
        // Fall back to null (use legacy)
        crdtRef.current = null;
      } finally {
        isLoadingRef.current = false;
      }
    };
    
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, deviceId, legacyMemberPubkeys.length]);
  
  // Persist CRDT on changes
  const persistCRDT = useCallback(async (membership: CommunityMembership) => {
    try {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${communityId}`,
        JSON.stringify(serializeMembership(membership))
      );
    } catch (error) {
      logAppEvent({
        name: 'crdt.membership.persist_error',
        level: 'error',
        scope: { feature: 'crdt', action: 'membership' },
        context: { communityId, error: String(error) }
      });
    }
  }, [communityId]);
  
  // Computed member list
  const memberPubkeys = useMemo(() => {
    if (FEATURE_FLAGS.useCRDTMembership && crdtRef.current) {
      return Array.from(queryMembers(crdtRef.current));
    }
    return legacyMemberPubkeys;
  }, [legacyMemberPubkeys]);
  
  // Add member (CRDT or legacy fallback)
  const addMemberCallback = useCallback(async (pubkey: string) => {
    if (FEATURE_FLAGS.useCRDTMembership && crdtRef.current) {
      crdtRef.current = addMember(
        crdtRef.current,
        pubkey,
        deviceId,
        createVectorClock(deviceId, Date.now())
      );
      await persistCRDT(crdtRef.current);
      
      logAppEvent({
        name: 'crdt.membership.add',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: { communityId, pubkey: pubkey.slice(0, 16) + '...' }
      });
    } else {
      // Legacy: emit event for group provider to handle
      window.dispatchEvent(new CustomEvent('obscur:legacy-add-member', {
        detail: { communityId, pubkey }
      }));
    }
  }, [communityId, deviceId, persistCRDT]);
  
  // Remove member (CRDT or legacy fallback)
  const removeMemberCallback = useCallback(async (pubkey: string) => {
    if (FEATURE_FLAGS.useCRDTMembership && crdtRef.current) {
      crdtRef.current = removeMember(crdtRef.current, pubkey, deviceId);
      await persistCRDT(crdtRef.current);
      
      logAppEvent({
        name: 'crdt.membership.remove',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: { communityId, pubkey: pubkey.slice(0, 16) + '...' }
      });
    } else {
      // Legacy: emit event for group provider to handle
      window.dispatchEvent(new CustomEvent('obscur:legacy-remove-member', {
        detail: { communityId, pubkey }
      }));
    }
  }, [communityId, deviceId, persistCRDT]);
  
  // Export CRDT state for gossip/backup
  const exportCRDTState = useCallback(() => {
    if (!FEATURE_FLAGS.useCRDTMembership || !crdtRef.current) {
      return null;
    }
    return JSON.stringify(serializeMembership(crdtRef.current));
  }, []);
  
  // Import CRDT state (for restore or merge from gossip)
  const importCRDTState = useCallback((serialized: string) => {
    if (!FEATURE_FLAGS.useCRDTMembership) return;
    
    try {
      const remote = deserializeMembership(JSON.parse(serialized));
      
      if (remote.communityId !== communityId) {
        throw new Error(`Community ID mismatch: ${remote.communityId} vs ${communityId}`);
      }
      
      if (crdtRef.current) {
        // Merge with existing
        crdtRef.current = mergeMembership(crdtRef.current, remote);
      } else {
        // Use imported state directly
        crdtRef.current = remote;
      }
      
      persistCRDT(crdtRef.current);
      
      logAppEvent({
        name: 'crdt.membership.import',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: { 
          communityId, 
          remoteDevice: remote.localDeviceId.slice(0, 16) + '...',
          memberCount: crdtRef.current.memberSet.adds.size
        }
      });
    } catch (error) {
      logAppEvent({
        name: 'crdt.membership.import_error',
        level: 'error',
        scope: { feature: 'crdt', action: 'membership' },
        context: { communityId, error: String(error) }
      });
    }
  }, [communityId, persistCRDT]);
  
  // Listen for gossip events (Phase 2)
  useEffect(() => {
    if (!FEATURE_FLAGS.useCRDTMembership) return;
    
    const handleGossip = (e: Event) => {
      const detail = (e as CustomEvent<{ communityId: string; serialized: string }>).detail;
      if (detail?.communityId === communityId) {
        importCRDTState(detail.serialized);
      }
    };
    
    window.addEventListener('obscur:crdt-membership-gossip', handleGossip);
    return () => window.removeEventListener('obscur:crdt-membership-gossip', handleGossip);
  }, [communityId, importCRDTState]);
  
  return {
    memberPubkeys,
    isCRDTActive: FEATURE_FLAGS.useCRDTMembership && crdtRef.current !== null,
    isLoading: isLoadingRef.current,
    addMember: addMemberCallback,
    removeMember: removeMemberCallback,
    exportCRDTState,
    importCRDTState,
  };
}

/**
 * Utility to broadcast CRDT state for gossip sync.
 * Call when device comes online or periodically.
 */
export function broadcastCRDTMembership(
  communityId: string, 
  serialized: string
): void {
  window.dispatchEvent(new CustomEvent('obscur:crdt-membership-gossip', {
    detail: { communityId, serialized }
  }));
}
