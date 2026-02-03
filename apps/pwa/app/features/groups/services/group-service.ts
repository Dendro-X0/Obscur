import { GROUP_KINDS, createGroupMessageEvent, createGroupProposalEvent } from "@dweb/nostr/create-nostr-group-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { cryptoService } from "../../crypto/crypto-service";

export type GroupMetadata = {
    name?: string;
    about?: string;
    picture?: string;
};

/**
 * Service to handle NIP-29 Group operations
 */
export class GroupService {
    constructor(
        private readonly myPublicKeyHex: PublicKeyHex,
        private readonly myPrivateKeyHex: PrivateKeyHex
    ) { }

    /**
     * Proposes creating a new group on a relay
     */
    async createGroup(params: { groupId: string; relayUrl: string }): Promise<NostrEvent> {
        return createGroupProposalEvent({
            privateKeyHex: this.myPrivateKeyHex,
            kind: GROUP_KINDS.CREATE_GROUP,
            groupId: params.groupId,
        });
    }

    /**
     * Proposes updating group metadata
     */
    async updateMetadata(params: { groupId: string; metadata: GroupMetadata }): Promise<NostrEvent> {
        const tags: string[][] = [];
        if (params.metadata.name) tags.push(["name", params.metadata.name]);
        if (params.metadata.about) tags.push(["about", params.metadata.about]);
        if (params.metadata.picture) tags.push(["picture", params.metadata.picture]);

        return createGroupProposalEvent({
            privateKeyHex: this.myPrivateKeyHex,
            kind: GROUP_KINDS.EDIT_METADATA,
            groupId: params.groupId,
            tags,
        });
    }

    /**
     * Sends a join request to a group
     */
    async requestJoin(params: { groupId: string }): Promise<NostrEvent> {
        return createGroupProposalEvent({
            privateKeyHex: this.myPrivateKeyHex,
            kind: GROUP_KINDS.REQUEST_JOIN,
            groupId: params.groupId,
        });
    }

    /**
     * Leaves a group
     */
    async leaveGroup(params: { groupId: string }): Promise<NostrEvent> {
        return createGroupProposalEvent({
            privateKeyHex: this.myPrivateKeyHex,
            kind: GROUP_KINDS.LEAVE_GROUP,
            groupId: params.groupId,
        });
    }

    /**
     * Sends a message to a group
     */
    async sendMessage(params: { groupId: string; content: string; replyTo?: string }): Promise<NostrEvent> {
        return createGroupMessageEvent({
            privateKeyHex: this.myPrivateKeyHex,
            groupId: params.groupId,
            content: params.content,
            replyTo: params.replyTo,
        });
    }

    /**
     * Adds a user to a group (Admin only)
     */
    async addUser(params: { groupId: string; userPubkey: PublicKeyHex; role?: string }): Promise<NostrEvent> {
        const tags = [["p", params.userPubkey, params.role ?? "member"]];
        return createGroupProposalEvent({
            privateKeyHex: this.myPrivateKeyHex,
            kind: GROUP_KINDS.ADD_MEMBER,
            groupId: params.groupId,
            tags,
        });
    }

    /**
     * Removes a user from a group (Admin only)
     */
    async removeUser(params: { groupId: string; userPubkey: PublicKeyHex }): Promise<NostrEvent> {
        const tags = [["p", params.userPubkey]];
        return createGroupProposalEvent({
            privateKeyHex: this.myPrivateKeyHex,
            kind: GROUP_KINDS.REMOVE_MEMBER,
            groupId: params.groupId,
            tags,
        });
    }
}
