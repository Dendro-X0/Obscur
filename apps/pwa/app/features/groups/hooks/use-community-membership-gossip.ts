/**
 * Community Membership Gossip Hook
 * 
 * React hook for managing membership gossip and relay synchronization.
 * Combines the CRDT integration hook with the relay bridge for live sync.
 * 
 * @example
 * ```tsx
 * function CommunitySyncManager({ group }: { group: GroupConversation }) {
 *   const { memberPubkeys, isCRDTActive, bridgeStatus } = useCommunityMembershipGossip(
 *     group.id,
 *     group.memberPubkeys,
 *     relayPool,
 *     signer
 *   );
 *   
 *   // Membership is automatically synced across devices
 *   return <MemberList members={memberPubkeys} />;
 * }
 * ```
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useIdentity } from '@/app/features/auth/hooks/use-identity.js';
import {
  useCommunityMembershipIntegration,
  type UseCommunityMembershipIntegrationReturn,
} from './use-community-membership-integration.js';
import {
  createMembershipRelayBridge,
  type MembershipRelayBridge,
  type BridgeStatus,
  type RelayPool,
} from '../services/community-membership-relay-bridge.js';
import { logAppEvent } from '@/app/shared/log-app-event';

/**
 * Signer interface for Nostr events.
 */
interface NostrSigner {
  signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<{ id: string; sig: string }>;
  getPublicKey: () => string;
}

/**
 * Hook return value extending integration hook.
 */
export interface UseCommunityMembershipGossipReturn extends UseCommunityMembershipIntegrationReturn {
  /** Bridge status for diagnostics */
  bridgeStatus: BridgeStatus | null;
  
  /** Force immediate gossip */
  gossipNow: () => Promise<void>;
  
  /** Is gossip bridge connected */
  isGossipConnected: boolean;
}

/**
 * Community membership gossip hook with relay synchronization.
 */
export function useCommunityMembershipGossip(
  communityId: string,
  legacyMembers: string[],
  relayPool: RelayPool | null,
  signer: NostrSigner | null,
  enabled: boolean = true
): UseCommunityMembershipGossipReturn {
  const identity = useIdentity();
  const bridgeRef = useRef<MembershipRelayBridge | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  
  // Get base integration
  const integration = useCommunityMembershipIntegration(communityId, legacyMembers);
  
  // Generate stable device ID from public key
  const deviceId = useMemo(() => {
    const publicKeyHex = identity.state.publicKeyHex;
    if (!publicKeyHex) return 'unknown-device';
    // Use first 16 chars of pubkey as device identifier
    return `${publicKeyHex.slice(0, 16)}-device`;
  }, [identity.state.publicKeyHex]);
  
  // Create and manage relay bridge
  useEffect(() => {
    // Only create bridge if all prerequisites are met
    if (!enabled || !integration.isCRDTActive || !relayPool || !signer) {
      bridgeRef.current?.stop();
      bridgeRef.current = null;
      setBridgeStatus(null);
      return;
    }
    
    // Get membership from integration
    const membership = integration.exportCRDTState();
    if (!membership) {
      return;
    }
    
    // Parse membership for bridge
    const parsedMembership = JSON.parse(membership);
    
    // Create bridge
    bridgeRef.current = createMembershipRelayBridge(
      communityId,
      deviceId,
      () => {
        // Get current membership from integration
        const state = integration.exportCRDTState();
        return state ? JSON.parse(state) : parsedMembership;
      },
      (newMembership) => {
        // Apply received membership
        const serialized = JSON.stringify(newMembership);
        integration.importCRDTState(serialized);
      },
      relayPool,
      signer
    );
    
    // Start bridge
    bridgeRef.current.start();
    
    // Update status periodically
    const statusInterval = setInterval(() => {
      if (bridgeRef.current) {
        setBridgeStatus(bridgeRef.current.getStatus());
      }
    }, 5000);
    
    logAppEvent({
      name: 'crdt.gossip.hook_started',
      level: 'info',
      scope: { feature: 'crdt', action: 'membership' },
      context: {
        communityId,
        deviceId: deviceId.slice(0, 8),
      },
    });
    
    // Cleanup
    return () => {
      clearInterval(statusInterval);
      bridgeRef.current?.stop();
      bridgeRef.current = null;
      
      logAppEvent({
        name: 'crdt.gossip.hook_stopped',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          deviceId: deviceId.slice(0, 8),
        },
      });
    };
  }, [communityId, deviceId, enabled, integration, relayPool, signer]);
  
  // Force gossip function
  const gossipNow = useCallback(async () => {
    if (!bridgeRef.current) {
      throw new Error('Gossip bridge not initialized');
    }
    await bridgeRef.current.gossipNow();
    
    // Update status
    setBridgeStatus(bridgeRef.current.getStatus());
  }, []);
  
  return {
    ...integration,
    bridgeStatus,
    gossipNow,
    isGossipConnected: bridgeStatus?.isRunning ?? false,
  };
}
