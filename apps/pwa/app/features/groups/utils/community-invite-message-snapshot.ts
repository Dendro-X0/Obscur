import type { InvitePayload } from "./community-invite-payload";
import { normalizeCommunityInvitePayload } from "./community-invite-payload";
import {
    hasMeaningfulCommunityDisplayName,
    resolveCommunityDisplayName,
} from "../services/community-display-name";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { collectCommunityInviteMessageIdentityAliases } from "./community-invite-dm-message";

const STORAGE_KEY_PREFIX = "obscur:community-invite-snapshot:v1";

export const COMMUNITY_INVITE_SNAPSHOT_PINNED_EVENT = "obscur:community-invite-snapshot-pinned";

const notifyInviteSnapshotPinned = (messageId: string): void => {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new CustomEvent(COMMUNITY_INVITE_SNAPSHOT_PINNED_EVENT, {
        detail: { messageId },
    }));
};

export type CommunityInviteMessageSnapshot = Readonly<{
    groupId: string;
    roomKey: string;
    metadataName: string;
    metadataAbout?: string;
    metadataPicture?: string;
    metadataAccess?: string;
    relayUrl?: string;
    communityId?: string;
}>;

const memoryByMessageId = new Map<string, CommunityInviteMessageSnapshot>();

const storageKey = (messageId: string, profileId: string | null): string => (
    `${STORAGE_KEY_PREFIX}:${profileId ?? "default"}:${messageId}`
);

const readSnapshotRecord = (raw: unknown): CommunityInviteMessageSnapshot | null => {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const record = raw as Record<string, unknown>;
    const groupId = typeof record.groupId === "string" ? record.groupId.trim() : "";
    const roomKey = typeof record.roomKey === "string" ? record.roomKey.trim() : "";
    const metadataName = typeof record.metadataName === "string" ? record.metadataName.trim() : "";
    if (!groupId) {
        return null;
    }
    if (!roomKey && !hasMeaningfulCommunityDisplayName(metadataName, { groupId })) {
        return null;
    }
    return {
        groupId,
        roomKey,
        metadataName: metadataName || "Private Group",
        metadataAbout: typeof record.metadataAbout === "string" ? record.metadataAbout : undefined,
        metadataPicture: typeof record.metadataPicture === "string" ? record.metadataPicture : undefined,
        metadataAccess: typeof record.metadataAccess === "string" ? record.metadataAccess : undefined,
        relayUrl: typeof record.relayUrl === "string" ? record.relayUrl : undefined,
        communityId: typeof record.communityId === "string" ? record.communityId : undefined,
    };
};

const snapshotFromInvite = (invite: InvitePayload): CommunityInviteMessageSnapshot | null => {
    const roomKey = invite.roomKey?.trim() ?? "";
    const metadataName = resolveCommunityDisplayName({
        metadataName: invite.metadata.name,
        groupId: invite.groupId,
        communityId: invite.communityId,
    });
    const meaningfulName = hasMeaningfulCommunityDisplayName(metadataName, {
        groupId: invite.groupId,
        communityId: invite.communityId,
    });
    if (!roomKey && !meaningfulName) {
        return null;
    }
    return {
        groupId: invite.groupId,
        roomKey,
        metadataName,
        metadataAbout: invite.metadata.about,
        metadataPicture: invite.metadata.picture,
        metadataAccess: invite.metadata.access,
        relayUrl: invite.relayUrl,
        communityId: invite.communityId,
    };
};

const mergeSnapshots = (
    current: CommunityInviteMessageSnapshot | null,
    incoming: CommunityInviteMessageSnapshot,
): CommunityInviteMessageSnapshot => {
    if (!current) {
        return incoming;
    }
    const roomKey = current.roomKey || incoming.roomKey;
    const metadataName = hasMeaningfulCommunityDisplayName(current.metadataName, { groupId: current.groupId })
        ? current.metadataName
        : incoming.metadataName;
    return {
        groupId: current.groupId || incoming.groupId,
        roomKey,
        metadataName,
        metadataAbout: current.metadataAbout || incoming.metadataAbout,
        metadataPicture: current.metadataPicture || incoming.metadataPicture,
        metadataAccess: current.metadataAccess || incoming.metadataAccess,
        relayUrl: current.relayUrl || incoming.relayUrl,
        communityId: current.communityId || incoming.communityId,
    };
};

export const loadCommunityInviteMessageSnapshot = (
    messageId: string | undefined,
): CommunityInviteMessageSnapshot | null => {
    const trimmedId = messageId?.trim();
    if (!trimmedId) {
        return null;
    }
    const cached = memoryByMessageId.get(trimmedId);
    if (cached) {
        return cached;
    }
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(storageKey(trimmedId, getResolvedProfileId()));
        if (!raw) {
            return null;
        }
        const parsed = readSnapshotRecord(JSON.parse(raw));
        if (parsed) {
            memoryByMessageId.set(trimmedId, parsed);
        }
        return parsed;
    } catch {
        return null;
    }
};

const snapshotsEqual = (
    left: CommunityInviteMessageSnapshot | null,
    right: CommunityInviteMessageSnapshot,
): boolean => {
    if (!left) {
        return false;
    }
    return left.groupId === right.groupId
        && left.roomKey === right.roomKey
        && left.metadataName === right.metadataName
        && left.metadataAbout === right.metadataAbout
        && left.metadataPicture === right.metadataPicture
        && left.metadataAccess === right.metadataAccess
        && left.relayUrl === right.relayUrl
        && left.communityId === right.communityId;
};

export const pinCommunityInviteMessageSnapshot = (
    messageId: string | undefined,
    invite: InvitePayload | null,
): void => {
    const trimmedId = messageId?.trim();
    if (!trimmedId || !invite) {
        return;
    }
    const next = snapshotFromInvite(invite);
    if (!next) {
        return;
    }
    const current = loadCommunityInviteMessageSnapshot(trimmedId);
    const merged = mergeSnapshots(current, next);
    if (snapshotsEqual(current, merged)) {
        return;
    }
    memoryByMessageId.set(trimmedId, merged);
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(
            storageKey(trimmedId, getResolvedProfileId()),
            JSON.stringify(merged),
        );
    } catch {
        // Quota / private mode — memory pin still helps for this session.
    }
    notifyInviteSnapshotPinned(trimmedId);
};

/** Pin the same invite snapshot on every DM identity alias (gift-wrap, rumor, relay ids). */
export const pinCommunityInviteMessageSnapshotForMessage = (
    message: Readonly<{ id?: string; eventId?: string; relayPublishedEventId?: string }> | undefined,
    invite: InvitePayload | null,
): void => {
    if (!message || !invite) {
        return;
    }
    const aliasSource = {
        id: message.id?.trim() || message.eventId?.trim() || "",
        eventId: message.eventId,
        relayPublishedEventId: message.relayPublishedEventId,
    };
    if (!aliasSource.id && !aliasSource.eventId?.trim()) {
        return;
    }
    collectCommunityInviteMessageIdentityAliases(aliasSource).forEach((aliasId) => {
        pinCommunityInviteMessageSnapshot(aliasId, invite);
    });
};

export const applyCommunityInviteMessageSnapshot = (
    messageId: string | undefined,
    invite: InvitePayload | null,
): InvitePayload | null => {
    if (!invite) {
        return null;
    }
    const snapshot = loadCommunityInviteMessageSnapshot(messageId);
    if (!snapshot || snapshot.groupId !== invite.groupId) {
        return invite;
    }
    const merged = normalizeCommunityInvitePayload({
        ...invite,
        roomKey: invite.roomKey?.trim() || snapshot.roomKey,
        metadata: {
            ...invite.metadata,
            name: hasMeaningfulCommunityDisplayName(invite.metadata.name, {
                groupId: invite.groupId,
                communityId: invite.communityId,
            })
                ? invite.metadata.name
                : snapshot.metadataName,
            about: invite.metadata.about || snapshot.metadataAbout,
            picture: invite.metadata.picture || snapshot.metadataPicture,
            access: invite.metadata.access || snapshot.metadataAccess,
        },
        relayUrl: invite.relayUrl || snapshot.relayUrl,
        communityId: invite.communityId || snapshot.communityId,
    });
    return merged ?? invite;
};
