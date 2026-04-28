/**
 * Presence Gossip Tests
 *
 * Tests G-Set semantics for presence heartbeats and TTL-based decay.
 */

import { describe, it, expect } from 'vitest';
import {
  createPresenceState,
  recordHeartbeat,
  recordOwnHeartbeat,
  getPresenceStatus,
  mergePresenceStates,
  createGossipPayload,
  applyGossipPayload,
  cleanupExpiredHeartbeats,
  getActivePubkeys,
  getPresenceDiagnostics,
  DEFAULT_PRESENCE_CONFIG,
} from '../presence-gossip.js';

describe('Presence Gossip', () => {
  const MY_PUBKEY = 'my-pubkey-123';
  const ALICE_PUBKEY = 'alice-pubkey-456';
  const BOB_PUBKEY = 'bob-pubkey-789';
  const DEVICE_A = 'device-A';
  const DEVICE_B = 'device-B';

  describe('Creation', () => {
    it('should create empty presence state', () => {
      const state = createPresenceState();

      expect(state.heartbeats.size).toBe(0);
      expect(state.config.defaultTtlMs).toBe(DEFAULT_PRESENCE_CONFIG.defaultTtlMs);
    });

    it('should create with custom config', () => {
      const state = createPresenceState({
        defaultTtlMs: 5 * 60 * 1000,
        onlineThresholdMs: 10 * 1000,
      });

      expect(state.config.defaultTtlMs).toBe(5 * 60 * 1000);
      expect(state.config.onlineThresholdMs).toBe(10 * 1000);
    });
  });

  describe('Heartbeat Recording', () => {
    it('should record heartbeat for device', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);

      const status = getPresenceStatus(state, MY_PUBKEY, now);
      expect(status.label).toBe('online');
      expect(status.lastSeenAt).toBe(now);
      expect(status.deviceCount).toBe(1);
    });

    it('should record multiple devices for same user', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, ALICE_PUBKEY, DEVICE_A, now);
      state = recordHeartbeat(state, ALICE_PUBKEY, DEVICE_B, now - 1000);

      const status = getPresenceStatus(state, ALICE_PUBKEY, now);
      expect(status.label).toBe('online');
      expect(status.deviceCount).toBe(2);
    });

    it('should update heartbeat with later timestamp', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now + 5000);

      const status = getPresenceStatus(state, MY_PUBKEY, now + 5000);
      expect(status.lastSeenAt).toBe(now + 5000);
    });

    it('should not update with older timestamp (G-Set semantics)', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now - 1000);

      const status = getPresenceStatus(state, MY_PUBKEY, now);
      expect(status.lastSeenAt).toBe(now); // Should keep newer timestamp
    });

    it('should record own heartbeat', () => {
      const now = Date.now();
      let state = createPresenceState();
      state = recordOwnHeartbeat(state, MY_PUBKEY, DEVICE_A);

      const status = getPresenceStatus(state, MY_PUBKEY, now);
      expect(status.label).toBe('online');
      expect(status.deviceCount).toBe(1);
    });
  });

  describe('Status Decay', () => {
    it('should show online for fresh heartbeat', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now - 10000); // 10s ago

      const status = getPresenceStatus(state, MY_PUBKEY, now);
      expect(status.label).toBe('online');
      expect(status.sublabel).toBe('seen 10s ago');
    });

    it('should show recent for 60s old heartbeat', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now - 60000); // 1m ago

      const status = getPresenceStatus(state, MY_PUBKEY, now);
      expect(status.label).toBe('recent');
    });

    it('should show away for 8min old heartbeat', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now - 8 * 60000); // 8m ago

      const status = getPresenceStatus(state, MY_PUBKEY, now);
      expect(status.label).toBe('away');
    });

    it('should show offline for expired heartbeat', () => {
      const now = 1000000;
      const ttl = 10 * 60000; // 10 min
      let state = createPresenceState({ defaultTtlMs: ttl });
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now - 11 * 60000, ttl); // 11m ago

      const status = getPresenceStatus(state, MY_PUBKEY, now);
      expect(status.label).toBe('offline');
      expect(status.sublabel).toBeNull();
    });

    it('should handle unknown pubkey as offline', () => {
      const state = createPresenceState();
      const status = getPresenceStatus(state, 'unknown-pubkey', 1000000);

      expect(status.label).toBe('offline');
      expect(status.lastSeenAt).toBeNull();
    });
  });

  describe('G-Set Merge', () => {
    it('should merge heartbeats from different devices', () => {
      const now = 1000000;
      let stateA = createPresenceState();
      stateA = recordHeartbeat(stateA, MY_PUBKEY, DEVICE_A, now);

      let stateB = createPresenceState();
      stateB = recordHeartbeat(stateB, ALICE_PUBKEY, DEVICE_B, now);

      const merged = mergePresenceStates(stateA, stateB);

      const myStatus = getPresenceStatus(merged, MY_PUBKEY, now);
      const aliceStatus = getPresenceStatus(merged, ALICE_PUBKEY, now);

      expect(myStatus.label).toBe('online');
      expect(aliceStatus.label).toBe('online');
    });

    it('should take later timestamp during merge', () => {
      const now = 1000000;
      let stateA = createPresenceState();
      stateA = recordHeartbeat(stateA, MY_PUBKEY, DEVICE_A, now);

      let stateB = createPresenceState();
      stateB = recordHeartbeat(stateB, MY_PUBKEY, DEVICE_A, now + 5000);

      const merged = mergePresenceStates(stateA, stateB);
      const status = getPresenceStatus(merged, MY_PUBKEY, now + 5000);

      expect(status.lastSeenAt).toBe(now + 5000);
    });

    it('should be commutative', () => {
      const now = 1000000;
      let stateA = createPresenceState();
      stateA = recordHeartbeat(stateA, MY_PUBKEY, DEVICE_A, now);

      let stateB = createPresenceState();
      stateB = recordHeartbeat(stateB, ALICE_PUBKEY, DEVICE_B, now);

      const mergedAB = mergePresenceStates(stateA, stateB);
      const mergedBA = mergePresenceStates(stateB, stateA);

      expect(getPresenceStatus(mergedAB, MY_PUBKEY, now).label)
        .toBe(getPresenceStatus(mergedBA, MY_PUBKEY, now).label);
      expect(getPresenceStatus(mergedAB, ALICE_PUBKEY, now).label)
        .toBe(getPresenceStatus(mergedBA, ALICE_PUBKEY, now).label);
    });

    it('should be idempotent', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);

      const merged = mergePresenceStates(state, state);
      const status = getPresenceStatus(merged, MY_PUBKEY, now);

      expect(status.label).toBe('online');
      expect(status.deviceCount).toBe(1);
    });
  });

  describe('Gossip Payload', () => {
    it('should create gossip payload', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);
      state = recordHeartbeat(state, ALICE_PUBKEY, DEVICE_B, now);

      const payload = createGossipPayload(state, MY_PUBKEY, DEVICE_A, now);

      expect(payload.fromPubkey).toBe(MY_PUBKEY);
      expect(payload.fromDeviceId).toBe(DEVICE_A);
      expect(payload.heartbeats.length).toBe(2);
      expect(payload.gossipedAt).toBe(now);
    });

    it('should only include non-expired heartbeats in gossip', () => {
      const now = 1000000;
      const ttl = 600000; // 10 min
      let state = createPresenceState({ defaultTtlMs: ttl });
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);
      state = recordHeartbeat(state, ALICE_PUBKEY, DEVICE_B, now - 11 * 60000, ttl); // expired

      const payload = createGossipPayload(state, MY_PUBKEY, DEVICE_A, now);

      expect(payload.heartbeats.length).toBe(1);
      expect(payload.heartbeats[0].pubkey).toBe(MY_PUBKEY);
    });

    it('should apply gossip payload', () => {
      const now = 1000000;
      let local = createPresenceState();
      local = recordHeartbeat(local, MY_PUBKEY, DEVICE_A, now);

      const payload = {
        heartbeats: [{
          pubkey: ALICE_PUBKEY,
          deviceId: DEVICE_B,
          timestamp: now,
          receivedAt: now,
          ttl: 600000,
        }],
        fromPubkey: ALICE_PUBKEY,
        fromDeviceId: DEVICE_B,
        gossipedAt: now,
        ttl: 600000,
      };

      local = applyGossipPayload(local, payload);

      const aliceStatus = getPresenceStatus(local, ALICE_PUBKEY, now);
      expect(aliceStatus.label).toBe('online');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup expired heartbeats', () => {
      const now = 1000000;
      const ttl = 600000;
      let state = createPresenceState({ defaultTtlMs: ttl });
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);
      state = recordHeartbeat(state, ALICE_PUBKEY, DEVICE_B, now - 11 * 60000, ttl);

      state = cleanupExpiredHeartbeats(state, now);

      expect(state.heartbeats.size).toBe(1);
      expect(getPresenceStatus(state, ALICE_PUBKEY, now).label).toBe('offline');
    });
  });

  describe('Active Pubkeys', () => {
    it('should return all active pubkeys', () => {
      const now = 1000000;
      let state = createPresenceState();
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);
      state = recordHeartbeat(state, ALICE_PUBKEY, DEVICE_B, now - 1000);
      state = recordHeartbeat(state, BOB_PUBKEY, DEVICE_A, now - 15 * 60000, 600000); // expired

      const active = getActivePubkeys(state, now);

      expect(active).toContain(MY_PUBKEY);
      expect(active).toContain(ALICE_PUBKEY);
      expect(active).not.toContain(BOB_PUBKEY);
    });
  });

  describe('Diagnostics', () => {
    it('should provide diagnostics', () => {
      const now = 1000000;
      const ttl = 600000;
      let state = createPresenceState({ defaultTtlMs: ttl });
      state = recordHeartbeat(state, MY_PUBKEY, DEVICE_A, now);
      state = recordHeartbeat(state, ALICE_PUBKEY, DEVICE_B, now - 11 * 60000, ttl);

      const diag = getPresenceDiagnostics(state, now);

      expect(diag.totalHeartbeats).toBe(2);
      expect(diag.activeHeartbeats).toBe(1);
      expect(diag.expiredHeartbeats).toBe(1);
      expect(diag.uniquePubkeys).toBe(2);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle multi-device user correctly', () => {
      const now = 1000000;
      let state = createPresenceState();

      // Alice on phone and laptop
      state = recordHeartbeat(state, ALICE_PUBKEY, 'alice-phone', now - 5000);
      state = recordHeartbeat(state, ALICE_PUBKEY, 'alice-laptop', now - 60000);

      const status = getPresenceStatus(state, ALICE_PUBKEY, now);

      // Status from most recent device
      expect(status.label).toBe('online');
      expect(status.deviceCount).toBe(2);
      expect(status.sublabel).toBe('seen 5s ago');
    });

    it('should handle device going offline', () => {
      const now = 1000000;
      let state = createPresenceState();

      // Phone goes offline (15 min ago), laptop is recent
      state = recordHeartbeat(state, ALICE_PUBKEY, 'alice-phone', now - 15 * 60000);
      state = recordHeartbeat(state, ALICE_PUBKEY, 'alice-laptop', now - 5000);

      const status = getPresenceStatus(state, ALICE_PUBKEY, now);

      // Still online because laptop is active
      expect(status.label).toBe('online');
      expect(status.deviceCount).toBe(2);
    });

    it('should handle gossip merge preserving newest heartbeats', () => {
      const now = 1000000;

      // My view: Alice was online 1 min ago
      let myState = createPresenceState();
      myState = recordHeartbeat(myState, ALICE_PUBKEY, 'alice-phone', now - 60000);

      // Gossip from Bob: Alice is online now (just updated)
      const gossipPayload = {
        heartbeats: [{
          pubkey: ALICE_PUBKEY,
          deviceId: 'alice-phone',
          timestamp: now,
          receivedAt: now,
          ttl: 600000,
        }],
        fromPubkey: BOB_PUBKEY,
        fromDeviceId: 'bob-desktop',
        gossipedAt: now,
        ttl: 600000,
      };

      myState = applyGossipPayload(myState, gossipPayload);
      const status = getPresenceStatus(myState, ALICE_PUBKEY, now);

      // Should show fresh status from gossip
      expect(status.label).toBe('online');
      expect(status.sublabel).toBe('seen 0s ago');
    });
  });
});
