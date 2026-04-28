/**
 * usePresenceGossip - React hook for presence gossip
 *
 * Manages presence state, heartbeat broadcasting, and gossip reception.
 * Integrates with relay transport for network propagation.
 *
 * @example
 * ```typescript
 * const { status, broadcastHeartbeat, isGossipEnabled } = usePresenceGossip({
 *   myPubkey: identity.state.publicKeyHex,
 *   myDeviceId: 'device-A',
 *   relayPool,
 * });
 *
 * // Status updates automatically
 * console.log(status.label); // 'online' | 'recent' | 'away' | 'offline'
 * ```
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SimplePool } from 'nostr-tools';
import {
  createPresenceState,
  recordOwnHeartbeat,
  getPresenceStatus,
  createGossipPayload,
  applyGossipPayload,
  cleanupExpiredHeartbeats,
  type PresenceState,
  type PresenceStatus,
  type PresenceConfig,
} from '../services/presence-gossip';

interface UsePresenceGossipOptions {
  /** Current user's public key */
  myPubkey: string | null;
  /** Current device identifier */
  myDeviceId: string;
  /** Relay pool for gossip transmission */
  relayPool: SimplePool | null;
  /** Custom presence configuration */
  config?: Partial<PresenceConfig>;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatIntervalMs?: number;
  /** Whether to enable gossip broadcast */
  enableGossip?: boolean;
}

interface UsePresenceGossipResult {
  /** Get presence status for any pubkey */
  getStatus: (pubkey: string) => PresenceStatus;
  /** Get current user's status */
  myStatus: PresenceStatus | null;
  /** Manually trigger heartbeat broadcast */
  broadcastHeartbeat: () => void;
  /** Whether gossip is enabled and active */
  isGossipEnabled: boolean;
  /** Raw presence state for advanced use */
  presenceState: PresenceState;
  /** Apply gossip payload from network */
  receiveGossip: (payload: unknown) => void;
  /** Get all active pubkeys */
  getActivePubkeys: () => string[];
  /** Clean up expired entries */
  cleanup: () => void;
  /** Diagnostics for debugging */
  diagnostics: {
    totalHeartbeats: number;
    activeHeartbeats: number;
    expiredHeartbeats: number;
    uniquePubkeys: number;
  };
}

export function usePresenceGossip({
  myPubkey,
  myDeviceId,
  relayPool,
  config,
  heartbeatIntervalMs = 30000,
  enableGossip = true,
}: UsePresenceGossipOptions): UsePresenceGossipResult {
  const [presenceState, setPresenceState] = useState(() =>
    createPresenceState(config)
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep time current for status calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Record own heartbeat
  const recordOwn = useCallback(() => {
    if (!myPubkey) return;
    setPresenceState((state) => recordOwnHeartbeat(state, myPubkey, myDeviceId));
  }, [myPubkey, myDeviceId]);

  // Broadcast heartbeat to network
  const broadcastHeartbeat = useCallback(() => {
    if (!enableGossip || !myPubkey || !relayPool) return;

    // Record locally first
    recordOwn();

    // Create and broadcast gossip payload
    const payload = createGossipPayload(presenceState, myPubkey, myDeviceId);

    // TODO: Implement actual relay broadcast via Nostr event
    // For now, this is a placeholder for the gossip protocol
    console.log('[PresenceGossip] Broadcasting heartbeat:', {
      from: myPubkey,
      device: myDeviceId,
      activePeers: payload.heartbeats.length,
    });

    // Future: Broadcast via relay
    // relayPool.publish(relays, createPresenceEvent(payload));
  }, [enableGossip, myPubkey, myDeviceId, relayPool, presenceState, recordOwn]);

  // Periodic heartbeat
  useEffect(() => {
    if (!enableGossip || !myPubkey) return;

    // Initial heartbeat
    broadcastHeartbeat();

    // Schedule periodic heartbeats
    heartbeatIntervalRef.current = setInterval(() => {
      broadcastHeartbeat();
    }, heartbeatIntervalMs);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [enableGossip, myPubkey, broadcastHeartbeat, heartbeatIntervalMs]);

  // Apply gossip payload from network
  const receiveGossip = useCallback((payload: unknown) => {
    try {
      // Validate payload structure
      if (!isValidGossipPayload(payload)) {
        console.warn('[PresenceGossip] Invalid gossip payload received');
        return;
      }

      setPresenceState((state) => applyGossipPayload(state, payload));

      console.log('[PresenceGossip] Received gossip from:', payload.fromPubkey);
    } catch (err) {
      console.error('[PresenceGossip] Failed to process gossip:', err);
    }
  }, []);

  // Get status for a specific pubkey
  const getStatus = useCallback(
    (pubkey: string): PresenceStatus => {
      return getPresenceStatus(presenceState, pubkey, currentTime);
    },
    [presenceState, currentTime]
  );

  // Get current user's status
  const myStatus = useMemo(() => {
    if (!myPubkey) return null;
    return getPresenceStatus(presenceState, myPubkey, currentTime);
  }, [presenceState, myPubkey, currentTime]);

  // Get all active pubkeys
  const getActivePubkeys = useCallback((): string[] => {
    return presenceState.heartbeats
      .values()
      .filter((h) => currentTime - h.timestamp <= h.ttl)
      .map((h) => h.pubkey)
      .toArray();
  }, [presenceState, currentTime]);

  // Cleanup expired heartbeats
  const cleanup = useCallback(() => {
    setPresenceState((state) => cleanupExpiredHeartbeats(state, currentTime));
  }, [currentTime]);

  // Periodic cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      cleanup();
    }, 60000); // Cleanup every minute
    return () => clearInterval(interval);
  }, [cleanup]);

  // Diagnostics
  const diagnostics = useMemo(() => {
    const all = Array.from(presenceState.heartbeats.values());
    const uniquePubkeys = new Set(all.map((h) => h.pubkey)).size;
    const active = all.filter((h) => currentTime - h.timestamp <= h.ttl);

    return {
      totalHeartbeats: all.length,
      activeHeartbeats: active.length,
      expiredHeartbeats: all.length - active.length,
      uniquePubkeys,
    };
  }, [presenceState, currentTime]);

  return {
    getStatus,
    myStatus,
    broadcastHeartbeat,
    isGossipEnabled: enableGossip && !!myPubkey,
    presenceState,
    receiveGossip,
    getActivePubkeys,
    cleanup,
    diagnostics,
  };
}

/** Type guard for gossip payload validation */
function isValidGossipPayload(payload: unknown): payload is {
  heartbeats: Array<{
    pubkey: string;
    deviceId: string;
    timestamp: number;
    receivedAt: number;
    ttl: number;
  }>;
  fromPubkey: string;
  fromDeviceId: string;
  gossipedAt: number;
  ttl: number;
} {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;

  return (
    Array.isArray(p.heartbeats) &&
    typeof p.fromPubkey === 'string' &&
    typeof p.fromDeviceId === 'string' &&
    typeof p.gossipedAt === 'number' &&
    typeof p.ttl === 'number'
  );
}
