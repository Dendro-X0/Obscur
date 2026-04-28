/**
 * Community Membership CRDT Module - Phase 2.5 Exports
 * 
 * Central export point for all CRDT-based membership functionality.
 * 
 * @example
 * ```typescript
 * // Import everything
 * import {
 *   useCommunityMembershipIntegration,
 *   useCommunityMembershipGossip,
 *   createCommunityMembership,
 *   createMembershipRelayBridge,
 * } from '@/app/features/groups/services';
 * ```
 */

// Core CRDT container
export {
  createCommunityMembership,
  addMember,
  removeMember,
  mergeMembership,
  queryMembers,
  isMember,
  getMemberCount,
  compareMembership,
  queryMembersWithMetadata,
  compactMembership,
  needsCompaction,
  serializeMembership,
  deserializeMembership,
  migrateFromLegacy,
  createMembershipDelta,
  applyMembershipDelta,
  getMembershipClock,
  hasDeltaForDevice,
  getMembershipDiagnostics,
  type CommunityMembership,
  type MembershipMetadata,
  type MemberWithMetadata,
  type MembershipChangeEvent,
  type SerializedMembership,
  type MembershipDiagnostics,
  type MembershipDelta,
  FEATURE_FLAGS,
  MembershipError,
} from './community-membership-crdt.js';

// Gossip protocol
export {
  generateGossipDelta,
  encodeMembershipDelta,
  decodeMembershipDelta,
  createMembershipGossipEvent,
  createAntiEntropyRequest,
  createAntiEntropyResponse,
  createMembershipGossipManager,
  mergeGossipDelta,
  MEMBERSHIP_GOSSIP_EVENT_KIND,
  MEMBERSHIP_ANTI_ENTROPY_REQUEST_KIND,
  DEFAULT_GOSSIP_CONFIG,
  type EncodedMembershipDelta,
  type AntiEntropyRequest,
  type AntiEntropyResponse,
  type GossipConfig,
  type GossipManager,
} from './community-membership-gossip.js';

// Relay bridge
export {
  createMembershipRelayBridge,
  useMembershipRelayBridge,
  DEFAULT_BRIDGE_CONFIG,
  type RelayPool,
  type RelayBridgeConfig,
  type MembershipRelayBridge,
  type BridgeStatus,
} from './community-membership-relay-bridge.js';
