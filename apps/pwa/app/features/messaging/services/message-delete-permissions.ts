import type { Message } from "../types";

export const canDeleteMessageForMe = (_message: Message): boolean => {
    return true;
};

export const canDeleteMessageForEveryone = (message: Message): boolean => {
    return message.isOutgoing && message.id.trim().length > 0;
};

export const getDeleteForEveryoneRejectionReason = (message: Message): "not_outgoing_message" | "missing_message_id" | null => {
    if (!message.isOutgoing) {
        return "not_outgoing_message";
    }
    if (message.id.trim().length === 0) {
        return "missing_message_id";
    }
    return null;
};
