import { describe, expect, it } from "vitest";
import type { GroupMessageEvent } from "./use-sealed-community";
import { mergeGroupMessagesDescending } from "./use-sealed-community";

const createGroupMessage = (params: Readonly<{ id: string; createdAt: number }>): GroupMessageEvent => ({
    id: params.id,
    pubkey: "pubkey",
    created_at: params.createdAt,
    content: params.id,
});

describe("mergeGroupMessagesDescending", () => {
    it("deduplicates by id and keeps latest descending order", () => {
        const previous: GroupMessageEvent[] = [
            createGroupMessage({ id: "m2", createdAt: 200 }),
            createGroupMessage({ id: "m1", createdAt: 100 }),
        ];
        const incoming: GroupMessageEvent[] = [
            createGroupMessage({ id: "m3", createdAt: 300 }),
            createGroupMessage({ id: "m2", createdAt: 200 }),
        ];

        const merged = mergeGroupMessagesDescending({ previous, incoming });
        expect(merged.map((message) => message.id)).toEqual(["m3", "m2", "m1"]);
    });

    it("caps merged results at 200 items", () => {
        const previous = Array.from({ length: 150 }, (_, index) =>
            createGroupMessage({ id: `p-${index}`, createdAt: 1000 - index })
        );
        const incoming = Array.from({ length: 100 }, (_, index) =>
            createGroupMessage({ id: `i-${index}`, createdAt: 2000 - index })
        );

        const merged = mergeGroupMessagesDescending({ previous, incoming });
        expect(merged).toHaveLength(200);
        expect(merged[0].created_at).toBeGreaterThanOrEqual(merged[199].created_at);
    });

    it("keeps unique ids under burst-like overlap input", () => {
        const previous = Array.from({ length: 120 }, (_, index) =>
            createGroupMessage({ id: `id-${index}`, createdAt: 10_000 - index })
        );
        const incoming = Array.from({ length: 120 }, (_, index) =>
            createGroupMessage({ id: `id-${60 + index}`, createdAt: 11_000 - index })
        );

        const merged = mergeGroupMessagesDescending({ previous, incoming });
        const uniqueCount = new Set(merged.map((m) => m.id)).size;

        expect(uniqueCount).toBe(merged.length);
        expect(merged.length).toBeLessThanOrEqual(200);
        expect(merged[0].created_at).toBeGreaterThanOrEqual(merged[merged.length - 1].created_at);
    });
});
