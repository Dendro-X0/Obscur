import { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { validateRelayUrl } from "./validate-relay-url";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";

export interface RelayHint {
    url: string;
    read: boolean;
    write: boolean;
}

export interface UserRelayList {
    pubkey: PublicKeyHex;
    relays: RelayHint[];
    receivedAt: number;
}

export type Nip65IngestResult =
    | Readonly<{ status: "accepted"; list: UserRelayList }>
    | Readonly<{ status: "ignored_invalid_signature" }>
    | Readonly<{ status: "ignored_invalid_event" }>
    | Readonly<{ status: "ignored_no_trusted_relays" }>;

const NIP65_CACHE_KEY = "obscur.nip65.cache";
const getNip65CacheKey = (): string => getScopedStorageKey(NIP65_CACHE_KEY);
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const toTrustedRelayUrl = (candidate: string): string | null => {
    const validated = validateRelayUrl(candidate);
    return validated?.normalizedUrl ?? null;
};

type ParsedRelayHintCandidate = Readonly<{
    url: string | null;
    read: boolean;
    write: boolean;
}>;

const isRelayTag = (tag: ReadonlyArray<string>): boolean => tag[0] === "r";

const toRelayHint = (tag: ReadonlyArray<string>): ParsedRelayHintCandidate => {
    const url = toTrustedRelayUrl(tag[1] ?? "");
    const type = tag[2];
    return {
        url,
        read: !type || type === "read",
        write: !type || type === "write"
    };
};

const hasTrustedRelayUrl = (relay: ParsedRelayHintCandidate): relay is RelayHint => {
    return typeof relay.url === "string" && relay.url.length > 0;
};

/**
 * Service to manage NIP-65 (Kind 10002) relay lists for contacts
 */
export class Nip65Service {
    private cache: Map<string, UserRelayList> = new Map();

    constructor() {
        this.loadCache();
    }

    private loadCache() {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem(getNip65CacheKey()) ?? localStorage.getItem(NIP65_CACHE_KEY);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                Object.entries(data).forEach(([pubkey, list]: [string, any]) => {
                    if (Date.now() - list.receivedAt < CACHE_TTL) {
                        this.cache.set(pubkey, list);
                    }
                });
            } catch (e) {
                console.error("Failed to load NIP-65 cache", e);
            }
        }
    }

    private saveCache() {
        if (typeof window === "undefined") return;
        const data: Record<string, UserRelayList> = {};
        this.cache.forEach((list, pubkey) => {
            data[pubkey] = list;
        });
        localStorage.setItem(getNip65CacheKey(), JSON.stringify(data));
    }

    /**
     * Get cached relay list for a pubkey
     */
    getRelayList(pubkey: PublicKeyHex): UserRelayList | undefined {
        return this.cache.get(pubkey);
    }

    /**
     * Parse a Kind 10002 event and update cache
     */
    async updateFromEvent(event: unknown): Promise<UserRelayList | null> {
        const result = await this.ingestVerifiedEvent(event);
        return result.status === "accepted" ? result.list : null;
    }

    async ingestVerifiedEvent(event: unknown): Promise<Nip65IngestResult> {
        const parsed = this.parseCandidateEvent(event);
        if (!parsed) {
            return { status: "ignored_invalid_event" };
        }

        const isValidSignature = await cryptoService.verifyEventSignature(parsed);
        if (!isValidSignature) {
            return { status: "ignored_invalid_signature" };
        }

        return this.ingestTrustedEvent(parsed);
    }

    private parseCandidateEvent(event: unknown): NostrEvent | null {
        if (!event || typeof event !== "object") {
            return null;
        }

        const candidate = event as Record<string, unknown>;
        if (candidate.kind !== 10002) {
            return null;
        }

        const pubkey = typeof candidate.pubkey === "string" ? normalizePublicKeyHex(candidate.pubkey) : null;
        if (!pubkey) {
            return null;
        }

        if (!Array.isArray(candidate.tags) || typeof candidate.id !== "string" || typeof candidate.sig !== "string") {
            return null;
        }

        return {
            ...(candidate as NostrEvent),
            pubkey,
        };
    }

    private ingestTrustedEvent(event: NostrEvent): Nip65IngestResult {
        const relays: RelayHint[] = event.tags
            .filter(isRelayTag)
            .map(toRelayHint)
            .filter(hasTrustedRelayUrl);

        if (relays.length === 0) {
            return { status: "ignored_no_trusted_relays" };
        }

        const list: UserRelayList = {
            pubkey: event.pubkey as PublicKeyHex,
            relays,
            receivedAt: Date.now()
        };

        this.cache.set(event.pubkey, list);
        this.saveCache();
        return { status: "accepted", list };
    }

    /**
     * Get "write" relays for a pubkey (where we should send messages TO them)
     */
    getWriteRelays(pubkey: PublicKeyHex): string[] {
        const list = this.getRelayList(pubkey);
        if (!list) return [];
        return list.relays.filter(r => r.write).map(r => r.url);
    }
}

export const nip65Service = new Nip65Service();
