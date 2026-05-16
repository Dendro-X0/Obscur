import type { Message } from "../types";

/**
 * Detects embedded voice-call signaling payloads (may be JSON-wrapped strings).
 * Used so call-control rows never appear as normal chat lines.
 */
export const isVoiceCallSignalPayload = (content: string): boolean => {
    let candidate: unknown = content;
    for (let depth = 0; depth < 3; depth += 1) {
        if (typeof candidate === "string") {
            const trimmed = candidate.trim();
            if (!trimmed) {
                return false;
            }
            try {
                candidate = JSON.parse(trimmed);
            } catch {
                candidate = trimmed;
                break;
            }
            continue;
        }
        if (candidate && typeof candidate === "object") {
            return (candidate as { type?: unknown }).type === "voice-call-signal";
        }
        return false;
    }
    if (candidate && typeof candidate === "object") {
        return (candidate as { type?: unknown }).type === "voice-call-signal";
    }
    const trimmed = content.trim();
    if (!trimmed) {
        return false;
    }
    return (
        /"type"\s*:\s*"voice-call-signal"/.test(trimmed)
        || /\\"type\\"\s*:\s*\\"voice-call-signal\\"/.test(trimmed)
    );
};

/** DM thread list: hide commands and voice-call signal payloads. */
export const isDisplayableDmConversationMessage = (message: Message): boolean => (
    message.kind !== "command"
    && !isVoiceCallSignalPayload(message.content)
);
