import type { Message } from "../types";

import { filterMessagesByLocalRetention } from "./dm-conversation-message-retention-dedupe";
import {
    filterMessagesBySuppressedIds,
    mergeProjectionFirstWithOverlayMessages,
} from "./conversation-message-materialization";

export { areMessageListsEquivalentById } from "./dm-conversation-message-list-equiv";

export type MergeProjectionFirstWithLiveOverlayForDisplayParams = Readonly<{
    projectionMessages: ReadonlyArray<Message>;
    previousMessages: ReadonlyArray<Message>;
    conversationAliasIdSet: ReadonlySet<string>;
    persistentSuppressedMessageIds: ReadonlySet<string>;
    localMessageRetentionDays: number | undefined;
    expandedHistory: boolean;
    liveWindowSoftLimit: number;
    isDisplayable: (message: Message) => boolean;
}>;

export type MergeProjectionFirstWithLiveOverlayForDisplayResult = Readonly<{
    retentionFilteredNextMessages: ReadonlyArray<Message>;
    shouldCapToLiveWindow: boolean;
    mergedMessageCount: number;
    cappedMessageCount: number;
}>;

/**
 * Merges projection evidence with live overlay messages, applies tombstone suppression,
 * optional live-window cap, and local retention — same ordering and steps as the
 * `useConversationMessages` projection merge effect.
 */
export const mergeProjectionFirstWithLiveOverlayForDisplay = (
    params: MergeProjectionFirstWithLiveOverlayForDisplayParams,
): MergeProjectionFirstWithLiveOverlayForDisplayResult => {
    const merged = filterMessagesBySuppressedIds(
        mergeProjectionFirstWithOverlayMessages(
            params.projectionMessages,
            params.previousMessages,
            (message: Message) => {
                const msgCid = typeof message.conversationId === "string" ? message.conversationId.trim() : "";
                return !msgCid || params.conversationAliasIdSet.has(msgCid);
            },
        ).filter(params.isDisplayable),
        params.persistentSuppressedMessageIds,
    ).sort((left: Message, right: Message) => left.timestamp.getTime() - right.timestamp.getTime());

    const shouldCapToLiveWindow = !params.expandedHistory && merged.length > params.liveWindowSoftLimit;
    const nextMessages = shouldCapToLiveWindow
        ? merged.slice(-params.liveWindowSoftLimit)
        : merged;
    const retentionFilteredNextMessages = filterMessagesByLocalRetention(
        nextMessages,
        params.localMessageRetentionDays,
    );

    return {
        retentionFilteredNextMessages,
        shouldCapToLiveWindow,
        mergedMessageCount: merged.length,
        cappedMessageCount: nextMessages.length,
    };
};
