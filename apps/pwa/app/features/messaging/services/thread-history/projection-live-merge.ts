/**
 * Projection-first merge with live overlay for web legacy thread-history path.
 * Native DM uses dm-kernel.
 */

import type { Message } from "@/app/features/messaging/types";
import { filterMessagesByLocalRetention } from "@/app/features/messaging/services/dm-conversation-message-retention-dedupe";
import {
  filterMessagesBySuppressedIds,
  mergeProjectionFirstWithOverlayMessages,
} from "@/app/features/messaging/services/conversation-message-materialization";
import type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "./projection-live-merge-types";

export type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "./projection-live-merge-types";

/**
 * Merges projection evidence with live overlay messages, applies tombstone suppression,
 * optional live-window cap, and local retention.
 */
export const mergeLegacyProjectionFirstWithLiveOverlayForDisplay = (
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

/** @deprecated Use mergeLegacyProjectionFirstWithLiveOverlayForDisplay */
export const mergeProjectionFirstWithLiveOverlayForDisplay = mergeLegacyProjectionFirstWithLiveOverlayForDisplay;
