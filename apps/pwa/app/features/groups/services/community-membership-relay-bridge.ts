/**
 * Community Membership Relay Bridge - Phase 2.5 Integration
 * 
 * Bridges the gossip protocol to actual Nostr relay publish/subscribe.
 * This module connects membership gossip events to the relay transport layer.
 * 
 * @example
 * ```typescript
 * // Initialize bridge with relay pool
 * const bridge = createMembershipRelayBridge(
 *   communityId,
 *   deviceId,
 *   getMembership,
 *   setMembership,
 *   relayPool
 * );
 * 
 * // Start publishing and listening
 * bridge.start();
 * 
 * // Later: stop all subscriptions
 * bridge.stop();
 * ```
 */

import type { CommunityMembership } from './community-membership-crdt.js';
import {
  createMembershipGossipManager,
  generateGossipDelta,
  encodeMembershipDelta,
  mergeGossipDelta,
  createAntiEntropyResponse,
  type AntiEntropyRequest,
  MEMBERSHIP_GOSSIP_EVENT_KIND,
  MEMBERSHIP_ANTI_ENTROPY_REQUEST_KIND,
  type GossipManager,
  type GossipConfig,
  DEFAULT_GOSSIP_CONFIG,
} from './community-membership-gossip.js';
import { logAppEvent } from '@/app/shared/log-app-event';

/**
 * Relay pool interface for bridge integration.
 */
export interface RelayPool {
  /** Publish event to relays */
  publish(event: unknown): Promise<void>;
  
  /** Subscribe to events with filter */
  subscribe(
    filter: { kinds: number[]; '#e'?: string[]; since?: number },
    handler: (event: unknown) => void
  ): { unsubscribe: () => void };
  
  /** Get connected relay count */
  getConnectedCount(): number;
}

/**
 * Bridge configuration options.
 */
export interface RelayBridgeConfig extends GossipConfig {
  /** Max retries for failed publishes */
  maxPublishRetries: number;
  
  /** Backoff delay between retries (ms) */
  retryDelayMs: number;
}

/**
 * Default bridge configuration.
 */
export const DEFAULT_BRIDGE_CONFIG: RelayBridgeConfig = {
  ...DEFAULT_GOSSIP_CONFIG,
  maxPublishRetries: 3,
  retryDelayMs: 1000,
};

/**
 * Relay bridge interface for membership gossip.
 */
export interface MembershipRelayBridge {
  /** Start bridge (subscriptions + gossip manager) */
  start(): void;
  
  /** Stop bridge (cleanup subscriptions) */
  stop(): void;
  
  /** Force immediate gossip */
  gossipNow(): Promise<void>;
  
  /** Get bridge status */
  getStatus(): BridgeStatus;
}

/**
 * Bridge status snapshot.
 */
export interface BridgeStatus {
  isRunning: boolean;
  connectedRelays: number;
  lastGossipTime: number | null;
  lastReceiveTime: number | null;
  gossipManagerRunning: boolean;
}

/**
 * Nostr event structure (minimal).
 */
interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * Create relay bridge for membership gossip.
 */
export function createMembershipRelayBridge(
  communityId: string,
  deviceId: string,
  getMembership: () => CommunityMembership,
  setMembership: (m: CommunityMembership) => void,
  relayPool: RelayPool,
  signer: { 
    signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<{ id: string; sig: string }>;
    getPublicKey: () => string;
  },
  config: RelayBridgeConfig = DEFAULT_BRIDGE_CONFIG
): MembershipRelayBridge {
  let gossipManager: GossipManager | null = null;
  let gossipSub: { unsubscribe: () => void } | null = null;
  let antiEntropySub: { unsubscribe: () => void } | null = null;
  let isRunning = false;
  let lastReceiveTime: number | null = null;
  
  /**
   * Publish membership gossip event to relays.
   */
  const publishGossip = async (membership: CommunityMembership): Promise<void> => {
    const delta = generateGossipDelta(membership, null, config);
    if (!delta) {
      if (config.verboseLogging) {
        logAppEvent({
          name: 'crdt.relay.no_delta_to_publish',
          level: 'debug',
          scope: { feature: 'crdt', action: 'membership' },
          context: { communityId, deviceId: deviceId.slice(0, 8) },
        });
      }
      return;
    }
    
    const encoded = encodeMembershipDelta(delta, membership);
    
    // Build Nostr event
    const eventTemplate = {
      kind: MEMBERSHIP_GOSSIP_EVENT_KIND,
      content: encoded.payload,
      tags: [
        ['e', communityId], // Tag with community ID
        ['d', deviceId],    // Device identifier
        ['k', 'membership-gossip'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    };
    
    try {
      const { id, sig } = await signer.signEvent(eventTemplate);
      const event: NostrEvent = {
        id,
        pubkey: signer.getPublicKey(),
        created_at: eventTemplate.created_at,
        kind: eventTemplate.kind,
        tags: eventTemplate.tags,
        content: eventTemplate.content,
        sig,
      };
      
      await relayPool.publish(event);
      
      logAppEvent({
        name: 'crdt.relay.gossip_published',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          deviceId: deviceId.slice(0, 8),
          eventId: id.slice(0, 16),
          adds: delta.adds.length,
          removes: delta.removes.length,
        },
      });
    } catch (err) {
      logAppEvent({
        name: 'crdt.relay.gossip_publish_failed',
        level: 'error',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          deviceId: deviceId.slice(0, 8),
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
      throw err;
    }
  };
  
  /**
   * Handle incoming gossip event from relay.
   */
  const handleGossipEvent = (event: NostrEvent): void => {
    // Ignore self
    if (event.pubkey === signer.getPublicKey()) {
      return;
    }
    
    // Verify community tag matches
    const communityTag = event.tags.find(t => t[0] === 'e');
    if (!communityTag || communityTag[1] !== communityId) {
      return;
    }
    
    // Extract sender device
    const deviceTag = event.tags.find(t => t[0] === 'd');
    const senderDeviceId = deviceTag?.[1] ?? 'unknown';
    
    try {
      const encoded = {
        communityId,
        senderDeviceId,
        vectorClock: {}, // Will be extracted from content
        payload: event.content,
        timestamp: event.created_at * 1000,
      };
      
      const currentMembership = getMembership();
      const updated = mergeGossipDelta(
        currentMembership,
        encoded,
        (newMembership) => {
          setMembership(newMembership);
        }
      );
      
      lastReceiveTime = Date.now();
      
      logAppEvent({
        name: 'crdt.relay.gossip_received',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          senderDeviceId: senderDeviceId.slice(0, 8),
          eventId: event.id.slice(0, 16),
          memberCount: updated.memberSet.adds.size - updated.memberSet.removes.size,
        },
      });
      
      // Emit window event for other listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('obscur:crdt-membership-received', {
          detail: {
            communityId,
            senderDeviceId,
            timestamp: Date.now(),
          },
        }));
      }
    } catch (err) {
      logAppEvent({
        name: 'crdt.relay.gossip_receive_failed',
        level: 'error',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          senderDeviceId: senderDeviceId.slice(0, 8),
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  };
  
  /**
   * Handle anti-entropy request.
   */
  const handleAntiEntropyRequest = async (event: NostrEvent): Promise<void> => {
    // Ignore self
    if (event.pubkey === signer.getPublicKey()) {
      return;
    }
    
    try {
      const request = JSON.parse(event.content) as AntiEntropyRequest;
      
      // Only respond if request is for our community
      if (request.communityId !== communityId) {
        return;
      }
      
      const membership = getMembership();
      const response = createAntiEntropyResponse(membership, request);
      
      if (!response) {
        return; // No delta to send
      }
      
      // Publish response
      const eventTemplate = {
        kind: MEMBERSHIP_ANTI_ENTROPY_REQUEST_KIND,
        content: JSON.stringify(response),
        tags: [
          ['e', communityId],
          ['d', deviceId],
          ['p', event.pubkey], // Reply to requester
          ['k', 'anti-entropy-response'],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };
      
      const { id, sig } = await signer.signEvent(eventTemplate);
      const responseEvent = {
        id,
        pubkey: signer.getPublicKey(),
        created_at: eventTemplate.created_at,
        kind: eventTemplate.kind,
        tags: eventTemplate.tags,
        content: eventTemplate.content,
        sig,
      };
      
      await relayPool.publish(responseEvent);
      
      logAppEvent({
        name: 'crdt.relay.anti_entropy_responded',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          requester: event.pubkey.slice(0, 16),
          adds: response.delta.adds.length,
          removes: response.delta.removes.length,
        },
      });
    } catch (err) {
      logAppEvent({
        name: 'crdt.relay.anti_entropy_failed',
        level: 'error',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  };
  
  /**
   * Handle anti-entropy response.
   */
  const handleAntiEntropyResponse = (event: NostrEvent): void => {
    // Only process if addressed to us
    const pTag = event.tags.find(t => t[0] === 'p');
    if (!pTag || pTag[1] !== signer.getPublicKey()) {
      return;
    }
    
    try {
      const response = JSON.parse(event.content);
      const currentMembership = getMembership();
      
      // Apply the delta
      void mergeGossipDelta(
        currentMembership,
        {
          communityId: response.communityId,
          senderDeviceId: response.deviceId,
          vectorClock: response.responderClock,
          payload: JSON.stringify(response.delta),
          timestamp: response.timestamp,
        },
        (newMembership) => {
          setMembership(newMembership);
        }
      );
      
      lastReceiveTime = Date.now();
      
      logAppEvent({
        name: 'crdt.relay.anti_entropy_applied',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          responder: response.deviceId.slice(0, 8),
          adds: response.delta.adds.length,
          removes: response.delta.removes.length,
        },
      });
    } catch (err) {
      logAppEvent({
        name: 'crdt.relay.anti_entropy_response_failed',
        level: 'error',
        scope: { feature: 'crdt', action: 'membership' },
        context: {
          communityId,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  };
  
  /**
   * Create publish function for gossip manager.
   */
  const createPublishFunction = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return async (_event: unknown) => {
      await publishGossip(getMembership());
    };
  };
  
  return {
    start: () => {
      if (isRunning) return;
      
      // Start gossip manager
      gossipManager = createMembershipGossipManager(
        communityId,
        deviceId,
        getMembership,
        setMembership,
        createPublishFunction(),
        config
      );
      gossipManager.start();
      
      // Subscribe to gossip events
      gossipSub = relayPool.subscribe(
        { kinds: [MEMBERSHIP_GOSSIP_EVENT_KIND], '#e': [communityId] },
        (event) => handleGossipEvent(event as NostrEvent)
      );
      
      // Subscribe to anti-entropy requests
      antiEntropySub = relayPool.subscribe(
        { kinds: [MEMBERSHIP_ANTI_ENTROPY_REQUEST_KIND], '#e': [communityId] },
        (event) => {
          const evt = event as NostrEvent;
          // Check if it's a request or response
          const kTag = evt.tags.find(t => t[0] === 'k');
          if (kTag?.[1] === 'anti-entropy-response') {
            handleAntiEntropyResponse(evt);
          } else {
            void handleAntiEntropyRequest(evt);
          }
        }
      );
      
      isRunning = true;
      
      logAppEvent({
        name: 'crdt.relay.bridge_started',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: { communityId, deviceId: deviceId.slice(0, 8) },
      });
    },
    
    stop: () => {
      if (!isRunning) return;
      
      gossipManager?.stop();
      gossipSub?.unsubscribe();
      antiEntropySub?.unsubscribe();
      
      gossipManager = null;
      gossipSub = null;
      antiEntropySub = null;
      isRunning = false;
      
      logAppEvent({
        name: 'crdt.relay.bridge_stopped',
        level: 'info',
        scope: { feature: 'crdt', action: 'membership' },
        context: { communityId, deviceId: deviceId.slice(0, 8) },
      });
    },
    
    gossipNow: async () => {
      if (!isRunning) {
        throw new Error('Bridge not started');
      }
      await publishGossip(getMembership());
    },
    
    getStatus: () => ({
      isRunning,
      connectedRelays: relayPool.getConnectedCount(),
      lastGossipTime: gossipManager ? Date.now() : null, // Approximation
      lastReceiveTime,
      gossipManagerRunning: gossipManager !== null,
    }),
  };
}

/**
 * React hook for membership relay bridge.
 */
export function useMembershipRelayBridge(
  communityId: string | null,
  deviceId: string,
  getMembership: () => CommunityMembership,
  setMembership: (m: CommunityMembership) => void,
  relayPool: RelayPool | null,
  signer: { 
    signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<{ id: string; sig: string }>;
    getPublicKey: () => string;
  } | null,
  enabled: boolean = true
): MembershipRelayBridge | null {
  // Return null if prerequisites not met
  if (!communityId || !relayPool || !signer || !enabled) {
    return null;
  }
  
  // Create bridge instance
  return createMembershipRelayBridge(
    communityId,
    deviceId,
    getMembership,
    setMembership,
    relayPool,
    signer
  );
}
