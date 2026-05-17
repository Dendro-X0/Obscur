
import type { DeleteCommandMessage, MessageKind } from "../types";

const COMMAND_MESSAGE_PREFIX: string = "__dweb_cmd__";

export const isMessageKind = (value: unknown): value is MessageKind => value === "user" || value === "command";

export const createDeleteCommandMessage = (targetMessageId: string): DeleteCommandMessage => ({ type: "delete", targetMessageId });

export const encodeCommandMessage = (payload: DeleteCommandMessage): string => `${COMMAND_MESSAGE_PREFIX}${JSON.stringify(payload)}`;

export const parseCommandMessage = (content: string): DeleteCommandMessage | null => {
    if (!content.startsWith(COMMAND_MESSAGE_PREFIX)) {
        return null;
    }
    const raw: string = content.slice(COMMAND_MESSAGE_PREFIX.length);
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const type: unknown = (parsed as any).type;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetMessageId: unknown = (parsed as any).targetMessageId;
        if (type !== "delete" || typeof targetMessageId !== "string") {
            return null;
        }
        return { type, targetMessageId };
    } catch {
        return null;
    }
};
