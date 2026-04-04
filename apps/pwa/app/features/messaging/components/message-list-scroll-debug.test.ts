import { describe, expect, it } from "vitest";
import {
    buildMessageListScrollTimeline,
    collectMessageListScrollFollowTransitions,
    collectMessageListScrollReasonTimeline,
    findFirstMessageListNonManualBottomRequest,
    formatMessageListScrollTimeline,
    type MessageListScrollDebugEvent,
} from "./message-list-scroll-debug";

const SAMPLE_EVENTS: ReadonlyArray<MessageListScrollDebugEvent> = [
    {
        atUnixMs: 1_000,
        name: "scroll_debug_api_ready",
        context: {
            followBottom: true,
            userAwayFromBottom: false,
            metrics: { scrollTop: 10.1, scrollHeight: 500.9, clientHeight: 120.4 },
        },
    },
    {
        atUnixMs: 1_020,
        name: "follow_bottom_changed",
        context: {
            followBottom: false,
            userAwayFromBottom: true,
            reasonCode: "user_scrolled_away",
            metrics: { scrollTop: 120, scrollHeight: 520, clientHeight: 120 },
        },
    },
    {
        atUnixMs: 1_060,
        name: "scroll_to_bottom_requested",
        context: {
            followBottom: false,
            userAwayFromBottom: true,
            reasonCode: "new_message",
            behavior: "auto",
            metrics: { scrollTop: 140, scrollHeight: 600, clientHeight: 120 },
        },
    },
    {
        atUnixMs: 1_100,
        name: "follow_bottom_changed",
        context: {
            followBottom: true,
            userAwayFromBottom: false,
            reasonCode: "manual_button",
            metrics: { scrollTop: 480, scrollHeight: 600, clientHeight: 120 },
        },
    },
];

describe("message-list scroll debug timeline utils", () => {
    it("builds a bounded timeline with normalized fields", () => {
        const timeline = buildMessageListScrollTimeline(SAMPLE_EVENTS, 3);
        expect(timeline).toHaveLength(3);
        expect(timeline[0]).toMatchObject({
            name: "follow_bottom_changed",
            offsetMs: 0,
            reasonCode: "user_scrolled_away",
            followBottom: false,
            userAwayFromBottom: true,
            metrics: { scrollTop: 120, scrollHeight: 520, clientHeight: 120 },
        });
        expect(timeline[2]).toMatchObject({
            name: "follow_bottom_changed",
            offsetMs: 80,
            reasonCode: "manual_button",
            behavior: null,
            followBottom: true,
            userAwayFromBottom: false,
        });
    });

    it("collects reason timeline and follow-state transitions", () => {
        const timeline = buildMessageListScrollTimeline(SAMPLE_EVENTS, 10);
        const reasonTimeline = collectMessageListScrollReasonTimeline(timeline);
        const followTransitions = collectMessageListScrollFollowTransitions(timeline);

        expect(reasonTimeline.map((entry) => entry.reasonCode)).toEqual([
            "user_scrolled_away",
            "new_message",
            "manual_button",
        ]);
        expect(followTransitions.map((entry) => entry.followBottom)).toEqual([
            true,
            false,
            true,
        ]);
    });

    it("formats a human-readable timeline output", () => {
        const timeline = buildMessageListScrollTimeline(SAMPLE_EVENTS, 10);
        const text = formatMessageListScrollTimeline(timeline);

        expect(text).toContain("Message-list scroll timeline (4 events)");
        expect(text).toContain("Follow transitions: 3");
        expect(text).toContain("First non-manual bottom request: new_message @ +60ms");
        expect(text).toContain("reason=user_scrolled_away");
        expect(text).toContain("behavior=auto");
        expect(text).toContain("reason=manual_button");
    });

    it("finds the first non-manual auto bottom request", () => {
        const timeline = buildMessageListScrollTimeline(SAMPLE_EVENTS, 10);
        expect(findFirstMessageListNonManualBottomRequest(timeline)).toMatchObject({
            name: "scroll_to_bottom_requested",
            reasonCode: "new_message",
            behavior: "auto",
            offsetMs: 60,
        });
    });

    it("returns a stable empty-state message", () => {
        expect(formatMessageListScrollTimeline([])).toBe("No message-list scroll debug events captured.");
    });
});
