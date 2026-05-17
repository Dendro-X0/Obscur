import type { MessageStatus } from "../lib/message-queue";

/**
 * Message delivery events
 */
export type MessageDeliveryEvent = 
    | { type: "START_SEND" }
    | { type: "RELAY_ACCEPTED"; successCount: number; totalRelays: number }
    | { type: "RELAY_REJECTED"; error?: string }
    | { type: "RETRY_QUEUED"; retryCount: number; nextRetryAt: Date }
    | { type: "DELIVERY_CONFIRMED" }
    | { type: "PERMANENT_FAIL"; error: string };

/**
 * Pure state machine for message delivery transitions.
 * Requirement 3.1: (currentState, event) -> nextState
 * No React dependencies, portable to Rust.
 */
export const transitionMessageStatus = (
    currentStatus: MessageStatus,
    event: MessageDeliveryEvent
): MessageStatus => {
    switch (currentStatus) {
        case "queued":
            if (event.type === "START_SEND") return "sending";
            break;

        case "sending":
            if (event.type === "RELAY_ACCEPTED") return "accepted";
            if (event.type === "RELAY_REJECTED") return "rejected";
            if (event.type === "PERMANENT_FAIL") return "failed";
            break;

        case "rejected":
            if (event.type === "RETRY_QUEUED") return "queued";
            if (event.type === "PERMANENT_FAIL") return "failed";
            // Allow re-sending directly from rejected if needed
            if (event.type === "START_SEND") return "sending";
            break;

        case "accepted":
            if (event.type === "DELIVERY_CONFIRMED") return "delivered";
            // In some cases, confirmed accepted might need to go back to sending 
            // if we are re-broadcasting to more relays, but usually terminal in this flow.
            break;

        case "failed":
            // Can restart from failed if user manually retries
            if (event.type === "START_SEND") return "sending";
            break;

        case "delivered":
            // Terminal state
            break;
    }

    // Default: return current if no valid transition
    return currentStatus;
};

/**
 * Check if a transition is valid (useful for UI/pre-flight checks)
 */
export const isValidMessageTransition = (
    currentStatus: MessageStatus,
    eventType: MessageDeliveryEvent["type"]
): boolean => {
    const nextStatus = transitionMessageStatus(currentStatus, { type: eventType } as any);
    return nextStatus !== currentStatus;
};
