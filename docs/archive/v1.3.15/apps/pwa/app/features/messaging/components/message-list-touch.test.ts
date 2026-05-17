import { describe, expect, it } from "vitest";
import {
    MESSAGE_BUBBLE_ACTION_DOCK_HIDE_DELAY_MS,
    MESSAGE_BUBBLE_LONG_PRESS_DELAY_MS,
    MESSAGE_BUBBLE_LONG_PRESS_MOVE_TOLERANCE_PX,
    shouldCancelMessageBubbleLongPress,
} from "./message-list-touch";

describe("message-list touch long press helpers", () => {
    it("uses the expected mobile long-press delay", () => {
        expect(MESSAGE_BUBBLE_LONG_PRESS_DELAY_MS).toBe(420);
        expect(MESSAGE_BUBBLE_ACTION_DOCK_HIDE_DELAY_MS).toBe(220);
    });

    it("keeps long press active for tiny movement and cancels for larger drags", () => {
        expect(shouldCancelMessageBubbleLongPress({
            startX: 100,
            startY: 100,
            currentX: 106,
            currentY: 107,
        })).toBe(false);

        expect(shouldCancelMessageBubbleLongPress({
            startX: 100,
            startY: 100,
            currentX: 112,
            currentY: 112,
        })).toBe(true);

        expect(MESSAGE_BUBBLE_LONG_PRESS_MOVE_TOLERANCE_PX).toBe(12);
    });
});
