import type { Message } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dmEventBuilderInternals } from "@/app/features/messaging/controllers/dm-event-builder";
import { collectMessageIdentityAliases } from "@/app/features/messaging/services/message-identity-alias-contract";
import type { GroupMetadata } from "../types";
import {
    buildCommunityInviteWirePlaintext,
    createCommunityDmInviteId,
    type CommunityDmInviteId,
} from "../services/community-dm-invite-contract";

export type BuildOutgoingCommunityInviteDmMessageParams = Readonly<{
    giftWrapEventId: string;
    canonicalRumorEventId: string;
    conversationId: string;
    myPublicKeyHex: PublicKeyHex;
    recipientPubkey: PublicKeyHex;
    groupId: string;
    roomKeyHex: string;
    metadata: GroupMetadata;
    inviteId?: CommunityDmInviteId;
    relayUrl?: string;
    communityId?: string;
    genesisEventId?: string;
    creatorPubkey?: string;
    timestamp?: Date;
}>;

/** NIP-17 rumor id for the unsigned invite payload (matches DM send pipeline). */
export const deriveCommunityInviteRumorEventId = async (params: Readonly<{
    senderPubkey: PublicKeyHex;
    recipientPubkey: PublicKeyHex;
    plaintext: string;
    createdAtUnixSeconds?: number;
}>): Promise<string> => {
    const createdAtUnixSeconds = params.createdAtUnixSeconds ?? Math.floor(Date.now() / 1000);
    return dmEventBuilderInternals.deriveUnsignedEventId({
        pubkey: params.senderPubkey,
        created_at: createdAtUnixSeconds,
        kind: 1059,
        tags: [["p", params.recipientPubkey]],
        content: params.plaintext,
    });
};

export const buildCommunityInvitePlaintext = (params: Readonly<{
    groupId: string;
    roomKeyHex: string;
    metadata: GroupMetadata;
    inviteId?: CommunityDmInviteId;
    relayUrl?: string;
    communityId?: string;
    genesisEventId?: string;
    creatorPubkey?: string;
}>): string => buildCommunityInviteWirePlaintext({
    type: "community-invite",
    inviteId: params.inviteId ?? createCommunityDmInviteId(),
    groupId: params.groupId,
    roomKey: params.roomKeyHex.trim(),
    metadata: params.metadata,
    relayUrl: params.relayUrl,
    communityId: params.communityId,
    genesisEventId: params.genesisEventId,
    creatorPubkey: params.creatorPubkey,
});

/**
 * Outgoing invite row aligned with NIP-17 DM identity: local id = gift-wrap, eventId = rumor.
 */
export const buildOutgoingCommunityInviteDmMessage = (
    params: BuildOutgoingCommunityInviteDmMessageParams,
): Message => {
    const timestamp = params.timestamp ?? new Date();
    const inviteId = params.inviteId ?? createCommunityDmInviteId();
    const content = buildCommunityInvitePlaintext({
        groupId: params.groupId,
        roomKeyHex: params.roomKeyHex,
        metadata: params.metadata,
        inviteId,
        relayUrl: params.relayUrl,
        communityId: params.communityId,
        genesisEventId: params.genesisEventId,
        creatorPubkey: params.creatorPubkey,
    });
    return {
        id: params.giftWrapEventId,
        conversationId: params.conversationId,
        kind: "user",
        content,
        timestamp,
        isOutgoing: true,
        status: "delivered",
        eventId: params.canonicalRumorEventId,
        relayPublishedEventId: params.giftWrapEventId,
        senderPubkey: params.myPublicKeyHex,
        recipientPubkey: params.recipientPubkey,
    };
};

export const collectCommunityInviteMessageIdentityAliases = (
    message: Pick<Message, "id" | "eventId"> & { relayPublishedEventId?: string },
): ReadonlyArray<string> => collectMessageIdentityAliases(message);
