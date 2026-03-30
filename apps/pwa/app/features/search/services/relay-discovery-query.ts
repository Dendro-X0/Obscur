"use client";

import type { NostrFilter } from "@/app/features/relays/types/nostr-filter";
import { INVITE_CODE_PREFIX } from "@/app/features/invites/utils/invite-code-format";
import { GLOBAL_DISCOVERY_RELAY_URLS } from "@/app/features/relays/services/discovery-relay-set";
import { discoveryCache, type DiscoveryProfileRecord } from "./discovery-cache";

type RelayMessageHandler = (params: Readonly<{ url: string; message: string }>) => void;

export type RelayQueryPool = Readonly<{
    broadcastEvent: (payload: string) => Promise<unknown>;
    sendToOpen: (payload: string) => void;
    subscribeToMessages: (handler: RelayMessageHandler) => () => void;
    waitForConnection: (timeoutMs: number) => Promise<boolean>;
    waitForScopedConnection?: (relayUrls: ReadonlyArray<string>, timeoutMs: number) => Promise<boolean>;
    addTransientRelay?: (url: string) => void;
}>;

export type RelayDiscoveryMode = "invite" | "text" | "author";

type QueryRelayProfilesParams = Readonly<{
    pool: RelayQueryPool;
    mode: RelayDiscoveryMode;
    query: string;
    timeoutMs?: number;
    maxResults?: number;
}>;

const QUERY_TIMEOUT_MS = 5_500;
const INVITE_PROFILE_WINDOW_SECONDS = 60 * 60 * 24 * 180;
const TEXT_PROFILE_WINDOW_SECONDS = 60 * 60 * 24 * 120;
const LEGACY_INVITE_CODE_PREFIX = "OBSCUR";
const INVITE_CODE_PREFIXES = Array.from(new Set([INVITE_CODE_PREFIX, LEGACY_INVITE_CODE_PREFIX]));

const normalize = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const toLower = (value: unknown): string => (typeof value === "string" ? value.toLowerCase() : "");

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeInviteCode = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const normalized = value.trim().toUpperCase();
    if (!normalized) return undefined;
    const matched = INVITE_CODE_PREFIXES.some((prefix) => {
        const pattern = new RegExp(`^${escapeRegex(prefix)}-[A-Z0-9]{5,10}$`);
        return pattern.test(normalized);
    });
    return matched ? normalized : undefined;
};

const extractInviteCodeFromAbout = (about?: string): string | undefined => {
    if (!about) return undefined;
    for (const prefix of INVITE_CODE_PREFIXES) {
        const pattern = new RegExp(`\\b${escapeRegex(prefix)}-[A-Z0-9]{5,10}\\b`, "i");
        const matched = about.match(pattern);
        if (matched?.[0]) {
            return matched[0].toUpperCase();
        }
    }
    return undefined;
};

const profileFromEvent = (event: Readonly<{ pubkey: string; content: string; tags?: unknown }>): DiscoveryProfileRecord | null => {
    try {
        const parsed = JSON.parse(event.content) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        const name = normalize(parsed.name);
        const displayName = normalize(parsed.display_name);
        const about = normalize(parsed.about);
        const picture = normalize(parsed.picture) ?? normalize(parsed.avatar);
        const nip05 = normalize(parsed.nip05);
        let inviteCode: string | undefined =
            normalizeInviteCode(parsed.inviteCode)
            ?? normalizeInviteCode(parsed.invite_code)
            ?? normalizeInviteCode(parsed.code);
        if (Array.isArray(event.tags)) {
            for (const tag of event.tags) {
                if (!Array.isArray(tag)) continue;
                if (tag[0] === "i" || tag[0] === "code") {
                    const code = normalizeInviteCode(tag[1]);
                    if (code) {
                        inviteCode = code;
                        break;
                    }
                }
            }
        }
        if (!inviteCode) {
            inviteCode = extractInviteCodeFromAbout(about);
        }
        return {
            pubkey: event.pubkey,
            name,
            displayName,
            about,
            picture,
            nip05,
            inviteCode,
            updatedAtUnixMs: Date.now(),
        };
    } catch {
        return null;
    }
};

const recordMatchesTextQuery = (record: DiscoveryProfileRecord, query: string): boolean => {
    const q = query.toLowerCase();
    if (record.pubkey.toLowerCase().includes(q)) return true;
    if (toLower(record.name).includes(q)) return true;
    if (toLower(record.displayName).includes(q)) return true;
    if (toLower(record.about).includes(q)) return true;
    if (toLower(record.nip05).includes(q)) return true;
    if (toLower(record.inviteCode).includes(q)) return true;
    return false;
};

const recordMatchesInviteQuery = (record: DiscoveryProfileRecord, inviteCode: string): boolean => {
    return (record.inviteCode ?? "").toUpperCase() === inviteCode.toUpperCase()
        || toLower(record.about).includes(inviteCode.toLowerCase())
        || toLower(record.name).includes(inviteCode.toLowerCase())
        || toLower(record.displayName).includes(inviteCode.toLowerCase());
};

const buildFilters = (mode: RelayDiscoveryMode, query: string): ReadonlyArray<NostrFilter> => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (mode === "invite") {
        const inviteCode = query.trim().toUpperCase();
        return [
            { kinds: [0], "#i": [inviteCode], limit: 16 },
            { kinds: [0], "#code": [inviteCode], limit: 16 },
            { kinds: [0], search: inviteCode, limit: 48 },
            { kinds: [0], since: nowSeconds - INVITE_PROFILE_WINDOW_SECONDS, limit: 320 },
        ];
    }
    if (mode === "author") {
        return [
            { kinds: [0], authors: [query], limit: 1 },
        ];
    }
    return [
        { kinds: [0], search: query, limit: 120 },
        { kinds: [0], since: nowSeconds - TEXT_PROFILE_WINDOW_SECONDS, limit: 900 },
    ];
};

const primeInviteLookupRelays = async (pool: RelayQueryPool): Promise<void> => {
    for (const relayUrl of GLOBAL_DISCOVERY_RELAY_URLS) {
        pool.addTransientRelay?.(relayUrl);
    }
    if (typeof pool.waitForScopedConnection === "function") {
        await pool.waitForScopedConnection(GLOBAL_DISCOVERY_RELAY_URLS, 2_500);
        return;
    }
    await pool.waitForConnection(2_500);
};

export const relayDiscoveryQueryInternals = {
    profileFromEvent,
    recordMatchesTextQuery,
    recordMatchesInviteQuery,
    buildFilters,
    primeInviteLookupRelays,
};

export const queryRelayProfiles = async (params: QueryRelayProfilesParams): Promise<ReadonlyArray<DiscoveryProfileRecord>> => {
    const timeoutMs = params.timeoutMs ?? QUERY_TIMEOUT_MS;
    const maxResults = params.maxResults ?? 250;
    const query = params.query.trim();
    if (!query) {
        return [];
    }

    if (params.mode === "invite") {
        await primeInviteLookupRelays(params.pool);
    } else {
        await params.pool.waitForConnection(2_500);
    }

    const subId = `discover-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const filters = buildFilters(params.mode, query);
    const resultsMap = new Map<string, DiscoveryProfileRecord>();

    return new Promise((resolve) => {
        let settled = false;
        let unsubscribe: (() => void) | null = null;

        const finalize = (): void => {
            if (settled) return;
            settled = true;
            try {
                params.pool.sendToOpen(JSON.stringify(["CLOSE", subId]));
            } catch {
                // Ignore cleanup errors.
            }
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
            resolve(Array.from(resultsMap.values()));
        };

        unsubscribe = params.pool.subscribeToMessages(({ message }) => {
            if (settled) return;
            try {
                const parsed = JSON.parse(message);
                if (!Array.isArray(parsed)) return;
                if (parsed[0] !== "EVENT" || parsed[1] !== subId) return;
                const event = parsed[2];
                if (!event || typeof event !== "object" || event.kind !== 0 || typeof event.pubkey !== "string") {
                    return;
                }
                const record = profileFromEvent({
                    pubkey: event.pubkey,
                    content: typeof event.content === "string" ? event.content : "{}",
                    tags: event.tags,
                });
                if (!record) return;

                const matches = params.mode === "invite"
                    ? recordMatchesInviteQuery(record, query)
                    : params.mode === "author"
                        ? record.pubkey === query
                        : recordMatchesTextQuery(record, query);
                if (!matches) return;

                resultsMap.set(record.pubkey, record);
                discoveryCache.upsertProfile(record);
                if ((params.mode === "invite" || params.mode === "author") && resultsMap.size >= 1) {
                    finalize();
                    return;
                }
                if (resultsMap.size >= maxResults) {
                    finalize();
                }
            } catch {
                // Ignore malformed relay messages.
            }
        });

        void params.pool.broadcastEvent(JSON.stringify(["REQ", subId, ...filters]));
        setTimeout(finalize, timeoutMs);
    });
};
