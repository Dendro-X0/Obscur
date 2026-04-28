/**
 * Community Membership CRDT Tests
 * 
 * Tests the Phase 1 CRDT-based membership container.
 * Validates CRDT properties and domain-specific scenarios.
 */

import { describe, it, expect } from 'vitest';
import { createVectorClock, incrementClock } from '@dweb/crdt/vector-clock';
import {
  createCommunityMembership,
  addMember,
  removeMember,
  mergeMembership,
  queryMembers,
  isMember,
  getMemberCount,
  serializeMembership,
  deserializeMembership,
  needsCompaction,
  compactMembership,
  getMembershipDiagnostics,
  migrateFromLegacy,
  MembershipError,
} from '../community-membership-crdt.js';

describe('Community Membership CRDT', () => {
  const COMMUNITY_ID = 'test-community-123';
  const DEVICE_A = 'device-A';
  const DEVICE_B = 'device-B';
  const ALICE = 'alice-pubkey';
  const BOB = 'bob-pubkey';
  const CAROL = 'carol-pubkey';
  
  describe('Creation', () => {
    it('should create empty membership', () => {
      const membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      
      expect(membership.communityId).toBe(COMMUNITY_ID);
      expect(membership.localDeviceId).toBe(DEVICE_A);
      expect(getMemberCount(membership)).toBe(0);
      expect(queryMembers(membership).size).toBe(0);
    });
    
    it('should initialize with provided clock', () => {
      const clock = createVectorClock(DEVICE_A, 5);
      const membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A, clock);
      
      expect(membership.vectorClock[DEVICE_A]).toBe(5);
    });
  });
  
  describe('Adding Members', () => {
    it('should add a single member', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      
      expect(getMemberCount(membership)).toBe(1);
      expect(isMember(membership, ALICE)).toBe(true);
      expect(isMember(membership, BOB)).toBe(false);
    });
    
    it('should add multiple members', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      let clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      clock = incrementClock(clock, DEVICE_A);
      membership = addMember(membership, BOB, DEVICE_A, clock);
      
      expect(getMemberCount(membership)).toBe(2);
      expect(isMember(membership, ALICE)).toBe(true);
      expect(isMember(membership, BOB)).toBe(true);
    });
    
    it('should be idempotent (adding same member twice)', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      const clock2 = incrementClock(clock, DEVICE_A);
      membership = addMember(membership, ALICE, DEVICE_A, clock2);
      
      // OR-Set allows multiple adds, both visible until compaction
      expect(getMemberCount(membership)).toBe(1); // query filters duplicates
    });
    
    it('should update operation count in metadata', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      
      expect(membership.metadata.operationCount).toBe(1);
    });
  });
  
  describe('Removing Members', () => {
    it('should remove an existing member', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      membership = removeMember(membership, ALICE, DEVICE_A);
      
      expect(getMemberCount(membership)).toBe(0);
      expect(isMember(membership, ALICE)).toBe(false);
    });
    
    it('should handle removing non-existent member', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      
      // Should not throw
      membership = removeMember(membership, ALICE, DEVICE_A);
      
      expect(getMemberCount(membership)).toBe(0);
    });
    
    it('should preserve tombstones for OR-Set semantics', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      membership = removeMember(membership, ALICE, DEVICE_A);
      
      // Tombstone exists but not visible
      expect(membership.memberSet.removes.size).toBeGreaterThan(0);
      expect(isMember(membership, ALICE)).toBe(false);
    });
  });
  
  describe('Merging (CRDT Properties)', () => {
    it('should be commutative: merge(A, B) === merge(B, A)', () => {
      // Device A adds Alice
      let membershipA = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clockA = createVectorClock(DEVICE_A, 1);
      membershipA = addMember(membershipA, ALICE, DEVICE_A, clockA);
      
      // Device B adds Bob
      let membershipB = createCommunityMembership(COMMUNITY_ID, DEVICE_B);
      const clockB = createVectorClock(DEVICE_B, 1);
      membershipB = addMember(membershipB, BOB, DEVICE_B, clockB);
      
      // Merge both ways
      const mergeAB = mergeMembership(membershipA, membershipB);
      const mergeBA = mergeMembership(membershipB, membershipA);
      
      // Both should have Alice and Bob
      expect(getMemberCount(mergeAB)).toBe(2);
      expect(getMemberCount(mergeBA)).toBe(2);
      expect(queryMembers(mergeAB)).toEqual(queryMembers(mergeBA));
    });
    
    it('should be associative: merge(merge(A, B), C) === merge(A, merge(B, C))', () => {
      // Three devices, each adds one member
      let membershipA = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      membershipA = addMember(membershipA, ALICE, DEVICE_A, createVectorClock(DEVICE_A, 1));
      
      let membershipB = createCommunityMembership(COMMUNITY_ID, DEVICE_B);
      membershipB = addMember(membershipB, BOB, DEVICE_B, createVectorClock(DEVICE_B, 1));
      
      let membershipC = createCommunityMembership(COMMUNITY_ID, 'device-C');
      membershipC = addMember(membershipC, CAROL, 'device-C', createVectorClock('device-C', 1));
      
      // Left: (A + B) + C
      const left = mergeMembership(mergeMembership(membershipA, membershipB), membershipC);
      
      // Right: A + (B + C)
      const right = mergeMembership(membershipA, mergeMembership(membershipB, membershipC));
      
      expect(getMemberCount(left)).toBe(3);
      expect(getMemberCount(right)).toBe(3);
      expect(queryMembers(left)).toEqual(queryMembers(right));
    });
    
    it('should be idempotent: merge(A, A) === A', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      membership = addMember(membership, ALICE, DEVICE_A, createVectorClock(DEVICE_A, 1));
      
      const merged = mergeMembership(membership, membership);
      
      expect(getMemberCount(merged)).toBe(1);
      expect(isMember(merged, ALICE)).toBe(true);
    });
    
    it('should reject merging different communities', () => {
      const membershipA = createCommunityMembership('community-A', DEVICE_A);
      const membershipB = createCommunityMembership('community-B', DEVICE_B);
      
      expect(() => mergeMembership(membershipA, membershipB)).toThrow(MembershipError);
    });
    
    it('should track merge metadata', () => {
      let membershipA = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      membershipA = addMember(membershipA, ALICE, DEVICE_A, createVectorClock(DEVICE_A, 1));
      
      let membershipB = createCommunityMembership(COMMUNITY_ID, DEVICE_B);
      membershipB = addMember(membershipB, BOB, DEVICE_B, createVectorClock(DEVICE_B, 1));
      
      const merged = mergeMembership(membershipA, membershipB);
      
      expect(merged.metadata.mergeCount).toBe(1);
      expect(merged.metadata.lastMergeAt).toBeTruthy();
      expect(merged.metadata.knownDevices.has(DEVICE_B)).toBe(true);
    });
  });
  
  describe('Add-Wins Semantics', () => {
    it('should preserve member if added after being removed', () => {
      // Alice joins
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      let clock = createVectorClock(DEVICE_A, 1);
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      
      // Alice leaves (observed remove)
      membership = removeMember(membership, ALICE, DEVICE_A);
      expect(isMember(membership, ALICE)).toBe(false);
      
      // Alice rejoins (new add with later clock)
      clock = incrementClock(clock, DEVICE_A);
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      
      // Alice should be a member (add wins over observed remove)
      expect(isMember(membership, ALICE)).toBe(true);
    });
    
    it('should handle observed remove winning over add', () => {
      // Device A adds Alice
      let membershipA = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clockA = createVectorClock(DEVICE_A, 1);
      membershipA = addMember(membershipA, ALICE, DEVICE_A, clockA);

      // Device B sees Alice (observes A's add), then removes her
      let membershipB = createCommunityMembership(COMMUNITY_ID, DEVICE_B);
      // B copies A's state first, then removes
      membershipB = mergeMembership(membershipB, membershipA);
      membershipB = removeMember(membershipB, ALICE, DEVICE_B);

      // Merge: observed-remove wins because B saw A's add before removing
      const merged = mergeMembership(membershipA, membershipB);

      // Alice should NOT be present (observed-remove semantics)
      expect(isMember(merged, ALICE)).toBe(false);
    });
  });
  
  describe('Serialization', () => {
    it('should serialize and deserialize without data loss', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      let clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      clock = incrementClock(clock, DEVICE_A);
      membership = addMember(membership, BOB, DEVICE_A, clock);
      
      const serialized = serializeMembership(membership);
      const restored = deserializeMembership(serialized);
      
      expect(restored.communityId).toBe(COMMUNITY_ID);
      expect(getMemberCount(restored)).toBe(2);
      expect(isMember(restored, ALICE)).toBe(true);
      expect(isMember(restored, BOB)).toBe(true);
    });
    
    it('should preserve metadata through serialization', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clock = createVectorClock(DEVICE_A, 1);
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      
      const serialized = serializeMembership(membership);
      const restored = deserializeMembership(serialized);
      
      expect(restored.metadata.operationCount).toBe(1);
      expect(restored.metadata.createdAt).toBe(membership.metadata.createdAt);
    });
  });
  
  describe('Compaction', () => {
    it('should detect when compaction is needed', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      
      // Initially no compaction needed
      expect(needsCompaction(membership)).toBe(false);
      
      // Add and remove multiple members
      let clock = createVectorClock(DEVICE_A, 1);
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      membership = removeMember(membership, ALICE, DEVICE_A);
      
      clock = incrementClock(clock, DEVICE_A);
      membership = addMember(membership, BOB, DEVICE_A, clock);
      membership = removeMember(membership, BOB, DEVICE_A);
      
      // With 2 adds and 2 removes, ratio is 1.0 (> 0.5 threshold)
      expect(needsCompaction(membership, 0.5)).toBe(true);
    });
    
    it('should remove tombstones during compaction', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      membership = removeMember(membership, ALICE, DEVICE_A);
      
      const beforeRemoves = membership.memberSet.removes.size;
      expect(beforeRemoves).toBeGreaterThan(0);
      
      const compacted = compactMembership(membership);
      
      expect(compacted.memberSet.removes.size).toBe(0);
      expect(isMember(compacted, ALICE)).toBe(false);
    });
    
    it('should preserve active members after compaction', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      let clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      clock = incrementClock(clock, DEVICE_A);
      membership = addMember(membership, BOB, DEVICE_A, clock);
      membership = removeMember(membership, ALICE, DEVICE_A);
      
      const compacted = compactMembership(membership);
      
      // Bob should still be a member
      expect(isMember(compacted, BOB)).toBe(true);
      expect(getMemberCount(compacted)).toBe(1);
    });
  });
  
  describe('Diagnostics', () => {
    it('should provide diagnostic information', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      const clock = createVectorClock(DEVICE_A, 1);
      
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      membership = removeMember(membership, ALICE, DEVICE_A);
      
      const diagnostics = getMembershipDiagnostics(membership);
      
      expect(diagnostics.communityId).toBe(COMMUNITY_ID);
      expect(diagnostics.memberCount).toBe(0);
      expect(diagnostics.addsCount).toBe(1);
      expect(diagnostics.removesCount).toBe(1);
      expect(diagnostics.tombstoneRatio).toBe(1);
      expect(diagnostics.needsCompaction).toBe(true);
    });
  });
  
  describe('Legacy Migration', () => {
    it('should migrate from legacy member list', () => {
      const legacyMembers = [ALICE, BOB, CAROL];
      
      const migrated = migrateFromLegacy(COMMUNITY_ID, DEVICE_A, legacyMembers);
      
      expect(getMemberCount(migrated)).toBe(3);
      expect(isMember(migrated, ALICE)).toBe(true);
      expect(isMember(migrated, BOB)).toBe(true);
      expect(isMember(migrated, CAROL)).toBe(true);
    });
    
    it('should create unique clocks for each legacy member', () => {
      const legacyMembers = [ALICE, BOB];
      
      const migrated = migrateFromLegacy(COMMUNITY_ID, DEVICE_A, legacyMembers);
      
      // Each member should have different clock
      const metas = migrated.memberSet.adds.values();
      const first = metas.next().value;
      const second = metas.next().value;
      if (!first || !second) {
        throw new Error("Expected migrated members to include metadata for both legacy members");
      }
      
      expect(first.addedAt[DEVICE_A]).not.toBe(second.addedAt[DEVICE_A]);
    });
  });
  
  describe('Real-World Scenarios', () => {
    it('should handle fresh device restore scenario', () => {
      // Device A creates community with Alice and Bob
      let membershipA = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      let clockA = createVectorClock(DEVICE_A, 1);
      membershipA = addMember(membershipA, ALICE, DEVICE_A, clockA);
      clockA = incrementClock(clockA, DEVICE_A);
      membershipA = addMember(membershipA, BOB, DEVICE_A, clockA);
      
      // Serialize as would happen in backup
      const serialized = serializeMembership(membershipA);
      
      // Device B restores from backup
      const restored = deserializeMembership(serialized);
      
      // Device B should see both members
      expect(getMemberCount(restored)).toBe(2);
      expect(isMember(restored, ALICE)).toBe(true);
      expect(isMember(restored, BOB)).toBe(true);
    });
    
    it('should handle concurrent join from two devices', () => {
      // Both devices start fresh
      let membershipA = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      let membershipB = createCommunityMembership(COMMUNITY_ID, DEVICE_B);
      
      // Device A adds Alice
      membershipA = addMember(membershipA, ALICE, DEVICE_A, createVectorClock(DEVICE_A, 1));
      
      // Device B adds Bob (concurrently, no sync yet)
      membershipB = addMember(membershipB, BOB, DEVICE_B, createVectorClock(DEVICE_B, 1));
      
      // Later they sync
      const merged = mergeMembership(membershipA, membershipB);
      
      // Both should be present
      expect(getMemberCount(merged)).toBe(2);
      expect(isMember(merged, ALICE)).toBe(true);
      expect(isMember(merged, BOB)).toBe(true);
    });
    
    it('should handle leave and rejoin scenario', () => {
      let membership = createCommunityMembership(COMMUNITY_ID, DEVICE_A);
      let clock = createVectorClock(DEVICE_A, 1);
      
      // Alice joins
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      expect(isMember(membership, ALICE)).toBe(true);
      
      // Alice leaves
      membership = removeMember(membership, ALICE, DEVICE_A);
      expect(isMember(membership, ALICE)).toBe(false);
      
      // Alice rejoins with new clock
      clock = incrementClock(clock, DEVICE_A);
      membership = addMember(membership, ALICE, DEVICE_A, clock);
      
      // Alice should be back (add wins)
      expect(isMember(membership, ALICE)).toBe(true);
    });
  });
});
