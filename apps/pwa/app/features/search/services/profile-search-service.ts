import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { SocialGraphService } from "../../social-graph/services/social-graph-service";

export interface ProfileSearchResult {
    pubkey: PublicKeyHex;
    name?: string;
    displayName?: string;
    nip05?: string;
    picture?: string;
    about?: string;
    mutuals?: PublicKeyHex[];
    trustScore?: number;
}

/**
 * Service to search for user profiles across relays using metadata (Kind 0)
 */
export class ProfileSearchService {
    constructor(
        private pool: any,
        private socialGraph?: SocialGraphService,
        private currentUserPubkey?: PublicKeyHex
    ) { }

    /**
     * Search for profiles by name or display name
     */
    async searchByName(query: string): Promise<ProfileSearchResult[]> {
        if (!query || query.length < 3) return [];

        // 1. Relay Search (NIP-50)
        const relaySearchPromise = new Promise<ProfileSearchResult[]>((resolve) => {
            const subId = `search-${Math.random().toString(36).substring(7)}`;
            const results = new Map<string, ProfileSearchResult>();

            const cleanup = this.pool.subscribeToMessages(({ message }: { message: string }) => {
                try {
                    const parsed = JSON.parse(message);
                    if (parsed[0] === "EVENT" && parsed[1] === subId) {
                        const event = parsed[2] as NostrEvent;
                        if (event.kind === 0) {
                            try {
                                const profile = JSON.parse(event.content);
                                const name = profile.name || "";
                                const displayName = profile.display_name || "";

                                if (
                                    name.toLowerCase().includes(query.toLowerCase()) ||
                                    displayName.toLowerCase().includes(query.toLowerCase())
                                ) {
                                    results.set(event.pubkey, {
                                        pubkey: event.pubkey as PublicKeyHex,
                                        name: profile.name,
                                        displayName: profile.display_name,
                                        nip05: profile.nip05,
                                        picture: profile.picture,
                                        about: profile.about
                                    });
                                }
                            } catch (e) {
                                // Ignore malformed content
                            }
                        }
                    }
                } catch (e) { }
            });

            // If the pool supports NIP-50 search, we should use it
            const searchFilter = {
                kinds: [0],
                search: query,
                limit: 20
            };

            try {
                this.pool.sendToOpen(JSON.stringify(["REQ", subId, searchFilter]));
            } catch (e) {
                console.warn("Failed to send relay search REQ", e);
            }

            // Timeout to return whatever we found on relays
            setTimeout(() => {
                try {
                    cleanup();
                } catch (e) { }
                resolve(Array.from(results.values()));
            }, 2500);
        });

        // 2. HTTP Fallback (Nostr.band API)
        const apiSearchPromise = fetch(`https://api.nostr.band/v0/search/profile?q=${encodeURIComponent(query)}`)
            .then(res => res.ok ? res.json() : { profiles: [] })
            .then((data: { profiles: Array<{ pubkey: string; new_content: any }> }) => {
                return data.profiles.map(p => {
                    try {
                        const content = p.new_content;
                        return {
                            pubkey: p.pubkey as PublicKeyHex,
                            name: content.name,
                            displayName: content.display_name,
                            nip05: content.nip05,
                            picture: content.picture,
                            about: content.about
                        };
                    } catch (e) {
                        return null;
                    }
                }).filter((p) => p !== null) as ProfileSearchResult[];
            })
            .catch(e => {
                console.warn("API search failed", e);
                return [] as ProfileSearchResult[];
            });

        // 3. Merge Results
        const [relayResults, apiResults] = await Promise.all([relaySearchPromise, apiSearchPromise]);

        const merged = new Map<string, ProfileSearchResult>();
        [...relayResults, ...apiResults].forEach(p => {
            if (p) {
                if (!merged.has(p.pubkey)) {
                    merged.set(p.pubkey, p);
                }
            }
        });

        const finalResults = Array.from(merged.values());

        // Calculate trust scores if social graph service is available
        if (this.socialGraph && this.currentUserPubkey) {
            await Promise.all(finalResults.map(async (profile) => {
                try {
                    const mutuals = await this.socialGraph!.getMutualConnections(this.currentUserPubkey!, profile.pubkey);
                    profile.mutuals = mutuals;

                    let score = 0;
                    // +20 for NIP-05
                    if (profile.nip05) score += 20;
                    // +20 per mutual, max 60 (3 mutuals)
                    score += Math.min(mutuals.length * 20, 60);

                    profile.trustScore = score;
                } catch (e) {
                    // Ignore trust score errors
                }
            }));
        }

        // Sort by trust score (descending)
        finalResults.sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));

        return finalResults;
    }
}
