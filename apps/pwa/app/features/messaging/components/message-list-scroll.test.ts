import { describe, expect, it } from "vitest";
import {
    isMessageListAwayFromBottom,
    isMessageListFastScroll,
    MESSAGE_LIST_SCROLL_BOTTOM_BUTTON_THRESHOLD_PX,
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
});

