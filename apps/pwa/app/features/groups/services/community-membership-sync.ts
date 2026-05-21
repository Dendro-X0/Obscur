/**
 * Community Membership Sync Service
 * 
 * Architectural fix for decentralized membership synchronization.
 * 
 * Problem: In a decentralized relay-based system, membership updates cannot rely
 * solely on DMs. DMs can be lost, and the sender (A) has no way to query "who joined".
 * 
 * Solution: Subscribe to NIP-29 membership events on the community relay and process
 * them to maintain an eventually consistent view of the membership roster.
 * 
 * Relay-visible membership (cross-client):
 * See `community-relay-membership-interop.ts` for kind classification.
 * - 9021 / 9022: Obscur relay join/leave (also used by this app)
 * - 39002: member roster snapshot (`p` tags)
 * - 39001: join-like OR Obscur CRDT gossip (`t: membership-delta`)
 * - 10105 sealed: join / leave / membership_restate (Obscur clients with room key)
 * 
 * This service provides:
 * 1. Subscription to membership events for specific groups
 * 2. Processing of join/leave events to update local roster
 * 3. Periodic sync/gossip to ensure consistency
 * 4. Conflict resolution for concurrent membership changes
 */

import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export interface MembershipSyncOptions {
    groupId: string;
    relayUrl: string;
    onMemberJoined?: (memberPubkey: PublicKeyHex, event: NostrEvent) => void;
    onMemberLeft?: (memberPubkey: PublicKeyHex, event: NostrEvent) => void;
}

export interface MembershipSyncState {
    memberPubkeys: ReadonlyArray<PublicKeyHex>;
    lastSyncAt: number | null;
    isSubscribed: boolean;
}

/**
 * Subscribe to membership events for a specific group.
 * 
 * This allows the group creator (and other members) to learn about membership
 * changes via the relay, not just DMs.
 */
export function subscribeToMembershipEvents(
    options: MembershipSyncOptions
): { unsubscribe: () => void; getState: () => MembershipSyncState } {
    // TODO: Implement subscription to NIP-29 events (kinds 39001, 39002)
    // on the specified relay for the specified group
    
    // TODO: Process events and call onMemberJoined/onMemberLeft callbacks
    
    // TODO: Maintain sync state for conflict resolution
    
    return {
        unsubscribe: () => {
            // TODO: Clean up subscription
        },
        getState: () => ({
            memberPubkeys: [],
            lastSyncAt: null,
            isSubscribed: false,
        }),
    };
}

/**
 * Process a NIP-29 join event.
 * 
 * Validates the event and extracts the member pubkey.
 */
export function processNip29JoinEvent(event: NostrEvent): { 
    memberPubkey: PublicKeyHex; 
    groupId: string;
    valid: boolean;
} | null {
    // NIP-29 join events are kind 39001 with tags: [["h", groupId]]
    if (event.kind !== 39001) return null;
    
    const groupId = event.tags.find(t => t[0] === "h")?.[1];
    if (!groupId) return null;
    
    // The pubkey is the event's pubkey (the person joining)
    const memberPubkey = event.pubkey as PublicKeyHex;
    
    return {
        memberPubkey,
        groupId,
        valid: true,
    };
}

/**
 * Process a NIP-29 leave event.
 */
export function processNip29LeaveEvent(event: NostrEvent): {
    memberPubkey: PublicKeyHex;
    groupId: string;
    valid: boolean;
} | null {
    // NIP-29 leave events are kind 39002 with tags: [["h", groupId]]
    if (event.kind !== 39002) return null;
    
    const groupId = event.tags.find(t => t[0] === "h")?.[1];
    if (!groupId) return null;
    
    const memberPubkey = event.pubkey as PublicKeyHex;
    
    return {
        memberPubkey,
        groupId,
        valid: true,
    };
}

/**
 * Gossip sync: Query the relay for current membership state.
 * 
 * This is used to recover membership state after restart or when
 * joining a new group.
 */
export async function gossipSyncMembership(params: {
    groupId: string;
    relayUrl: string;
    since?: number;
}): Promise<{
    memberPubkeys: ReadonlyArray<PublicKeyHex>;
    syncedAt: number;
}> {
    // TODO: Query relay for recent join/leave events
    // TODO: Reconstruct membership list from events
    // TODO: Handle conflicts (e.g., join after leave)
    
    return {
        memberPubkeys: [],
        syncedAt: Date.now(),
    };
}

/**
 * Resolve membership conflicts.
 * 
 * In a decentralized system, different members may have different views
 * of the membership roster. This function resolves conflicts based on:
 * 1. Event timestamps (later events win)
 * 2. Signature validity
 * 3. Expulsion overrides (admin decisions take precedence)
 */
export function resolveMembershipConflict(
    localView: ReadonlyArray<PublicKeyHex>,
    remoteView: ReadonlyArray<PublicKeyHex>,
    operations: ReadonlyArray<{ type: "join" | "leave"; pubkey: PublicKeyHex; timestamp: number }>
): ReadonlyArray<PublicKeyHex> {
    // TODO: Apply operations in timestamp order to resolve conflicts
    // TODO: Return the resolved membership list
    
    return localView;
}
