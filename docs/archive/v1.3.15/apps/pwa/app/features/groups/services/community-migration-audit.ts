import type { PersistedChatState, PersistedGroupConversation } from "@/app/features/messaging/types";
import { toGroupConversationId } from "../utils/group-conversation-id";
import { toGroupTombstoneKey } from "./group-tombstone-store";

export type CommunityMigrationAuditReport = Readonly<{
    ok: boolean;
    duplicateActiveCommunityKeys: ReadonlyArray<string>;
    tombstonedActiveCommunityKeys: ReadonlyArray<string>;
    missingGenesisIdentityKeys: ReadonlyArray<string>;
    orphanConversationIds: ReadonlyArray<string>;
    nonCanonicalKnownConversationIds: ReadonlyArray<string>;
}>;

type ParsedConversationRef = Readonly<{
    groupId: string;
    relayUrl: string;
    canonicalConversationId: string;
}>;

const normalizeRelayUrl = (relayUrl: string | null | undefined): string => {
    const trimmed = (relayUrl ?? "").trim();
    return trimmed.length > 0 ? trimmed : "unknown";
};

const parseGroupConversationRef = (conversationId: string): ParsedConversationRef | null => {
    const trimmed = conversationId.trim();
    if (trimmed.length === 0) return null;

    if (trimmed.startsWith("community:") || trimmed.startsWith("group:")) {
        const raw = trimmed.startsWith("community:")
            ? trimmed.slice("community:".length)
            : trimmed.slice("group:".length);
        const splitIndex = raw.indexOf(":");
        if (splitIndex <= 0) return null;
        const groupId = raw.slice(0, splitIndex).trim();
        const relayUrl = normalizeRelayUrl(raw.slice(splitIndex + 1));
        if (!groupId) return null;
        return {
            groupId,
            relayUrl,
            canonicalConversationId: toGroupConversationId({ groupId, relayUrl })
        };
    }

    if (trimmed.includes("@")) {
        const [rawGroupId, ...relayParts] = trimmed.split("@");
        const groupId = rawGroupId.trim();
        const relayHost = relayParts.join("@").trim();
        if (!groupId || !relayHost) return null;
        const relayUrl = normalizeRelayUrl(relayHost.startsWith("ws://") || relayHost.startsWith("wss://")
            ? relayHost
            : `wss://${relayHost}`);
        return {
            groupId,
            relayUrl,
            canonicalConversationId: toGroupConversationId({ groupId, relayUrl })
        };
    }

    return null;
};

const parseCommunityConversationId = (conversationId: string): string | null => {
    const trimmed = conversationId.trim();
    if (!trimmed.startsWith("community:")) return null;
    const raw = trimmed.slice("community:".length).trim();
    if (raw.length === 0) return null;
    return trimmed;
};

const collectConversationIds = (state: PersistedChatState): ReadonlySet<string> => {
    const ids = new Set<string>();
    Object.keys(state.unreadByConversationId).forEach((id) => ids.add(id));
    Object.keys(state.messagesByConversationId).forEach((id) => ids.add(id));
    Object.keys(state.groupMessages ?? {}).forEach((id) => ids.add(id));
    (state.pinnedChatIds ?? []).forEach((id) => ids.add(id));
    (state.hiddenChatIds ?? []).forEach((id) => ids.add(id));
    return ids;
};

const groupKey = (group: PersistedGroupConversation): string => {
    return toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl });
};

export const auditCommunityMigrationState = (params: Readonly<{
    state: PersistedChatState;
    tombstones?: ReadonlySet<string>;
}>): CommunityMigrationAuditReport => {
    const tombstones = params.tombstones ?? new Set<string>();

    const keyCounts = new Map<string, number>();
    params.state.createdGroups.forEach((group) => {
        const key = groupKey(group);
        keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    });

    const duplicateActiveCommunityKeys = Array.from(keyCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
        .sort();

    const tombstonedActiveCommunityKeys = params.state.createdGroups
        .map(groupKey)
        .filter((key) => tombstones.has(key))
        .filter((key, index, all) => all.indexOf(key) === index)
        .sort();

    const missingGenesisIdentityKeys = params.state.createdGroups
        .filter((group) => !(group.genesisEventId && group.creatorPubkey))
        .map(groupKey)
        .filter((key, index, all) => all.indexOf(key) === index)
        .sort();

    const canonicalCreatedGroupIds = new Set<string>(params.state.createdGroups.map((group) => group.id));
    const canonicalIdByGroupRelay = new Map<string, string>();
    params.state.createdGroups.forEach((group) => {
        canonicalIdByGroupRelay.set(
            toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl }),
            group.id
        );
    });

    const orphanConversationIds: string[] = [];
    const nonCanonicalKnownConversationIds: string[] = [];

    collectConversationIds(params.state).forEach((conversationId) => {
        const canonicalCommunityConversationId = parseCommunityConversationId(conversationId);
        if (canonicalCommunityConversationId) {
            if (!canonicalCreatedGroupIds.has(canonicalCommunityConversationId)) {
                orphanConversationIds.push(conversationId);
            }
            return;
        }

        const parsed = parseGroupConversationRef(conversationId);
        if (!parsed) return;

        const mappedCanonicalId = canonicalIdByGroupRelay.get(
            toGroupTombstoneKey({ groupId: parsed.groupId, relayUrl: parsed.relayUrl })
        );
        if (!mappedCanonicalId) {
            orphanConversationIds.push(conversationId);
            return;
        }

        if (conversationId !== mappedCanonicalId) {
            nonCanonicalKnownConversationIds.push(conversationId);
        }
    });

    orphanConversationIds.sort();
    nonCanonicalKnownConversationIds.sort();

    const ok =
        duplicateActiveCommunityKeys.length === 0 &&
        tombstonedActiveCommunityKeys.length === 0 &&
        missingGenesisIdentityKeys.length === 0 &&
        orphanConversationIds.length === 0 &&
        nonCanonicalKnownConversationIds.length === 0;

    return {
        ok,
        duplicateActiveCommunityKeys,
        tombstonedActiveCommunityKeys,
        missingGenesisIdentityKeys,
        orphanConversationIds,
        nonCanonicalKnownConversationIds
    };
};
