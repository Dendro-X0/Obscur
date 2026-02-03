import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { createNostrEvent } from "./create-nostr-event";
import type { NostrEvent } from "./nostr-event";

export const GROUP_KINDS = {
    CHAT_MESSAGE: 9,
    THREADED_MESSAGE: 10,
    CREATE_GROUP: 9000,
    ADD_MEMBER: 9001,
    REMOVE_MEMBER: 9002,
    EDIT_METADATA: 9003,
    EDIT_ROLES: 9004,
    DELETE_GROUP: 9005,
    REQUEST_JOIN: 9021,
    LEAVE_GROUP: 9022,
    STATE_METADATA: 39000,
    STATE_ADMINS: 39001,
    STATE_MEMBERS: 39002,
    STATE_ROLES: 39003,
} as const;

export type CreateGroupMessageParams = Readonly<{
    privateKeyHex: PrivateKeyHex;
    groupId: string;
    content: string;
    replyTo?: string;
    tags?: ReadonlyArray<ReadonlyArray<string>>;
}>;

/**
 * Creates a NIP-29 group chat message (Kind 9)
 */
export const createGroupMessageEvent = async (params: CreateGroupMessageParams): Promise<NostrEvent> => {
    const tags: string[][] = [["h", params.groupId], ...(params.tags?.map(t => [...t]) ?? [])];
    if (params.replyTo) {
        tags.push(["e", params.replyTo, "", "reply"]);
    }
    return createNostrEvent({
        privateKeyHex: params.privateKeyHex,
        kind: GROUP_KINDS.CHAT_MESSAGE,
        content: params.content,
        tags,
    });
};

export type CreateGroupProposalParams = Readonly<{
    privateKeyHex: PrivateKeyHex;
    kind: number;
    groupId: string;
    content?: string;
    tags?: ReadonlyArray<ReadonlyArray<string>>;
}>;

/**
 * Creates a NIP-29 group proposal event (Kinds 9000-9005, 9021-9022)
 * These events are sent to relays to request actions.
 */
export const createGroupProposalEvent = async (params: CreateGroupProposalParams): Promise<NostrEvent> => {
    const tags: string[][] = [["h", params.groupId], ...(params.tags?.map(t => [...t]) ?? [])];
    return createNostrEvent({
        privateKeyHex: params.privateKeyHex,
        kind: params.kind,
        content: params.content ?? "",
        tags,
    });
};
