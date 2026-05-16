import type { ProfileBusPublicKeyHex } from "@dweb/core/profile-message-bus";
import { getProfileRuntimeScope } from "./profile-runtime-scope";

export type GroupInviteResponseAcceptedDetail = Readonly<{
    groupId: string;
    memberPubkey: string;
    relayUrl?: string;
    communityId?: string;
    recipientPublicKeyHex?: ProfileBusPublicKeyHex;
}>;

export const GROUP_INVITE_RESPONSE_ACCEPTED_EVENT = "obscur:group-invite-response-accepted" as const;

/** Legacy window event when a new group row should be added from invite materialization */
export const GROUP_INVITE_EVENT = "obscur:group-invite" as const;

/** Legacy window event when sealed / home flow confirms membership roster */
export const GROUP_MEMBERSHIP_CONFIRMED_EVENT = "obscur:group-membership-confirmed" as const;

/** Legacy window event for removing a group conversation from local UI state */
export const GROUP_REMOVE_EVENT = "obscur:group-remove" as const;

/** Live membership snapshot for directory / provider (from sealed-community) */
export const GROUP_MEMBERSHIP_SNAPSHOT_EVENT = "obscur:group-membership-snapshot" as const;

/** Broader participant directory evidence (from sealed-community) */
export const COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT = "obscur:community-known-participants-observed" as const;

export type GroupMembershipSnapshotDispatchDetail = Readonly<{
    groupId: string;
    relayUrl: string;
    communityId?: string;
    activeMemberPubkeys: ReadonlyArray<string>;
    leftMembers: ReadonlyArray<string>;
    expelledMembers: ReadonlyArray<string>;
    disbandedAt: number | null;
}>;

export type CommunityKnownParticipantsObservedDispatchDetail = Readonly<{
    groupId: string;
    relayUrl: string;
    communityId?: string;
    conversationId: string;
    participantPubkeys: ReadonlyArray<string>;
}>;

export type GroupMembershipConfirmedDispatchDetail = Readonly<{
    groupId?: string;
    relayUrl?: string;
    communityId?: string;
    displayName?: string;
    avatar?: string;
    access?: string;
    memberCount?: number;
    memberPubkeys?: ReadonlyArray<string>;
    adminPubkeys?: ReadonlyArray<string>;
    lastMessage?: string;
    lastMessageTimeUnixMs?: number;
    publicKeyHex?: string;
}>;

/** v1.5 Phase 1: group invite materialization — profile bus only. */
export function dispatchGroupInviteReceived(invite: unknown): void {
    if (invite == null || typeof invite !== "object") {
        return;
    }
    const scope = getProfileRuntimeScope();
    if (scope?.bus) {
        scope.bus.publish({
            type: "group-invite-received",
            invite,
        });
    }
}

export function dispatchGroupMembershipConfirmed(detail: GroupMembershipConfirmedDispatchDetail): void {
    const scope = getProfileRuntimeScope();
    if (scope?.bus) {
        scope.bus.publish({
            type: "group-membership-confirmed",
            detail,
        });
    }
}

export function dispatchGroupMembershipSnapshot(detail: GroupMembershipSnapshotDispatchDetail): void {
    const scope = getProfileRuntimeScope();
    if (scope?.bus) {
        scope.bus.publish({
            type: "group-membership-snapshot",
            detail,
        });
    }
}

export function dispatchCommunityKnownParticipantsObserved(
    detail: CommunityKnownParticipantsObservedDispatchDetail,
): void {
    const scope = getProfileRuntimeScope();
    if (scope?.bus) {
        scope.bus.publish({
            type: "community-known-participants-observed",
            detail,
        });
    }
}

export function dispatchGroupRemove(conversationId: string): void {
    const scope = getProfileRuntimeScope();
    const trimmed = conversationId.trim();
    if (!trimmed) {
        return;
    }
    if (scope?.bus) {
        scope.bus.publish({
            type: "group-removed",
            conversationId: trimmed,
        });
    }
}

export function dispatchGroupInviteResponseAccepted(detail: GroupInviteResponseAcceptedDetail): void {
    const scope = getProfileRuntimeScope();
    if (scope?.bus) {
        scope.bus.publish({
            type: "group-invite-accepted",
            groupId: detail.groupId,
            memberPubkey: detail.memberPubkey,
            relayUrl: detail.relayUrl,
            communityId: detail.communityId,
            recipientPublicKeyHex: detail.recipientPublicKeyHex,
        });
    }
}
