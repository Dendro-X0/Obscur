import type { Message } from "../types";

export type BatchMessageSelectionToggleParams = Readonly<{
  messageId: string;
  shiftKey: boolean;
}>;

const isSelectableBatchMessage = (message: Message): boolean => (
  message.kind !== "command"
);

/**
 * Shift+click range selection against the visible message order (oldest → newest).
 * Anchor is the last non-shift click; shift selects inclusive range anchor…target.
 */
export const applyBatchMessageSelectionToggle = (params: Readonly<{
  messages: ReadonlyArray<Message>;
  currentSelectedIds: ReadonlySet<string>;
  anchorMessageId: string | null;
  toggle: BatchMessageSelectionToggleParams;
}>): Readonly<{
  selectedIds: ReadonlySet<string>;
  anchorMessageId: string;
}> => {
  const selectable = params.messages.filter(isSelectableBatchMessage);
  const targetIndex = selectable.findIndex((message) => message.id === params.toggle.messageId);
  if (targetIndex < 0) {
    return {
      selectedIds: params.currentSelectedIds,
      anchorMessageId: params.anchorMessageId ?? params.toggle.messageId,
    };
  }

  if (params.toggle.shiftKey) {
    const anchorId = params.anchorMessageId ?? selectable[0]?.id ?? params.toggle.messageId;
    const anchorIndex = selectable.findIndex((message) => message.id === anchorId);
    const resolvedAnchorIndex = anchorIndex >= 0 ? anchorIndex : targetIndex;
    const start = Math.min(resolvedAnchorIndex, targetIndex);
    const end = Math.max(resolvedAnchorIndex, targetIndex);
    const rangeIds = selectable.slice(start, end + 1).map((message) => message.id);
    return {
      selectedIds: new Set(rangeIds),
      anchorMessageId: anchorId,
    };
  }

  const next = new Set(params.currentSelectedIds);
  if (next.has(params.toggle.messageId)) {
    next.delete(params.toggle.messageId);
  } else {
    next.add(params.toggle.messageId);
  }
  return {
    selectedIds: next,
    anchorMessageId: params.toggle.messageId,
  };
};
