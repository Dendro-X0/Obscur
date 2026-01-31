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

        return new Promise((resolve) => {
            const subId = `search-${Math.random().toString(36).substring(7)}`;
            const results = new Map<string, ProfileSearchResult>();

            const filter = {
                kinds: [0],
                limit: 50
            };

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

            this.pool.sendToOpen(JSON.stringify(["REQ", subId, searchFilter]));

            // Timeout to return whatever we found
            setTimeout(async () => {
                cleanup();
                const searchResults = Array.from(results.values());

                // Calculate trust scores if social graph service is available
                if (this.socialGraph && this.currentUserPubkey) {
                    await Promise.all(searchResults.map(async (profile) => {
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
                            console.warn("Failed to calculate trust score for", profile.pubkey, e);
                        }
                    }));
                }

                // Sort by trust score (descending)
                searchResults.sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));

                resolve(searchResults);
            }, 3000);
        });
    }
}
