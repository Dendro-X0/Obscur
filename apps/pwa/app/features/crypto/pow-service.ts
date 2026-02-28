import { minePowWorker } from "@dweb/crypto/pow-worker-wrapper";
import { type UnsignedNostrEvent } from "../crypto/crypto-service";

/**
 * Proof of Work Service
 * 
 * Provides a unified interface for mining NIP-13 nonces,
 * utilizing high-performance native Rust miners when available (Tauri),
 * or falling back to WebWorkers in standard browser environments.
 */
export const powService = {
    /**
     * Mines a Proof of Work nonce for a given Nostr event template.
     * 
     * @param event The unsigned Nostr event to mine
     * @param difficulty The target difficulty (leading zero bits)
     * @returns The mined event with the 'nonce' tag added and id updated
     */
    async mineEvent(event: UnsignedNostrEvent, difficulty: number): Promise<UnsignedNostrEvent> {
        if (difficulty <= 0) return event;

        // 1. Try Native Bridge (Tauri)
        if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
            try {
                const { invoke } = await import("@tauri-apps/api/core");
                console.info(`[PoW Service] Using native Rust miner (Difficulty: ${difficulty})`);

                // The Rust command expects an UnsignedEvent and returns the mined one
                // Note: The Rust side uses the 'mine_pow' command we registered
                const minedEvent = await invoke<UnsignedNostrEvent>("mine_pow", {
                    unsignedEvent: event,
                    difficulty
                });

                return minedEvent;
            } catch (e) {
                console.warn("[PoW Service] Native miner failed, falling back to WebWorker:", e);
                // Fallback to WebWorker if native fails
            }
        }

        // 2. Fallback to WebWorker (PWA / Web)
        console.info(`[PoW Service] Using WebWorker miner (Difficulty: ${difficulty})`);

        // The minePowWorker expects { id, content, tags, created_at, pubkey }
        // and returns { id, tags }
        const { id, tags } = await minePowWorker({
            kind: event.kind,
            content: event.content,
            tags: event.tags,
            created_at: event.created_at,
            pubkey: event.pubkey
        }, difficulty);

        return {
            ...event,
            id,
            tags
        };
    }
};
