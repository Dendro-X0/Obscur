import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunitySendBlockReasonCode } from "@dweb/core/community-sendability-contracts";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "../../crypto/crypto-interfaces";
import { cryptoService } from "../../crypto/crypto-service";
import type { GroupMetadata } from "../types";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";

import { roomKeyStore } from "../../crypto/room-key-store";

type GroupRoomKeyMissingReasonCode = Extract<
    CommunitySendBlockReasonCode,
    | "no_local_room_keys"
    | "target_room_key_missing_local_profile_scope"
    | "target_room_key_record_unreadable"
    | "target_room_key_missing_after_membership_joined"
    | "room_key_store_unavailable"
>;

/**
 * Service to handle Sealed Community operations.
 * All messages and moderation events are encrypted with a Room Key (Kind 10105).
 */
export class GroupService {
    constructor(
        private readonly myPublicKeyHex: PublicKeyHex,
        private readonly myPrivateKeyHex: PrivateKeyHex
    ) { }

    private toGroupIdHint(groupId: string): string {
        return groupId.length > 24
            ? `${groupId.slice(0, 12)}...${groupId.slice(-8)}`
            : groupId;
    }

    /**
     * Sends an encrypted message to the community.
     */
    async sendSealedMessage(params: {
        groupId: string;
        content: string;
        roomKeyHex?: string;
        replyTo?: string;
    }): Promise<NostrEvent> {
        const directRecord = params.roomKeyHex
            ? null
            : await roomKeyStore.getRoomKeyRecord(params.groupId);
        const roomKeyHex = params.roomKeyHex || directRecord?.roomKeyHex || null;
        if (!roomKeyHex) {
            let reasonCode: GroupRoomKeyMissingReasonCode = "no_local_room_keys";
            let localRoomKeyCount: number | null = null;
            let hasTargetGroupRecord = false;
            let knownGroupHintSample = "none";
            let joinedMembershipCount: number | null = null;
            let hasTargetJoinedMembership = false;
            try {
                const membershipEntries = loadCommunityMembershipLedger(this.myPublicKeyHex);
                const joinedEntries = membershipEntries.filter((entry) => entry.status === "joined");
                joinedMembershipCount = joinedEntries.length;
                hasTargetJoinedMembership = joinedEntries.some((entry) => entry.groupId === params.groupId);
            } catch {
                joinedMembershipCount = null;
                hasTargetJoinedMembership = false;
            }
            try {
                const records = await roomKeyStore.listRoomKeyRecords();
                localRoomKeyCount = records.length;
                hasTargetGroupRecord = records.some((record) => record.groupId === params.groupId);
                knownGroupHintSample = records
                    .slice(0, 3)
                    .map((record) => this.toGroupIdHint(record.groupId))
                    .join("|") || "none";
                if (hasTargetGroupRecord) {
                    reasonCode = "target_room_key_record_unreadable";
                } else if (hasTargetJoinedMembership) {
                    reasonCode = "target_room_key_missing_after_membership_joined";
                } else if (records.length > 0) {
                    reasonCode = "target_room_key_missing_local_profile_scope";
                } else {
                    reasonCode = "no_local_room_keys";
                }
            } catch {
                reasonCode = "room_key_store_unavailable";
            }
            logAppEvent({
                name: "groups.room_key_missing_send_blocked",
                level: "warn",
                scope: { feature: "groups", action: "send_message" },
                context: {
                    groupIdHint: this.toGroupIdHint(params.groupId),
                    reasonCode,
                    localRoomKeyCount,
                    hasTargetGroupRecord,
                    activeProfileId: getActiveProfileIdSafe(),
                    senderPubkeySuffix: this.myPublicKeyHex.slice(-8),
                    knownGroupHintSample,
                    joinedMembershipCount,
                    hasTargetJoinedMembership,
                },
            });
            throw new Error("No room key found for this community on this device. Restore may be incomplete or key distribution has not arrived yet.");
        }

        const nowUnixSeconds = Math.floor(Date.now() / 1000);

        const innerPayload = JSON.stringify({
            kind: 9, // Inner kind is always 9 for chat
            content: params.content,
            created_at: nowUnixSeconds,
            pubkey: this.myPublicKeyHex,
            replyTo: params.replyTo
        });

        const encrypted = await cryptoService.encryptGroupMessage(innerPayload, roomKeyHex);

        const unsigned: UnsignedNostrEvent = {
            kind: 10105,
            created_at: nowUnixSeconds,
            tags: [["h", params.groupId]],
            content: JSON.stringify(encrypted),
            pubkey: this.myPublicKeyHex
        };

        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Broadcasts a consensus vote (e.g., to kick a member).
     */
    async sendSealedVote(params: {
        groupId: string;
        roomKeyHex: string;
        type: "kick" | "promote";
        targetPubkey: string;
        reason?: string;
    }): Promise<NostrEvent> {
        const nowUnixSeconds = Math.floor(Date.now() / 1000);

        const innerPayload = JSON.stringify({
            type: `vote-${params.type}`,
            target: params.targetPubkey,
            reason: params.reason,
            pubkey: this.myPublicKeyHex,
            created_at: nowUnixSeconds
        });

        const encrypted = await cryptoService.encryptGroupMessage(innerPayload, params.roomKeyHex);

        const unsigned: UnsignedNostrEvent = {
            kind: 10105,
            created_at: nowUnixSeconds,
            tags: [["h", params.groupId], ["t", `vote-${params.type}`]],
            content: JSON.stringify(encrypted),
            pubkey: this.myPublicKeyHex
        };

        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Broadcasts that the user is leaving the community.
     */
    async sendSealedLeave(params: {
        groupId: string;
        roomKeyHex: string;
    }): Promise<NostrEvent> {
        const nowUnixSeconds = Math.floor(Date.now() / 1000);

        const innerPayload = JSON.stringify({
            type: "leave",
            pubkey: this.myPublicKeyHex,
            created_at: nowUnixSeconds
        });

        const encrypted = await cryptoService.encryptGroupMessage(innerPayload, params.roomKeyHex);

        const unsigned: UnsignedNostrEvent = {
            kind: 10105,
            created_at: nowUnixSeconds,
            tags: [["h", params.groupId], ["t", "leave"]],
            content: JSON.stringify(encrypted),
            pubkey: this.myPublicKeyHex
        };

        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Broadcasts that the user is joining the community.
     */
    async sendSealedJoin(params: {
        groupId: string;
        roomKeyHex: string;
    }): Promise<NostrEvent> {
        const nowUnixSeconds = Math.floor(Date.now() / 1000);

        const innerPayload = JSON.stringify({
            type: "join",
            pubkey: this.myPublicKeyHex,
            created_at: nowUnixSeconds
        });

        const encrypted = await cryptoService.encryptGroupMessage(innerPayload, params.roomKeyHex);

        const unsigned: UnsignedNostrEvent = {
            kind: 10105,
            created_at: nowUnixSeconds,
            tags: [["h", params.groupId], ["t", "join"]],
            content: JSON.stringify(encrypted),
            pubkey: this.myPublicKeyHex
        };

        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Broadcasts that the community is disbanded.
     * This is emitted when the last known member leaves.
     */
    async sendSealedDisband(params: {
        groupId: string;
        roomKeyHex: string;
    }): Promise<NostrEvent> {
        const nowUnixSeconds = Math.floor(Date.now() / 1000);

        const innerPayload = JSON.stringify({
            type: "disband",
            pubkey: this.myPublicKeyHex,
            created_at: nowUnixSeconds
        });

        const encrypted = await cryptoService.encryptGroupMessage(innerPayload, params.roomKeyHex);

        const unsigned: UnsignedNostrEvent = {
            kind: 10105,
            created_at: nowUnixSeconds,
            tags: [["h", params.groupId], ["t", "disband"]],
            content: JSON.stringify(encrypted),
            pubkey: this.myPublicKeyHex
        };

        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Emits a sealed community genesis event. This signed event id is used as Community V2 genesis identity seed.
     */
    async sendSealedCommunityCreated(params: {
        groupId: string;
        roomKeyHex: string;
        metadata: GroupMetadata;
    }): Promise<NostrEvent> {
        const nowUnixSeconds = Math.floor(Date.now() / 1000);

        const innerPayload = JSON.stringify({
            type: "community.created",
            pubkey: this.myPublicKeyHex,
            created_at: nowUnixSeconds,
            metadata: params.metadata
        });

        const encrypted = await cryptoService.encryptGroupMessage(innerPayload, params.roomKeyHex);

        const unsigned: UnsignedNostrEvent = {
            kind: 10105,
            created_at: nowUnixSeconds,
            tags: [["h", params.groupId], ["t", "community.created"]],
            content: JSON.stringify(encrypted),
            pubkey: this.myPublicKeyHex
        };

        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Sends a NIP-29 LEAVE event so the relay updates its Kind 39002 roster.
     */
    async sendNip29Leave(params: {
        groupId: string;
    }): Promise<NostrEvent> {
        const unsigned: UnsignedNostrEvent = {
            kind: 9022,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["h", params.groupId]],
            content: "",
            pubkey: this.myPublicKeyHex
        };
        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Sends a NIP-29 JOIN event to the relay.
     */
    async sendNip29Join(params: {
        groupId: string;
        reason?: string;
    }): Promise<NostrEvent> {
        const unsigned: UnsignedNostrEvent = {
            kind: 9021,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["h", params.groupId]],
            content: params.reason ?? "",
            pubkey: this.myPublicKeyHex
        };
        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Distributes a Room Key to a specific user via NIP-17 Gift-Wrapped DM.
     */
    async distributeRoomKey(params: {
        recipientPubkey: PublicKeyHex;
        groupId: string;
        roomKeyHex: string;
        metadata: GroupMetadata;
        relayUrl?: string;
        communityId?: string;
        genesisEventId?: string;
        creatorPubkey?: string;
    }): Promise<NostrEvent> {
        const rumor: UnsignedNostrEvent = {
            kind: 1059, // NIP-17 Gift Wrap subtype (Invite)
            created_at: Math.floor(Date.now() / 1000),
            tags: [["p", params.recipientPubkey]],
            content: JSON.stringify({
                type: "community-invite",
                groupId: params.groupId,
                roomKey: params.roomKeyHex,
                metadata: params.metadata,
                relayUrl: params.relayUrl,
                communityId: params.communityId,
                genesisEventId: params.genesisEventId,
                creatorPubkey: params.creatorPubkey
            }),
            pubkey: this.myPublicKeyHex
        };

        return await cryptoService.encryptGiftWrap(rumor, this.myPrivateKeyHex, params.recipientPubkey);
    }

    /**
     * Sends an encrypted reaction to a community message.
     */
    async sendSealedReaction(params: {
        groupId: string;
        eventId: string;
        emoji: string;
        roomKeyHex?: string;
    }): Promise<NostrEvent> {
        const roomKeyHex = params.roomKeyHex || await roomKeyStore.getRoomKey(params.groupId);
        if (!roomKeyHex) throw new Error("Missing room key");

        const nowUnixSeconds = Math.floor(Date.now() / 1000);

        const innerPayload = JSON.stringify({
            kind: 7, // Inner kind 7 for reaction
            content: params.emoji,
            target: params.eventId,
            created_at: nowUnixSeconds,
            pubkey: this.myPublicKeyHex
        });

        const encrypted = await cryptoService.encryptGroupMessage(innerPayload, roomKeyHex);

        const unsigned: UnsignedNostrEvent = {
            kind: 10105,
            created_at: nowUnixSeconds,
            tags: [["h", params.groupId], ["e", params.eventId], ["t", "reaction"]],
            content: JSON.stringify(encrypted),
            pubkey: this.myPublicKeyHex
        };

        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }

    /**
     * Deletes a message locally (Kind 5).
     * In Sealed Communities, this is a hint for clients to hide the message.
     */
    async hideMessage(params: { groupId: string; eventId: string; reason?: string }): Promise<NostrEvent> {
        const unsigned: UnsignedNostrEvent = {
            kind: 5,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["e", params.eventId], ["h", params.groupId]],
            content: params.reason ?? "",
            pubkey: this.myPublicKeyHex,
        };
        return await cryptoService.signEvent(unsigned, this.myPrivateKeyHex);
    }
}
