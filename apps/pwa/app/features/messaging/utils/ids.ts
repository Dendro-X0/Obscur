
import type { DmConversation, GroupConversation, MessagesByConversationId, Message } from "../types";

let nextContactId: number = 4;
let nextGroupId: number = 1;
const INITIAL_MESSAGE_ID: number = 1000;
let nextMessageId: number = INITIAL_MESSAGE_ID;

export const createContactId = (): string => {
    const id: string = String(nextContactId);
    nextContactId += 1;
    return id;
};

export const createGroupId = (): string => {
    const id: string = `g${nextGroupId}`;
    nextGroupId += 1;
    return id;
};

export const createMessageId = (): string => {
    const id: string = `m${nextMessageId}`;
    nextMessageId += 1;
    return id;
};

export const syncIdCountersFromState = (params: Readonly<{ createdContacts: ReadonlyArray<DmConversation>; createdGroups: ReadonlyArray<GroupConversation>; messagesByConversationId: MessagesByConversationId }>): void => {
    const contactIds: number[] = params.createdContacts
        .map((c: DmConversation): number => Number.parseInt(c.id, 10))
        .filter((n: number): boolean => Number.isFinite(n));
    const maxContactId: number = contactIds.length > 0 ? Math.max(...contactIds) : nextContactId - 1;
    nextContactId = Math.max(nextContactId, maxContactId + 1);
    const groupNumbers: number[] = params.createdGroups
        .map((g: GroupConversation): number => {
            const match: RegExpMatchArray | null = g.id.match(/^g(\d+)$/);
            return match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
        })
        .filter((n: number): boolean => Number.isFinite(n));
    const maxGroupId: number = groupNumbers.length > 0 ? Math.max(...groupNumbers) : nextGroupId - 1;
    nextGroupId = Math.max(nextGroupId, maxGroupId + 1);
    const messageNumbers: number[] = Object.values(params.messagesByConversationId)
        .flatMap((messages: ReadonlyArray<Message>): ReadonlyArray<number> =>
            messages
                .map((m: Message): number => {
                    const match: RegExpMatchArray | null = m.id.match(/^m(\d+)$/);
                    return match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
                })
        )
        .filter((n: number): boolean => Number.isFinite(n));
    const maxMessageId: number = messageNumbers.length > 0 ? Math.max(...messageNumbers) : nextMessageId - 1;
    nextMessageId = Math.max(nextMessageId, maxMessageId + 1);
};
