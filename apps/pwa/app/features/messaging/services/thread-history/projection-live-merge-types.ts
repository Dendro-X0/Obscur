/**
 * Thread history projection merge contracts — shared by port and dm-kernel stub.
 */
import type { Message } from "../../types";

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
