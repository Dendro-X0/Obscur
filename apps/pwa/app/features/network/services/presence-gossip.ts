/**
 * Presence Gossip - Phase 2.2 Implementation
 *
 * G-Set based presence tracking with gossip propagation.
 * Each device asserts its own presence via heartbeat.
 * Status derived from last-seen timestamp with decay function.
 *
 * Key properties:
 * - G-Set semantics: heartbeats only grow (monotonic)
 * - TTL-based decay: status transitions over time
 * - Gossip propagation: epidemic broadcast to connected peers
 * - Privacy-preserving: no central presence server
 *
 * @example
 * ```typescript
 * // Record own heartbeat
 * let presence = createPresenceState();
 * presence = recordHeartbeat(presence, myPubkey, myDeviceId, Date.now());
 *
 * // Merge gossip from peer
 * const peerPresence = receiveGossipPayload(gossipMessage);
 * presence = mergePresenceStates(presence, peerPresence);
 *
 * // Query status
 * const status = getPresenceStatus(presence, friendPubkey, Date.now());
 * // { label: 'online', sublabel: 'seen 2s ago', lastSeenAt: 1234567890 }
 * ```
 */

import type { DeviceId } from '@dweb/crdt/vector-clock';

/**
 * Presence status labels with decay-based transitions
 */
export type PresenceLabel = 'online' | 'recent' | 'away' | 'offline';

/**
 * Single heartbeat entry - immutable record of presence assertion
 */
export interface PresenceHeartbeat {
  /** Public key of the user */
  pubkey: string;
  /** Device that asserted presence */
  deviceId: DeviceId;
  /** When the device claimed to be present (device's local time) */
  timestamp: number;
  /** When we received this heartbeat (our local time) */
  receivedAt: number;
  /** Time-to-live in ms (decay timeout) */
  ttl: number;
}

/**
 * Presence state using G-Set semantics.
 * Maps pubkey+deviceId to latest heartbeat.
 */
export interface PresenceState {
  /** Map of device identifiers to their heartbeats */
  heartbeats: Map<string, PresenceHeartbeat>;
  /** Configuration for TTL decay */
  config: PresenceConfig;
}

/**
 * Presence configuration
 */
export interface PresenceConfig {
  /** TTL for heartbeat entries (default: 10 minutes) */
  defaultTtlMs: number;
  /** Online threshold: < this = online (default: 30s) */
  onlineThresholdMs: number;
  /** Recent threshold: < this = recent (default: 5min) */
  recentThresholdMs: number;
  /** Away threshold: < this = away (default: 10min) */
  awayThresholdMs: number;
}

/**
 * Derived presence status for UI display
 */
export interface PresenceStatus {
  /** Display label */
  label: PresenceLabel;
  /** Human-readable sublabel like "seen 2s ago" */
  sublabel: string | null;
  /** Last seen timestamp */
  lastSeenAt: number | null;
  /** How many devices are reporting for this user */
  deviceCount: number;
}

/**
 * Gossip payload for network transmission
 */
export interface PresenceGossipPayload {
  /** Heartbeats to gossip */
  heartbeats: PresenceHeartbeat[];
  /** Sender's pubkey */
  fromPubkey: string;
  /** Sender's device ID */
  fromDeviceId: DeviceId;
  /** Gossip timestamp */
  gossipedAt: number;
  /** TTL for this gossip message */
  ttl: number;
}

/** Default presence configuration */
export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  defaultTtlMs: 10 * 60 * 1000, // 10 minutes
  onlineThresholdMs: 30 * 1000, // 30 seconds
  recentThresholdMs: 5 * 60 * 1000, // 5 minutes
  awayThresholdMs: 10 * 60 * 1000, // 10 minutes
};

/** Create device identifier from pubkey + deviceId */
const makeDeviceKey = (pubkey: string, deviceId: DeviceId): string =>
  `${pubkey}:${deviceId}`;

/**
 * Create empty presence state
 */
export const createPresenceState = (
  config: Partial<PresenceConfig> = {}
): PresenceState => ({
  heartbeats: new Map(),
  config: { ...DEFAULT_PRESENCE_CONFIG, ...config },
});

/**
 * Record a heartbeat for a device.
 * G-Set semantics: always keeps the latest timestamp per device.
 */
export const recordHeartbeat = (
  state: PresenceState,
  pubkey: string,
  deviceId: DeviceId,
  timestamp: number = Date.now(),
  ttl?: number
): PresenceState => {
  const deviceKey = makeDeviceKey(pubkey, deviceId);
  const existing = state.heartbeats.get(deviceKey);

  // G-Set: only update if this heartbeat is newer
  if (existing && timestamp <= existing.timestamp) {
    return state;
  }

  const newHeartbeats = new Map(state.heartbeats);
  newHeartbeats.set(deviceKey, {
    pubkey,
    deviceId,
    timestamp,
    receivedAt: Date.now(),
    ttl: ttl ?? state.config.defaultTtlMs,
  });

  return {
    ...state,
    heartbeats: newHeartbeats,
  };
};

/**
 * Record own heartbeat (convenience wrapper)
 */
export const recordOwnHeartbeat = (
  state: PresenceState,
  myPubkey: string,
  myDeviceId: DeviceId
): PresenceState =>
  recordHeartbeat(state, myPubkey, myDeviceId, Date.now(), state.config.defaultTtlMs);

/**
 * Get presence status for a pubkey.
 * Considers all devices for this user, uses the most recent heartbeat.
 */
export const getPresenceStatus = (
  state: PresenceState,
  pubkey: string,
  now: number = Date.now()
): PresenceStatus => {
  const devices: PresenceHeartbeat[] = [];

  // Find all heartbeats for this pubkey
  for (const [, heartbeat] of state.heartbeats) {
    if (heartbeat.pubkey === pubkey) {
      devices.push(heartbeat);
    }
  }

  if (devices.length === 0) {
    return {
      label: 'offline',
      sublabel: null,
      lastSeenAt: null,
      deviceCount: 0,
    };
  }

  // Use most recent heartbeat across all devices
  const latest = devices.reduce((max, h) =>
    h.timestamp > max.timestamp ? h : max
  );

  const age = now - latest.timestamp;
  const { config } = state;

  // Check TTL expiration
  if (age > latest.ttl) {
    return {
      label: 'offline',
      sublabel: null,
      lastSeenAt: latest.timestamp,
      deviceCount: devices.length,
    };
  }

  // Derive status from age thresholds
  if (age < config.onlineThresholdMs) {
    return {
      label: 'online',
      sublabel: `seen ${Math.floor(age / 1000)}s ago`,
      lastSeenAt: latest.timestamp,
      deviceCount: devices.length,
    };
  }

  if (age < config.recentThresholdMs) {
    return {
      label: 'recent',
      sublabel: `seen ${Math.floor(age / 60000)}m ago`,
      lastSeenAt: latest.timestamp,
      deviceCount: devices.length,
    };
  }

  if (age < config.awayThresholdMs) {
    return {
      label: 'away',
      sublabel: `seen ${Math.floor(age / 60000)}m ago`,
      lastSeenAt: latest.timestamp,
      deviceCount: devices.length,
    };
  }

  return {
    label: 'offline',
    sublabel: null,
    lastSeenAt: latest.timestamp,
    deviceCount: devices.length,
  };
};

/**
 * Get all active (non-expired) pubkeys
 */
export const getActivePubkeys = (
  state: PresenceState,
  now: number = Date.now()
): string[] => {
  const active = new Set<string>();

  for (const [, heartbeat] of state.heartbeats) {
    const age = now - heartbeat.timestamp;
    if (age <= heartbeat.ttl) {
      active.add(heartbeat.pubkey);
    }
  }

  return Array.from(active);
};

/**
 * Merge two presence states (G-Set merge).
 * Takes the latest heartbeat for each device.
 */
export const mergePresenceStates = (
  local: PresenceState,
  remote: PresenceState
): PresenceState => {
  const merged = new Map(local.heartbeats);

  for (const [deviceKey, remoteHeartbeat] of remote.heartbeats) {
    const localHeartbeat = merged.get(deviceKey);

    // Keep the later heartbeat (G-Set semantics)
    if (!localHeartbeat || remoteHeartbeat.timestamp > localHeartbeat.timestamp) {
      merged.set(deviceKey, remoteHeartbeat);
    }
  }

  return {
    heartbeats: merged,
    config: local.config, // Keep local config
  };
};

/**
 * Create gossip payload from current state.
 * Includes all non-expired heartbeats.
 */
export const createGossipPayload = (
  state: PresenceState,
  myPubkey: string,
  myDeviceId: DeviceId,
  now: number = Date.now()
): PresenceGossipPayload => {
  const activeHeartbeats: PresenceHeartbeat[] = [];

  for (const [, heartbeat] of state.heartbeats) {
    const age = now - heartbeat.timestamp;
    if (age <= heartbeat.ttl) {
      activeHeartbeats.push(heartbeat);
    }
  }

  return {
    heartbeats: activeHeartbeats,
    fromPubkey: myPubkey,
    fromDeviceId: myDeviceId,
    gossipedAt: now,
    ttl: state.config.defaultTtlMs,
  };
};

/**
 * Apply gossip payload to local state.
 */
export const applyGossipPayload = (
  state: PresenceState,
  payload: PresenceGossipPayload
): PresenceState => {
  let newState = state;

  for (const heartbeat of payload.heartbeats) {
    newState = recordHeartbeat(
      newState,
      heartbeat.pubkey,
      heartbeat.deviceId,
      heartbeat.timestamp,
      heartbeat.ttl
    );
  }

  return newState;
};

/**
 * Clean up expired heartbeats.
 * Call periodically to reclaim memory.
 */
export const cleanupExpiredHeartbeats = (
  state: PresenceState,
  now: number = Date.now()
): PresenceState => {
  const cleaned = new Map<string, PresenceHeartbeat>();

  for (const [deviceKey, heartbeat] of state.heartbeats) {
    const age = now - heartbeat.timestamp;
    if (age <= heartbeat.ttl) {
      cleaned.set(deviceKey, heartbeat);
    }
  }

  return {
    ...state,
    heartbeats: cleaned,
  };
};

/**
 * Get all heartbeats for debugging/diagnostics
 */
export const getPresenceDiagnostics = (
  state: PresenceState,
  now: number = Date.now()
): {
  totalHeartbeats: number;
  activeHeartbeats: number;
  expiredHeartbeats: number;
  uniquePubkeys: number;
} => {
  let active = 0;
  let expired = 0;
  const pubkeys = new Set<string>();

  for (const [, heartbeat] of state.heartbeats) {
    pubkeys.add(heartbeat.pubkey);
    const age = now - heartbeat.timestamp;
    if (age <= heartbeat.ttl) {
      active++;
    } else {
      expired++;
    }
  }

  return {
    totalHeartbeats: state.heartbeats.size,
    activeHeartbeats: active,
    expiredHeartbeats: expired,
    uniquePubkeys: pubkeys.size,
  };
};

/**
 * Serialize presence state to JSON
 */
export const serializePresenceState = (state: PresenceState): object => ({
  heartbeats: Array.from(state.heartbeats.entries()).map(([key, h]) => [key, {
    pubkey: h.pubkey,
    deviceId: h.deviceId,
    timestamp: h.timestamp,
    receivedAt: h.receivedAt,
    ttl: h.ttl,
  }]),
  config: state.config,
});

/**
 * Deserialize presence state from JSON
 */
export const deserializePresenceState = (data: {
  heartbeats: [string, {
    pubkey: string;
    deviceId: DeviceId;
    timestamp: number;
    receivedAt: number;
    ttl: number;
  }][];
  config: PresenceConfig;
}): PresenceState => ({
  heartbeats: new Map(data.heartbeats),
  config: data.config,
});
