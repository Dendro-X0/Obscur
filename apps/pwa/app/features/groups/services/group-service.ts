import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "../../crypto/crypto-interfaces";
import { cryptoService } from "../../crypto/crypto-service";
import type { GroupMetadata } from "../types";

import { roomKeyStore } from "../../crypto/room-key-store";

/**
 * Service to handle Sealed Community operations.
 * All messages and moderation events are encrypted with a Room Key (Kind 10105).
 */
export class GroupService {
    constructor(
        private readonly myPublicKeyHex: PublicKeyHex,
        private readonly myPrivateKeyHex: PrivateKeyHex
    ) { }

    /**
     * Sends an encrypted message to the community.
     */
    async sendSealedMessage(params: {
        groupId: string;
        content: string;
        roomKeyHex?: string;
        replyTo?: string;
    }): Promise<NostrEvent> {
        const roomKeyHex = params.roomKeyHex || await roomKeyStore.getRoomKey(params.groupId);
        if (!roomKeyHex) {
            throw new Error("No room key found for this community. You may have been kicked or the key was lost.");
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
     * Distributes a Room Key to a specific user via NIP-17 Gift-Wrapped DM.
     */
    async distributeRoomKey(params: {
        recipientPubkey: PublicKeyHex;
        groupId: string;
        roomKeyHex: string;
        metadata: GroupMetadata;
        relayUrl?: string;
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
                relayUrl: params.relayUrl
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
