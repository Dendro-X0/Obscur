/** Delay before sustained touch on a bubble counts as hover (action dock). */
export const MESSAGE_BUBBLE_SUSTAIN_HOVER_DELAY_MS = 420;

/** @deprecated Use {@link MESSAGE_BUBBLE_SUSTAIN_HOVER_DELAY_MS}. */
export const MESSAGE_BUBBLE_LONG_PRESS_DELAY_MS = MESSAGE_BUBBLE_SUSTAIN_HOVER_DELAY_MS;

export const MESSAGE_BUBBLE_LONG_PRESS_MOVE_TOLERANCE_PX = 12;
export const MESSAGE_BUBBLE_ACTION_DOCK_HIDE_DELAY_MS = 220;

type ShouldCancelMessageBubbleSustainHoverParams = Readonly<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    tolerancePx?: number;
}>;

export const shouldCancelMessageBubbleSustainHover = (
    params: ShouldCancelMessageBubbleSustainHoverParams,
): boolean => {
    const tolerancePx = params.tolerancePx ?? MESSAGE_BUBBLE_LONG_PRESS_MOVE_TOLERANCE_PX;
    const deltaX = params.currentX - params.startX;
    const deltaY = params.currentY - params.startY;
    return Math.hypot(deltaX, deltaY) > tolerancePx;
};

/** @deprecated Use {@link shouldCancelMessageBubbleSustainHover}. */
export const shouldCancelMessageBubbleLongPress = shouldCancelMessageBubbleSustainHover;
