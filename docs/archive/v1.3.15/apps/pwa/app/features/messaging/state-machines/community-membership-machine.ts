import type { GroupMembershipStatus } from "../../groups/types";

/**
 * Community connection state (Nip29GroupState.status)
 */
export type CommunityConnectionStatus = "idle" | "loading" | "ready" | "error";

/**
 * Community membership events
 */
export type CommunityMembershipEvent =
    | { type: "START_LOAD" }
    | { type: "LOAD_SUCCESS" }
    | { type: "LOAD_FAILURE"; error: string }
    | { type: "JOIN_SUCCESS" }
    | { type: "LEAVE" }
    | { type: "EXPELLED" }
    | { type: "RETRY_CONNECT" };

/**
 * Pure state machine for community connection status.
 */
export const transitionCommunityConnection = (
    currentStatus: CommunityConnectionStatus,
    event: CommunityMembershipEvent
): CommunityConnectionStatus => {
    switch (currentStatus) {
        case "idle":
            if (event.type === "START_LOAD") return "loading";
            break;

        case "loading":
            if (event.type === "LOAD_SUCCESS") return "ready";
            if (event.type === "LOAD_FAILURE") return "error";
            break;

        case "ready":
            if (event.type === "LOAD_FAILURE") return "error";
            break;

        case "error":
            if (event.type === "RETRY_CONNECT") return "loading";
            break;
    }

    return currentStatus;
};

/**
 * Pure state machine for community membership status.
 */
export const transitionMembershipStatus = (
    currentStatus: GroupMembershipStatus,
    event: CommunityMembershipEvent
): GroupMembershipStatus => {
    switch (currentStatus) {
        case "unknown":
        case "none":
        case "not_member":
            if (event.type === "JOIN_SUCCESS") return "member";
            break;

        case "member":
            if (event.type === "LEAVE") return "not_member";
            if (event.type === "EXPELLED") return "not_member";
            break;
    }

    return currentStatus;
};
