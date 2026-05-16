import { describe, expect, it } from "vitest";

import { isDisplayableDmConversationMessage, isVoiceCallSignalPayload } from "./dm-conversation-displayable-message";
import type { Message } from "../types";

const baseMsg = (overrides: Partial<Message> & Pick<Message, "id">): Message => ({
    kind: "user",
    content: "",
    timestamp: new Date(1),
    isOutgoing: false,
    status: "delivered",
    ...overrides,
});

describe("isVoiceCallSignalPayload", () => {
    it("detects JSON object with voice-call-signal type", () => {
        expect(isVoiceCallSignalPayload(JSON.stringify({ type: "voice-call-signal", x: 1 }))).toBe(true);
    });

    it("detects double-encoded string containing type", () => {
        const inner = JSON.stringify({ type: "voice-call-signal" });
        expect(isVoiceCallSignalPayload(JSON.stringify(inner))).toBe(true);
    });

    it("returns false for normal text", () => {
        expect(isVoiceCallSignalPayload("hello")).toBe(false);
    });
});

describe("isDisplayableDmConversationMessage", () => {
    it("returns false for command kind", () => {
        expect(isDisplayableDmConversationMessage(baseMsg({ id: "1", kind: "command", content: "x" }))).toBe(false);
    });

    it("returns false when content is voice-call signal", () => {
        expect(isDisplayableDmConversationMessage(baseMsg({
            id: "1",
            content: JSON.stringify({ type: "voice-call-signal" }),
        }))).toBe(false);
    });

    it("returns true for plain user message", () => {
        expect(isDisplayableDmConversationMessage(baseMsg({ id: "1", content: "hi" }))).toBe(true);
    });
});
