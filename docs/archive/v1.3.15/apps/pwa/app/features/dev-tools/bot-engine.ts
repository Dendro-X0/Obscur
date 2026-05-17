import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { cryptoService } from "../crypto/crypto-service";
import type { MockPool } from "./mock-pool";

export interface Bot {
    id: string;
    name: string;
    publicKey: PublicKeyHex;
    privateKey: PrivateKeyHex;
    avatar?: string;
}

/**
 * Orchestrator for simulated users (bots) in Ghost Protocol
 */
export class BotEngine {
    private bots: Map<string, Bot> = new Map();
    private pool: MockPool;

    constructor(pool: MockPool) {
        this.pool = pool;
    }

    async spawnBot(name: string, avatar?: string): Promise<Bot> {
        const { publicKey, privateKey } = await cryptoService.generateKeyPair();
        const bot: Bot = {
            id: publicKey,
            name,
            publicKey,
            privateKey,
            avatar
        };

        this.bots.set(bot.id, bot);

        // Publish bot metadata (Kind 0)
        const metadata = {
            name: bot.name,
            display_name: bot.name,
            picture: bot.avatar,
            about: `Ghost Protocol Bot: ${bot.name}`
        };

        const event = await cryptoService.signEvent({
            kind: 0,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: JSON.stringify(metadata),
            pubkey: bot.publicKey
        }, bot.privateKey);

        await this.pool.emitEvent(event);
        return bot;
    }

    async sendMessage(botId: string, content: string, groupId?: string): Promise<void> {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);

        const tags: string[][] = [];
        if (groupId) {
            tags.push(["h", groupId]);
        }

        const event = await cryptoService.signEvent({
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content,
            pubkey: bot.publicKey
        }, bot.privateKey);

        await this.pool.emitEvent(event);
    }

    async reactToMessage(botId: string, eventId: string, emoji: string): Promise<void> {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);

        const event = await cryptoService.signEvent({
            kind: 7,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["e", eventId]],
            content: emoji,
            pubkey: bot.publicKey
        }, bot.privateKey);

        await this.pool.emitEvent(event);
    }

    getBots(): Bot[] {
        return Array.from(this.bots.values());
    }

    clearBots() {
        this.bots.clear();
    }
}
