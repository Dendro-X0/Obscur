"use client";

import { messagingDB } from "@dweb/storage/indexed-db";
import { messageBus } from "../services/message-bus";
import type { Message } from "../types";

type SeedParams = Readonly<{
    conversationId: string;
    count?: number;
    startTimeMs?: number;
    intervalMs?: number;
}>;

type BurstParams = Readonly<{
    conversationId: string;
    count?: number;
    startTimeMs?: number;
    intervalMs?: number;
}>;

type ChatPerfTools = Readonly<{
    seedConversationMessages: (params: SeedParams) => Promise<Readonly<{ inserted: number }>>;
    clearConversationMessages: (conversationId: string) => Promise<void>;
    emitBurstEvents: (params: BurstParams) => Readonly<{ emitted: number }>;
}>;

declare global {
    interface Window {
        obscurChatPerf?: ChatPerfTools;
    }
}

const makeMessageRecord = (params: Readonly<{
    id: string;
    conversationId: string;
    timestampMs: number;
    content: string;
}>): Record<string, unknown> => ({
    id: params.id,
    conversationId: params.conversationId,
    kind: "user",
    content: params.content,
    timestamp: new Date(params.timestampMs),
    timestampMs: params.timestampMs,
    isOutgoing: false,
    status: "delivered",
    senderPubkey: "synthetic-peer",
});

const makeLiveMessage = (params: Readonly<{
    id: string;
    timestampMs: number;
    content: string;
}>): Message => ({
    id: params.id,
    kind: "user",
    content: params.content,
    timestamp: new Date(params.timestampMs),
    isOutgoing: false,
    status: "delivered",
    senderPubkey: "synthetic-peer",
});

const seedConversationMessages = async (params: SeedParams): Promise<Readonly<{ inserted: number }>> => {
    const count = Math.max(1, params.count ?? 10_000);
    const intervalMs = Math.max(1, params.intervalMs ?? 1_000);
    const end = params.startTimeMs ?? Date.now();
    const start = end - (count * intervalMs);
    const batch: Array<Record<string, unknown>> = [];

    for (let i = 0; i < count; i += 1) {
        const timestampMs = start + (i * intervalMs);
        batch.push(
            makeMessageRecord({
                id: `seed-${params.conversationId}-${i + 1}`,
                conversationId: params.conversationId,
                timestampMs,
                content: `Synthetic seed #${i + 1}`
            })
        );
    }

    await messagingDB.bulkPut("messages", batch);
    return { inserted: batch.length };
};

const clearConversationMessages = async (conversationId: string): Promise<void> => {
    await messagingDB.deleteByRange(
        "messages",
        "conversationId",
        IDBKeyRange.only(conversationId)
    );
};

const emitBurstEvents = (params: BurstParams): Readonly<{ emitted: number }> => {
    const count = Math.max(1, params.count ?? 100);
    const startTimeMs = params.startTimeMs ?? Date.now();
    const intervalMs = Math.max(0, params.intervalMs ?? 1);

    for (let i = 0; i < count; i += 1) {
        const timestampMs = startTimeMs + (i * intervalMs);
        const id = `burst-${params.conversationId}-${timestampMs}-${i}`;
        messageBus.emitNewMessage(
            params.conversationId,
            makeLiveMessage({
                id,
                timestampMs,
                content: `Synthetic burst #${i + 1}`
            })
        );
    }

    return { emitted: count };
};

export const installChatPerformanceDevTools = (): void => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production") return;
    if (window.obscurChatPerf) return;

    window.obscurChatPerf = {
        seedConversationMessages,
        clearConversationMessages,
        emitBurstEvents
    };

    console.info("[ChatPerfTools] Installed as window.obscurChatPerf");
};
