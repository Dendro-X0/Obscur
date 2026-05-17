export type MessageListScrollMetrics = Readonly<{
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}>;

export type MessageListScrollMode =
    | "follow_bottom"
    | "user_reading_history"
    | "loading_earlier"
    | "search_jump";

export const MESSAGE_LIST_SCROLL_BOTTOM_BUTTON_THRESHOLD_PX = 300;
export const MESSAGE_LIST_FAST_SCROLL_VELOCITY_THRESHOLD_PX_PER_MS = 1.5;
export const MESSAGE_LIST_FRESH_OUTGOING_AUTOSCROLL_THRESHOLD_MS = 15_000;
export const MESSAGE_LIST_SIZE_ADJUST_NEAR_BOTTOM_THRESHOLD_PX = 80;
export const MESSAGE_LIST_USER_AWAY_FROM_BOTTOM_THRESHOLD_PX = 4;

export const isMessageListAwayFromBottom = (
    metrics: MessageListScrollMetrics,
    thresholdPx: number = MESSAGE_LIST_SCROLL_BOTTOM_BUTTON_THRESHOLD_PX,
): boolean => {
    return (metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight) > thresholdPx;
};

export const isMessageListUserAwayFromBottom = (
    metrics: MessageListScrollMetrics,
    thresholdPx: number = MESSAGE_LIST_USER_AWAY_FROM_BOTTOM_THRESHOLD_PX,
): boolean => {
    return isMessageListAwayFromBottom(metrics, thresholdPx);
};

export const isMessageListFastScroll = (params: Readonly<{
    previousScrollTop: number;
    previousScrollTimestampMs: number;
    nextScrollTop: number;
    nextScrollTimestampMs: number;
    velocityThresholdPxPerMs?: number;
}>): boolean => {
    const deltaY = Math.abs(params.nextScrollTop - params.previousScrollTop);
    const deltaT = Math.max(1, params.nextScrollTimestampMs - params.previousScrollTimestampMs);
    const velocityPxPerMs = deltaY / deltaT;
    return velocityPxPerMs > (params.velocityThresholdPxPerMs ?? MESSAGE_LIST_FAST_SCROLL_VELOCITY_THRESHOLD_PX_PER_MS);
};

export const shouldAdjustScrollForSizeChange = (
    metrics: MessageListScrollMetrics,
    nearBottomThresholdPx: number = MESSAGE_LIST_SIZE_ADJUST_NEAR_BOTTOM_THRESHOLD_PX,
): boolean => {
    return !isMessageListAwayFromBottom(metrics, nearBottomThresholdPx);
};

export const shouldAutoScrollOnNewMessage = (params: Readonly<{
    hasPreviousLastMessage: boolean;
    isAwayFromBottom: boolean;
    isOutgoing: boolean;
    messageTimestampMs: number;
    nowMs: number;
    freshOutgoingThresholdMs?: number;
}>): boolean => {
    if (!params.hasPreviousLastMessage) {
        return true;
    }
    const freshOutgoingThresholdMs = params.freshOutgoingThresholdMs ?? MESSAGE_LIST_FRESH_OUTGOING_AUTOSCROLL_THRESHOLD_MS;
    const outgoingMessageAgeMs = Math.max(0, params.nowMs - params.messageTimestampMs);
    if (params.isOutgoing && outgoingMessageAgeMs <= freshOutgoingThresholdMs) {
        return true;
    }
    return !params.isAwayFromBottom;
};

export const isMessageListFollowBottomMode = (mode: MessageListScrollMode): boolean => mode === "follow_bottom";

export const canMessageListAutoScrollToBottom = (mode: MessageListScrollMode): boolean =>
    isMessageListFollowBottomMode(mode);

export const shouldMessageListLockToUserHistoryOnUpwardScroll = (params: Readonly<{
    mode: MessageListScrollMode;
    deltaY: number;
    isTrustedUserScroll: boolean;
}>): boolean => {
    if (!isMessageListFollowBottomMode(params.mode)) {
        return false;
    }
    if (!params.isTrustedUserScroll) {
        return false;
    }
    return params.deltaY < 0;
};
