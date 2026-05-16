import {
    getDefaultProfileId,
    getScopedStorageKey,
} from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

const TOMBSTONE_STORAGE_PREFIX = "obscur.group.tombstones.v1";

const normalizeRelayForKey = (relayUrl: string | null | undefined): string => {
    const trimmed = (relayUrl ?? "").trim();
    return trimmed.length > 0 ? trimmed : "unknown";
};

export const toGroupTombstoneKey = (params: Readonly<{ groupId: string; relayUrl?: string }>): string => {
    return `${params.groupId.trim()}@@${normalizeRelayForKey(params.relayUrl)}`;
};

const parseConversationId = (conversationId: string): Readonly<{ groupId: string; relayUrl: string }> | null => {
    const trimmed = conversationId.trim();
    if (trimmed.startsWith("community:") || trimmed.startsWith("group:")) {
        const raw = trimmed.startsWith("community:")
            ? trimmed.slice("community:".length)
            : trimmed.slice("group:".length);
        const separatorIndex = raw.indexOf(":");
        if (separatorIndex <= 0) return null;
        const groupId = raw.slice(0, separatorIndex).trim();
        const relayUrl = raw.slice(separatorIndex + 1).trim();
        if (!groupId) return null;
        return { groupId, relayUrl: normalizeRelayForKey(relayUrl) };
    }

    if (trimmed.includes("@")) {
        const [rawGroupId, ...relayParts] = trimmed.split("@");
        const groupId = rawGroupId.trim();
        const relayHost = relayParts.join("@").trim();
        if (!groupId || !relayHost) return null;
        const relayUrl = relayHost.startsWith("ws://") || relayHost.startsWith("wss://")
            ? relayHost
            : `wss://${relayHost}`;
        return { groupId, relayUrl: normalizeRelayForKey(relayUrl) };
    }

    return null;
};

const toLegacyStorageKey = (publicKeyHex: string): string => `${TOMBSTONE_STORAGE_PREFIX}.${publicKeyHex}`;
const toStorageKey = (publicKeyHex: string, profileId?: string): string => getScopedStorageKey(
    toLegacyStorageKey(publicKeyHex),
    profileId ?? getResolvedProfileId(),
);

const readTombstones = (
    publicKeyHex: string,
    options?: Readonly<{ profileId?: string }>
): Set<string> => {
    if (typeof window === "undefined") return new Set<string>();
    const profileId = options?.profileId ?? getResolvedProfileId();
    try {
        const raw = localStorage.getItem(toStorageKey(publicKeyHex, profileId)) ?? (
            profileId === getDefaultProfileId()
                ? localStorage.getItem(toLegacyStorageKey(publicKeyHex))
                : null
        );
        if (!raw) return new Set<string>();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set<string>();
        return new Set(parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0));
    } catch {
        return new Set<string>();
    }
};

const writeTombstones = (
    publicKeyHex: string,
    tombstones: ReadonlySet<string>,
    options?: Readonly<{ profileId?: string }>
): void => {
    if (typeof window === "undefined") return;
    const profileId = options?.profileId ?? getResolvedProfileId();
    try {
        localStorage.setItem(toStorageKey(publicKeyHex, profileId), JSON.stringify(Array.from(tombstones)));
    } catch {
        return;
    }
};

export const loadGroupTombstones = (
    publicKeyHex: string,
    options?: Readonly<{ profileId?: string }>
): ReadonlySet<string> => {
    return readTombstones(publicKeyHex, options);
};

export const isGroupTombstoned = (
    publicKeyHex: string,
    params: Readonly<{ groupId: string; relayUrl?: string }>,
    options?: Readonly<{ profileId?: string }>
): boolean => {
    return readTombstones(publicKeyHex, options).has(toGroupTombstoneKey(params));
};

export const addGroupTombstone = (
    publicKeyHex: string,
    params: Readonly<{ groupId: string; relayUrl?: string }>,
    options?: Readonly<{ profileId?: string }>
): void => {
    const next = readTombstones(publicKeyHex, options);
    next.add(toGroupTombstoneKey(params));
    writeTombstones(publicKeyHex, next, options);
};

export const removeGroupTombstone = (
    publicKeyHex: string,
    params: Readonly<{ groupId: string; relayUrl?: string }>,
    options?: Readonly<{ profileId?: string }>
): void => {
    const next = readTombstones(publicKeyHex, options);
    next.delete(toGroupTombstoneKey(params));
    writeTombstones(publicKeyHex, next, options);
};

export const addGroupTombstoneFromConversationId = (
    publicKeyHex: string,
    conversationId: string,
    options?: Readonly<{ profileId?: string }>
): void => {
    const parsed = parseConversationId(conversationId);
    if (!parsed) return;
    addGroupTombstone(publicKeyHex, parsed, options);
};
