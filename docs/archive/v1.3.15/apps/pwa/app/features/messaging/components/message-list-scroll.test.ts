import { describe, expect, it } from "vitest";
import {
    canMessageListAutoScrollToBottom,
    isMessageListFollowBottomMode,
    isMessageListAwayFromBottom,
    isMessageListFastScroll,
    isMessageListUserAwayFromBottom,
    MESSAGE_LIST_SIZE_ADJUST_NEAR_BOTTOM_THRESHOLD_PX,
    MESSAGE_LIST_SCROLL_BOTTOM_BUTTON_THRESHOLD_PX,
    MESSAGE_LIST_USER_AWAY_FROM_BOTTOM_THRESHOLD_PX,
    shouldMessageListLockToUserHistoryOnUpwardScroll,
    shouldAdjustScrollForSizeChange,
    shouldAutoScrollOnNewMessage,
} from "./message-list-scroll";

describe("message-list scroll utils", () => {
    it("marks away-from-bottom only when distance exceeds threshold", () => {
        expect(isMessageListAwayFromBottom({
            scrollTop: 700,
            scrollHeight: 1200,
            clientHeight: 200,
        })).toBe(false);
        expect(isMessageListAwayFromBottom({
            scrollTop: 699,
            scrollHeight: 1200,
            clientHeight: 200,
        })).toBe(true);
        expect(MESSAGE_LIST_SCROLL_BOTTOM_BUTTON_THRESHOLD_PX).toBe(300);
    });

    it("detects user-away-from-bottom with a much tighter threshold", () => {
        expect(isMessageListUserAwayFromBottom({
            scrollTop: 796,
            scrollHeight: 1000,
            clientHeight: 200,
        })).toBe(false);
        expect(isMessageListUserAwayFromBottom({
            scrollTop: 795,
            scrollHeight: 1000,
            clientHeight: 200,
        })).toBe(true);
        expect(MESSAGE_LIST_USER_AWAY_FROM_BOTTOM_THRESHOLD_PX).toBe(4);
    });

    it("detects fast scroll when velocity exceeds threshold", () => {
        expect(isMessageListFastScroll({
            previousScrollTop: 100,
            previousScrollTimestampMs: 1000,
            nextScrollTop: 400,
            nextScrollTimestampMs: 1100,
        })).toBe(true);
        expect(isMessageListFastScroll({
            previousScrollTop: 100,
            previousScrollTimestampMs: 1000,
            nextScrollTop: 200,
            nextScrollTimestampMs: 1200,
        })).toBe(false);
    });

    it("remains stable when timestamps are equal or inverted", () => {
        expect(isMessageListFastScroll({
            previousScrollTop: 100,
            previousScrollTimestampMs: 1000,
            nextScrollTop: 101,
            nextScrollTimestampMs: 1000,
            velocityThresholdPxPerMs: 0.5,
        })).toBe(true);
        expect(isMessageListFastScroll({
            previousScrollTop: 100,
            previousScrollTimestampMs: 1000,
            nextScrollTop: 100,
            nextScrollTimestampMs: 999,
            velocityThresholdPxPerMs: 0.1,
        })).toBe(false);
    });

    it("auto-scrolls only for initial or near-bottom updates", () => {
        const nowMs = 1_000_000;
        expect(shouldAutoScrollOnNewMessage({
            hasPreviousLastMessage: false,
            isAwayFromBottom: true,
            isOutgoing: false,
            messageTimestampMs: nowMs - 60_000,
            nowMs,
        })).toBe(true);

        expect(shouldAutoScrollOnNewMessage({
            hasPreviousLastMessage: true,
            isAwayFromBottom: false,
            isOutgoing: false,
            messageTimestampMs: nowMs - 60_000,
            nowMs,
        })).toBe(true);

        expect(shouldAutoScrollOnNewMessage({
            hasPreviousLastMessage: true,
            isAwayFromBottom: true,
            isOutgoing: false,
            messageTimestampMs: nowMs - 1000,
            nowMs,
        })).toBe(false);

        expect(shouldAutoScrollOnNewMessage({
            hasPreviousLastMessage: true,
            isAwayFromBottom: true,
            isOutgoing: true,
            messageTimestampMs: nowMs - 500,
            nowMs,
        })).toBe(true);

        expect(shouldAutoScrollOnNewMessage({
            hasPreviousLastMessage: true,
            isAwayFromBottom: true,
            isOutgoing: true,
            messageTimestampMs: nowMs - 60_000,
            nowMs,
        })).toBe(false);
    });

    it("adjusts for size changes only when near bottom", () => {
        expect(shouldAdjustScrollForSizeChange({
            scrollTop: 700,
            scrollHeight: 1000,
            clientHeight: 250,
        })).toBe(true);

        expect(shouldAdjustScrollForSizeChange({
            scrollTop: 600,
            scrollHeight: 1000,
            clientHeight: 250,
        })).toBe(false);

        expect(MESSAGE_LIST_SIZE_ADJUST_NEAR_BOTTOM_THRESHOLD_PX).toBe(80);
    });

    it("limits auto-bottom writes to follow-bottom mode", () => {
        expect(isMessageListFollowBottomMode("follow_bottom")).toBe(true);
        expect(isMessageListFollowBottomMode("user_reading_history")).toBe(false);
        expect(canMessageListAutoScrollToBottom("follow_bottom")).toBe(true);
        expect(canMessageListAutoScrollToBottom("loading_earlier")).toBe(false);
        expect(canMessageListAutoScrollToBottom("search_jump")).toBe(false);
    });

    it("locks to history mode on trusted upward scroll intent", () => {
        expect(shouldMessageListLockToUserHistoryOnUpwardScroll({
            mode: "follow_bottom",
            deltaY: -12,
            isTrustedUserScroll: true,
        })).toBe(true);
        expect(shouldMessageListLockToUserHistoryOnUpwardScroll({
            mode: "follow_bottom",
            deltaY: 20,
            isTrustedUserScroll: true,
        })).toBe(false);
        expect(shouldMessageListLockToUserHistoryOnUpwardScroll({
            mode: "follow_bottom",
            deltaY: -12,
            isTrustedUserScroll: false,
        })).toBe(false);
        expect(shouldMessageListLockToUserHistoryOnUpwardScroll({
            mode: "user_reading_history",
            deltaY: -12,
            isTrustedUserScroll: true,
        })).toBe(false);
    });
});
