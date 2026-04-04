export const MESSAGE_BUBBLE_LONG_PRESS_DELAY_MS = 420;
export const MESSAGE_BUBBLE_LONG_PRESS_MOVE_TOLERANCE_PX = 12;
export const MESSAGE_BUBBLE_ACTION_DOCK_HIDE_DELAY_MS = 220;

type ShouldCancelMessageBubbleLongPressParams = Readonly<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    tolerancePx?: number;
}>;

export const shouldCancelMessageBubbleLongPress = (
    params: ShouldCancelMessageBubbleLongPressParams,
): boolean => {
    const tolerancePx = params.tolerancePx ?? MESSAGE_BUBBLE_LONG_PRESS_MOVE_TOLERANCE_PX;
    const deltaX = params.currentX - params.startX;
    const deltaY = params.currentY - params.startY;
    return Math.hypot(deltaX, deltaY) > tolerancePx;
};
