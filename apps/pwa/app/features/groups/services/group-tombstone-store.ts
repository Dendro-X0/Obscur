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

const toStorageKey = (publicKeyHex: string): string => `${TOMBSTONE_STORAGE_PREFIX}.${publicKeyHex}`;

const readTombstones = (publicKeyHex: string): Set<string> => {
    if (typeof window === "undefined") return new Set<string>();
    try {
        const raw = localStorage.getItem(toStorageKey(publicKeyHex));
        if (!raw) return new Set<string>();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set<string>();
        return new Set(parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0));
    } catch {
        return new Set<string>();
    }
};

const writeTombstones = (publicKeyHex: string, tombstones: ReadonlySet<string>): void => {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(toStorageKey(publicKeyHex), JSON.stringify(Array.from(tombstones)));
    } catch {
        return;
    }
};

export const loadGroupTombstones = (publicKeyHex: string): ReadonlySet<string> => {
    return readTombstones(publicKeyHex);
};

export const isGroupTombstoned = (
    publicKeyHex: string,
    params: Readonly<{ groupId: string; relayUrl?: string }>
): boolean => {
    return readTombstones(publicKeyHex).has(toGroupTombstoneKey(params));
};

export const addGroupTombstone = (
    publicKeyHex: string,
    params: Readonly<{ groupId: string; relayUrl?: string }>
): void => {
    const next = readTombstones(publicKeyHex);
    next.add(toGroupTombstoneKey(params));
    writeTombstones(publicKeyHex, next);
};

export const removeGroupTombstone = (
    publicKeyHex: string,
    params: Readonly<{ groupId: string; relayUrl?: string }>
): void => {
    const next = readTombstones(publicKeyHex);
    next.delete(toGroupTombstoneKey(params));
    writeTombstones(publicKeyHex, next);
};

export const addGroupTombstoneFromConversationId = (
    publicKeyHex: string,
    conversationId: string
): void => {
    const parsed = parseConversationId(conversationId);
    if (!parsed) return;
    addGroupTombstone(publicKeyHex, parsed);
};
