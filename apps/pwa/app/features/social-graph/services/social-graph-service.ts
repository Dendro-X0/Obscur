import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/**
 * Service to manage Nostr social graph (Kind 3 contact lists)
 * and calculate trust metrics like mutual connections.
 */
export class SocialGraphService {
    private contactListCache = new Map<PublicKeyHex, PublicKeyHex[]>();
    private inflightRequests = new Map<PublicKeyHex, Promise<PublicKeyHex[]>>();

    constructor(private pool: any) { }

    /**
     * Get the list of public keys a user is following
     */
    async getFollowing(pubkey: PublicKeyHex): Promise<PublicKeyHex[]> {
        // Check cache first
        if (this.contactListCache.has(pubkey)) {
            return this.contactListCache.get(pubkey)!;
        }

        // Check if a request is already in flight for this pubkey
        if (this.inflightRequests.has(pubkey)) {
            return this.inflightRequests.get(pubkey)!;
        }

        const request = this.fetchFollowing(pubkey);
        this.inflightRequests.set(pubkey, request);

        try {
            const following = await request;
            this.contactListCache.set(pubkey, following);
            return following;
        } finally {
            this.inflightRequests.delete(pubkey);
        }
    }

    /**
     * Calculate mutual connections between two users
     */
    async getMutualConnections(userPubkey: PublicKeyHex, targetPubkey: PublicKeyHex): Promise<PublicKeyHex[]> {
        const [userFollowing, targetFollowing] = await Promise.all([
            this.getFollowing(userPubkey),
            this.getFollowing(targetPubkey)
        ]);

        const userFollowingSet = new Set(userFollowing);
        return targetFollowing.filter(pk => userFollowingSet.has(pk));
    }

    /**
     * Fetch following list from relays (Kind 3)
     */
    private async fetchFollowing(pubkey: PublicKeyHex): Promise<PublicKeyHex[]> {
        return new Promise((resolve) => {
            const subId = `follows-${Math.random().toString(36).substring(7)}`;
            let latestEvent: NostrEvent | null = null;

            const filter = {
                kinds: [3],
                authors: [pubkey],
                limit: 1
            };

            const cleanup = this.pool.subscribeToMessages(({ message }: { message: string }) => {
                try {
                    const parsed = JSON.parse(message);
                    if (parsed[0] === "EVENT" && parsed[1] === subId) {
                        const event = parsed[2] as NostrEvent;
                        if (event.kind === 3 && (!latestEvent || event.created_at > latestEvent.created_at)) {
                            latestEvent = event;
                        }
                    }
                    if (parsed[0] === "EOSE" && parsed[1] === subId) {
                        // We could resolve here, but let's wait a bit for all relays
                    }
                } catch (e) { }
            });

            this.pool.sendToOpen(JSON.stringify(["REQ", subId, filter]));

            // Wait 2 seconds for results
            setTimeout(() => {
                cleanup();
                if (!latestEvent) {
                    resolve([]);
                    return;
                }

                const following = latestEvent.tags
                    .filter(tag => tag[0] === 'p')
                    .map(tag => tag[1] as PublicKeyHex);

                resolve(following);
            }, 2000);
        });
    }
}
