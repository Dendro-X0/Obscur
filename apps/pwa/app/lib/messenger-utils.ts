import type { Message, DeleteCommandMessage, ReactionEmoji, ReactionsByEmoji } from "./messenger-types";

export const COMMAND_MESSAGE_PREFIX: string = "__dweb_cmd__";

export const isString = (value: unknown): value is string => typeof value === "string";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const parseCommandMessage = (content: string): DeleteCommandMessage | null => {
    if (!content.startsWith(COMMAND_MESSAGE_PREFIX)) {
        return null;
    }
    const raw: string = content.slice(COMMAND_MESSAGE_PREFIX.length);
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return null;
        }
        const type: unknown = parsed.type;
        const targetMessageId: unknown = parsed.targetMessageId;
        if (type !== "delete" || !isString(targetMessageId)) {
            return null;
        }
        return { type: "delete", targetMessageId };
    } catch {
        return null;
    }
};

export const isVisibleUserMessage = (message: Message): boolean => message.kind === "user";

export const createEmptyReactions = (): Record<ReactionEmoji, number> => ({
    "👍": 0,
    "❤️": 0,
    "😂": 0,
    "🔥": 0,
    "👏": 0,
});

export const toReactionsByEmoji = (value: Record<ReactionEmoji, number>): ReactionsByEmoji => ({
    "👍": value["👍"],
    "❤️": value["❤️"],
    "😂": value["😂"],
    "🔥": value["🔥"],
    "👏": value["👏"],
});

export const formatTime = (date: Date, currentNowMs: number | null): string => {
    if (currentNowMs === null) {
        return "";
    }
    const ONE_MINUTE_MS = 60_000;
    const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
    const ONE_DAY_MS = 24 * ONE_HOUR_MS;

    const diff: number = currentNowMs - date.getTime();
    if (diff < ONE_HOUR_MS) {
        return `${Math.max(0, Math.floor(diff / ONE_MINUTE_MS))}m ago`;
    }
    if (diff < ONE_DAY_MS) {
        return `${Math.floor(diff / ONE_HOUR_MS)}h ago`;
    }
    return `${Math.floor(diff / ONE_DAY_MS)}d ago`;
};
