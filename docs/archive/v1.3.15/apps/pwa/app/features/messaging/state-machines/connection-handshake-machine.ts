import type { ConnectionRequestStatusValue } from "../types";

/**
 * Handshake events
 */
export type HandshakeEvent =
    | { type: "SEND_REQUEST" }
    | { type: "RECEIVE_REQUEST" }
    | { type: "ACCEPT" }
    | { type: "DECLINE" }
    | { type: "CANCEL" }
    | { type: "RESET" };

/**
 * State for connection handshake machine
 */
export type HandshakeState = {
    status: ConnectionRequestStatusValue | "none";
    isOutgoing: boolean;
};

/**
 * Pure state machine for connection handshakes.
 * Portability requirement 3.2.
 */
export const transitionHandshake = (
    currentState: HandshakeState,
    event: HandshakeEvent
): HandshakeState => {
    const { status, isOutgoing } = currentState;

    switch (status) {
        case "none":
            if (event.type === "SEND_REQUEST") return { status: "pending", isOutgoing: true };
            if (event.type === "RECEIVE_REQUEST") return { status: "pending", isOutgoing: false };
            break;

        case "pending":
            if (event.type === "ACCEPT") return { status: "accepted", isOutgoing };
            if (event.type === "DECLINE") return { status: "declined", isOutgoing };
            if (event.type === "CANCEL") return { status: "canceled", isOutgoing };
            break;

        case "accepted":
            // Usually terminal, but allow reset for manual override/cleanup
            if (event.type === "RESET") return { status: "none", isOutgoing: false };
            break;

        case "declined":
        case "canceled":
            // Allow retry/re-receive
            if (event.type === "SEND_REQUEST") return { status: "pending", isOutgoing: true };
            if (event.type === "RECEIVE_REQUEST") return { status: "pending", isOutgoing: false };
            if (event.type === "RESET") return { status: "none", isOutgoing: false };
            break;
    }

    // Default: return current state
    return currentState;
};

/**
 * Logic to determine if a message should be treated as a connection request
 * based on current handshake state.
 */
export const shouldProcessAsNewRequest = (
    currentStatus: ConnectionRequestStatusValue | "none" | undefined
): boolean => {
    return !currentStatus || currentStatus === "none" || currentStatus === "declined" || currentStatus === "canceled";
};
