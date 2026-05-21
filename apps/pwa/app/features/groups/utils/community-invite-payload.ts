export type InvitePayload = Readonly<{
    type: "community-invite";
    groupId: string;
    roomKey: string;
    communityId?: string;
    genesisEventId?: string;
    creatorPubkey?: string;
    metadata: {
        id: string;
        name: string;
        about?: string;
        picture?: string;
        access?: string;
        memberCount?: number;
    };
    relayUrl?: string;
}>;

const readString = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const readAccess = (value: unknown): string | undefined => {
    const access = readString(value);
    if (access === "discoverable" || access === "invite-only" || access === "private" || access === "open") {
        return access;
    }
    return undefined;
};

/**
 * Normalizes community-invite JSON (flat or nested metadata) for cards and accept flows.
 */
export const normalizeCommunityInvitePayload = (raw: unknown): InvitePayload | null => {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const record = raw as Record<string, unknown>;
    if (record.type !== "community-invite") {
        return null;
    }
    const groupId = readString(record.groupId);
    if (!groupId) {
        return null;
    }
    const metadataRaw = (
        record.metadata && typeof record.metadata === "object"
            ? record.metadata as Record<string, unknown>
            : {}
    );
    const roomKey = readString(record.roomKey)
        ?? readString(record.roomKeyHex)
        ?? readString(metadataRaw.roomKey)
        ?? readString(metadataRaw.roomKeyHex)
        ?? "";
    const metadataId = readString(metadataRaw.id) ?? groupId;
    const memberCountRaw = metadataRaw.memberCount ?? record.memberCount;
    const memberCount = typeof memberCountRaw === "number" && Number.isFinite(memberCountRaw)
        ? memberCountRaw
        : undefined;

    return {
        type: "community-invite",
        groupId,
        roomKey,
        communityId: readString(record.communityId),
        genesisEventId: readString(record.genesisEventId),
        creatorPubkey: readString(record.creatorPubkey),
        relayUrl: readString(record.relayUrl),
        metadata: {
            id: metadataId,
            name: readString(metadataRaw.name) ?? readString(record.name) ?? "Private Group",
            about: readString(metadataRaw.about) ?? readString(record.about),
            picture: readString(metadataRaw.picture) ?? readString(record.picture),
            access: readAccess(metadataRaw.access) ?? readAccess(record.access),
            memberCount,
        },
    };
};
