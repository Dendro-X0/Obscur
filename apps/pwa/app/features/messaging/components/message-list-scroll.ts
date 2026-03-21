export type MessageListScrollMetrics = Readonly<{
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}>;

export const MESSAGE_LIST_SCROLL_BOTTOM_BUTTON_THRESHOLD_PX = 300;
export const MESSAGE_LIST_FAST_SCROLL_VELOCITY_THRESHOLD_PX_PER_MS = 1.5;

export const isMessageListAwayFromBottom = (
    metrics: MessageListScrollMetrics,
    thresholdPx: number = MESSAGE_LIST_SCROLL_BOTTOM_BUTTON_THRESHOLD_PX,
): boolean => {
    return (metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight) > thresholdPx;
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

