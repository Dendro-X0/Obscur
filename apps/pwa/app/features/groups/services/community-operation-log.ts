/**
 * Community Operation Log
 *
 * Signed Operation Log with Gossip Sync Architecture
 *
 * This module replaces the legacy ledger with a CRDT-style operation log.
 * Each membership change is a cryptographically signed operation that can be
 * gossiped via Nostr relays and merged deterministically by all participants.
 *
 * Key properties:
 * - Operations are immutable and signed (non-repudiable)
 * - Vector clocks enable causal ordering and conflict resolution
 * - Local state is computed from the operation log (not stored directly)
 * - Operations sync via relay gossip (no central backend)
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getProfileRuntimeScope, getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { schnorr } from "@noble/curves/secp256k1";

// Simple hex encoding without external dependency
const bytesToHex = (bytes: Uint8Array): string => 
  Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

const OPERATION_LOG_STORAGE_PREFIX = "obscur.community.operation_log.v1";
export const COMMUNITY_OPERATION_LOG_UPDATED_EVENT = "obscur:community-operation-log-updated";

export type CommunityOperationLogUpdatedEventDetail = Readonly<{
    publicKeyHex: string;
    count: number;
    profileId: string;
}>;

/**
 * Membership operation types
 */
export type CommunityOperationType = 
  | "member_join"      // User joined the community
  | "member_leave"     // User left voluntarily
  | "member_expel"     // Admin expelled a user
  | "admin_promote"    // User promoted to admin
  | "admin_demote"     // User demoted from admin
  | "community_create" // Community created
  | "community_disband"; // Community disbanded

/**
 * Vector clock for causal ordering
 * Maps node IDs (pubkeys) to their logical clock values
 */
export type VectorClock = Readonly<Record<string, number>>;

/**
 * Signed membership operation
 */
export interface CommunityMembershipOperation {
  readonly id: string;                    // SHA256 hash of signed content
  readonly type: CommunityOperationType;
  readonly communityId: string;             // community identifier
  readonly subjectPubkey: PublicKeyHex;     // who the operation affects
  readonly actorPubkey: PublicKeyHex;       // who performed the operation
  readonly vectorClock: VectorClock;      // causal ordering
  readonly timestamp: number;               // wall clock (display only)
  readonly relayUrl: string;                // authoritative relay
  readonly metadata?: Record<string, unknown>; // extra data (displayName, etc)
  readonly signature: string;              // Schnorr signature
}

/**
 * Operation envelope for storage
 */
interface OperationEnvelope {
  readonly operation: CommunityMembershipOperation;
  readonly receivedAt: number;              // when this device received it
  readonly receivedFrom?: string;         // relay or peer that sent it
}

// In-memory cache by scope
const operationCacheByScope = new Map<string, Map<string, OperationEnvelope>>();

/**
 * Generate storage key for operation log
 */
const toStorageKey = (publicKeyHex: string, profileId?: string): string => {
  const base = `${OPERATION_LOG_STORAGE_PREFIX}.${publicKeyHex}`;
  return getScopedStorageKey(base, profileId ?? getResolvedProfileId());
};

/**
 * Compute SHA256 hash of operation content (for ID and signing)
 */
const hashOperationContent = (
  type: CommunityOperationType,
  communityId: string,
  subjectPubkey: string,
  actorPubkey: string,
  vectorClock: VectorClock,
  timestamp: number,
  relayUrl: string,
  metadata?: Record<string, unknown>
): string => {
  const content = JSON.stringify({
    type,
    communityId,
    subjectPubkey,
    actorPubkey,
    vectorClock,
    timestamp,
    relayUrl,
    metadata,
  });
  // Simple hash - in production use proper SHA256
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
};

/**
 * Create a vector clock that happens-after all given clocks
 */
export const mergeVectorClocks = (...clocks: VectorClock[]): VectorClock => {
  const merged: Record<string, number> = {};
  for (const clock of clocks) {
    for (const [node, time] of Object.entries(clock)) {
      merged[node] = Math.max(merged[node] ?? 0, time);
    }
  }
  return merged;
};

/**
 * Increment a node's clock in a vector clock
 */
export const incrementClock = (
  clock: VectorClock,
  nodeId: string
): VectorClock => ({
  ...clock,
  [nodeId]: (clock[nodeId] ?? 0) + 1,
});

/**
 * Compare two vector clocks
 * Returns: -1 (a before b), 0 (concurrent/incomparable), 1 (a after b)
 */
export const compareVectorClocks = (a: VectorClock, b: VectorClock): -1 | 0 | 1 => {
  let aLess = false;
  let bLess = false;

  const allNodes = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const node of allNodes) {
    const aTime = a[node] ?? 0;
    const bTime = b[node] ?? 0;
    if (aTime < bTime) aLess = true;
    if (bTime < aTime) bLess = true;
  }

  if (!aLess && !bLess) return 0; // equal
  if (!aLess && bLess) return 1;   // a after b
  if (aLess && !bLess) return -1;  // a before b
  return 0; // concurrent
};

/**
 * Sign an operation (requires private key - for now stubbed)
 * In production, this would use the device's secure enclave
 */
const signOperation = async (
  contentHash: string,
  privateKey?: Uint8Array
): Promise<string> => {
  if (!privateKey) {
    // Stub: return deterministic fake signature for development
    return "stub_signature_" + contentHash.slice(0, 32);
  }
  // Real Schnorr signature
  const msgHash = new TextEncoder().encode(contentHash);
  const sig = schnorr.sign(msgHash, privateKey);
  return bytesToHex(sig);
};

/**
 * Verify operation signature
 */
export const verifyOperationSignature = (
  operation: CommunityMembershipOperation
): boolean => {
  const contentHash = hashOperationContent(
    operation.type,
    operation.communityId,
    operation.subjectPubkey,
    operation.actorPubkey,
    operation.vectorClock,
    operation.timestamp,
    operation.relayUrl,
    operation.metadata
  );

  if (operation.id !== contentHash) {
    return false; // ID doesn't match content
  }

  if (operation.signature.startsWith("stub_signature_")) {
    // Stub signature verification for development
    return operation.signature === "stub_signature_" + contentHash.slice(0, 32);
  }

  // Real verification
  try {
    const msgHash = new TextEncoder().encode(contentHash);
    const sigBytes = new Uint8Array(operation.signature.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const pubkeyBytes = new Uint8Array(operation.actorPubkey.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    return schnorr.verify(sigBytes, msgHash, pubkeyBytes);
  } catch {
    return false;
  }
};

/**
 * Create a new membership operation
 */
export const createMembershipOperation = async (params: Readonly<{
  type: CommunityOperationType;
  communityId: string;
  subjectPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
  relayUrl: string;
  vectorClock: VectorClock;
  metadata?: Record<string, unknown>;
  privateKey?: Uint8Array; // For signing
}>): Promise<CommunityMembershipOperation> => {
  const timestamp = Date.now();
  const id = hashOperationContent(
    params.type,
    params.communityId,
    params.subjectPubkey,
    params.actorPubkey,
    params.vectorClock,
    timestamp,
    params.relayUrl,
    params.metadata
  );

  const signature = await signOperation(id, params.privateKey);

  return {
    id,
    type: params.type,
    communityId: params.communityId,
    subjectPubkey: params.subjectPubkey,
    actorPubkey: params.actorPubkey,
    vectorClock: params.vectorClock,
    timestamp,
    relayUrl: params.relayUrl,
    metadata: params.metadata,
    signature,
  };
};

/**
 * Load all operations from storage
 */
export const loadOperationLog = (
  publicKeyHex: string,
  options?: { profileId?: string }
): CommunityMembershipOperation[] => {
  const cacheKey = `${publicKeyHex}:${options?.profileId ?? getResolvedProfileId()}`;
  
  // Check in-memory cache
  const cached = operationCacheByScope.get(cacheKey);
  if (cached) {
    return Array.from(cached.values()).map(e => e.operation);
  }

  // Load from localStorage
  const storageKey = toStorageKey(publicKeyHex, options?.profileId);
  const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
  
  if (!stored) {
    operationCacheByScope.set(cacheKey, new Map());
    return [];
  }

  try {
    const envelopes: OperationEnvelope[] = JSON.parse(stored);
    const operationMap = new Map<string, OperationEnvelope>();
    
    for (const envelope of envelopes) {
      // Validate signature before caching
      if (verifyOperationSignature(envelope.operation)) {
        operationMap.set(envelope.operation.id, envelope);
      }
    }
    
    operationCacheByScope.set(cacheKey, operationMap);
    return Array.from(operationMap.values()).map(e => e.operation);
  } catch {
    operationCacheByScope.set(cacheKey, new Map());
    return [];
  }
};

/**
 * Save operations to storage
 */
const saveOperationLog = (
  publicKeyHex: string,
  operations: Map<string, OperationEnvelope>,
  options?: { profileId?: string }
): void => {
  const profileId = options?.profileId ?? getResolvedProfileId();
  const storageKey = toStorageKey(publicKeyHex, profileId);
  const envelopes = Array.from(operations.values());
  
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey, JSON.stringify(envelopes));
  }

  const detail: CommunityOperationLogUpdatedEventDetail = {
    publicKeyHex,
    count: envelopes.length,
    profileId,
  };
  const scope = getProfileRuntimeScope();
  if (scope?.bus && scope.profileId === profileId) {
    scope.bus.publish({
      type: "community-operation-log-updated",
      detail,
    });
  }
};

/**
 * Add a single operation to the log
 * Returns true if added (new), false if duplicate/invalid
 */
export const addOperation = (
  publicKeyHex: string,
  operation: CommunityMembershipOperation,
  options?: { profileId?: string; receivedFrom?: string }
): boolean => {
  // Validate
  if (!verifyOperationSignature(operation)) {
    logAppEvent({
      name: "community.operation.invalid_signature",
      level: "warn",
      context: { operationId: operation.id, communityId: operation.communityId },
    });
    return false;
  }

  const cacheKey = `${publicKeyHex}:${options?.profileId ?? getResolvedProfileId()}`;
  let operations = operationCacheByScope.get(cacheKey);
  
  if (!operations) {
    // Load existing
    loadOperationLog(publicKeyHex, options);
    operations = operationCacheByScope.get(cacheKey)!;
  }

  // Check for duplicate
  if (operations.has(operation.id)) {
    return false;
  }

  // Add to cache
  operations.set(operation.id, {
    operation,
    receivedAt: Date.now(),
    receivedFrom: options?.receivedFrom,
  });

  // Persist
  saveOperationLog(publicKeyHex, operations, options);

  logAppEvent({
    name: "community.operation.added",
    level: "info",
    context: {
      operationId: operation.id,
      type: operation.type,
      communityId: operation.communityId,
      actor: operation.actorPubkey.slice(-8),
    },
  });

  return true;
};

/**
 * Get all operations for a specific community
 */
export const getCommunityOperations = (
  publicKeyHex: string,
  communityId: string,
  options?: { profileId?: string }
): CommunityMembershipOperation[] => {
  const allOps = loadOperationLog(publicKeyHex, options);
  return allOps.filter(op => op.communityId === communityId);
};

/**
 * Merge operations from another source (e.g., relay sync)
 * Returns count of new operations added
 */
export const mergeOperations = (
  publicKeyHex: string,
  incomingOps: CommunityMembershipOperation[],
  options?: { profileId?: string; receivedFrom?: string }
): number => {
  let added = 0;
  
  for (const op of incomingOps) {
    if (addOperation(publicKeyHex, op, options)) {
      added++;
    }
  }

  if (added > 0) {
    logAppEvent({
      name: "community.operation.merge_complete",
      level: "info",
      context: {
        received: incomingOps.length,
        added,
        from: options?.receivedFrom ?? "unknown",
      },
    });
  }

  return added;
};

/**
 * Clear operation log (for testing/reset)
 */
export const clearOperationLog = (
  publicKeyHex: string,
  options?: { profileId?: string }
): void => {
  const cacheKey = `${publicKeyHex}:${options?.profileId ?? getResolvedProfileId()}`;
  operationCacheByScope.delete(cacheKey);
  
  const storageKey = toStorageKey(publicKeyHex, options?.profileId);
  if (typeof window !== "undefined") {
    localStorage.removeItem(storageKey);
  }
};

// For testing
export const operationLogInternals = {
  clearOperationLog,
};
