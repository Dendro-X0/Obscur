import { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { cryptoService } from "@/app/features/crypto/crypto-service";

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

const NIP65_CACHE_KEY = "obscur.nip65.cache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
        const stored = localStorage.getItem(NIP65_CACHE_KEY);
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
        localStorage.setItem(NIP65_CACHE_KEY, JSON.stringify(data));
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
    updateFromEvent(event: any): UserRelayList | null {
        if (event.kind !== 10002) return null;

        const relays: RelayHint[] = event.tags
            .filter((t: string[]) => t[0] === "r")
            .map((t: string[]) => {
                const url = t[1];
                const type = t[2];
                return {
                    url,
                    read: !type || type === "read",
                    write: !type || type === "write"
                };
            });

        const list: UserRelayList = {
            pubkey: event.pubkey,
            relays,
            receivedAt: Date.now()
        };

        this.cache.set(event.pubkey, list);
        this.saveCache();
        return list;
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
