import { describe, it, expect, vi } from "vitest";
import { GLOBAL_DISCOVERY_RELAY_URLS, mergeRelaySets } from "@/app/features/relays/services/discovery-relay-set";
import { queryRelayProfiles, relayDiscoveryQueryInternals } from "./relay-discovery-query";
import { FRIEND_CODE_ALIAS_KIND } from "./friend-code-alias";

describe("relayDiscoveryQueryInternals", () => {
    it("builds invite filters with indexed alias d-tag before kind-0 fallback", () => {
        const filters = relayDiscoveryQueryInternals.buildFilters("invite", "OBSCUR-RW8NXD");
        expect(filters).toEqual([
            { kinds: [31950], "#d": ["OBSCUR-RW8NXD"], limit: 8 },
            { kinds: [0], "#i": ["OBSCUR-RW8NXD"], limit: 16 },
        ]);
    });

    it("builds direct author filters for pubkey lookups", () => {
        const pubkey = "a".repeat(64);
        const filters = relayDiscoveryQueryInternals.buildFilters("author", pubkey);
        expect(filters).toEqual([
            { kinds: [0], authors: [pubkey], limit: 1 },
        ]);
    });

    it("extracts profile record from kind-0 event content", () => {
        const record = relayDiscoveryQueryInternals.profileFromEvent({
            pubkey: "a".repeat(64),
            content: JSON.stringify({
                name: "Alice",
                display_name: "Alice Doe",
                about: "Find me on Obscur with this code: OBSCUR-RW8NXD",
                picture: "https://example.com/a.png",
                nip05: "alice@example.com",
            }),
            tags: [["i", "OBSCUR-RW8NXD"]],
        });
        expect(record?.pubkey).toBe("a".repeat(64));
        expect(record?.inviteCode).toBe("OBSCUR-RW8NXD");
    });

    it("extracts invite code from explicit JSON inviteCode fields", () => {
        const record = relayDiscoveryQueryInternals.profileFromEvent({
            pubkey: "b".repeat(64),
            content: JSON.stringify({
                name: "Bob",
                inviteCode: "obscur-azaj5l",
            }),
            tags: [],
        });
        expect(record?.pubkey).toBe("b".repeat(64));
        expect(record?.inviteCode).toBe("OBSCUR-AZAJ5L");
    });

    it("merges scoped relay urls ahead of global discovery relays", () => {
        expect(mergeRelaySets(["ws://localhost:7000"], GLOBAL_DISCOVERY_RELAY_URLS)).toEqual([
            "ws://localhost:7000",
            ...GLOBAL_DISCOVERY_RELAY_URLS,
        ]);
    });
});

describe("queryRelayProfiles invite path", () => {
    it("sends invite REQ via sendToOpen (not broadcastEvent/publish)", async () => {
        const sendToOpen = vi.fn();
        const broadcastEvent = vi.fn(async () => ({ success: false }));
        const addedTransient: string[] = [];
        const aliasPubkey = "e".repeat(64);
        const inviteCode = "OBSCUR-Z8V4YD";
        let messageHandler: ((params: Readonly<{ url: string; message: string }>) => void) | null = null;

        const pool = {
            broadcastEvent,
            sendToOpen: (payload: string) => {
                sendToOpen(payload);
                const parsed = JSON.parse(payload) as unknown[];
                const subId = typeof parsed[1] === "string" ? parsed[1] : "discover-test";
                queueMicrotask(() => {
                    messageHandler?.({
                        url: "wss://nos.lol",
                        message: JSON.stringify([
                            "EVENT",
                            subId,
                            {
                                kind: FRIEND_CODE_ALIAS_KIND,
                                pubkey: aliasPubkey,
                                created_at: Math.floor(Date.now() / 1000),
                                tags: [
                                    ["d", inviteCode],
                                    ["p", aliasPubkey],
                                    ["l", "obscur-friend-code"],
                                ],
                                content: JSON.stringify({ v: 1, code: inviteCode, pubkey: aliasPubkey }),
                                id: "a".repeat(64),
                                sig: "b".repeat(128),
                            },
                        ]),
                    });
                });
            },
            subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => {
                messageHandler = handler;
                return () => {
                    messageHandler = null;
                };
            },
            waitForConnection: async () => true,
            waitForScopedConnection: async () => true,
            addTransientRelay: (url: string) => {
                addedTransient.push(url);
            },
        };

        const records = await queryRelayProfiles({
            pool,
            mode: "invite",
            query: inviteCode,
            timeoutMs: 1_500,
            maxResults: 5,
        });

        expect(sendToOpen).toHaveBeenCalled();
        expect(broadcastEvent).not.toHaveBeenCalled();
        const reqPayload = String(sendToOpen.mock.calls[0]?.[0] ?? "");
        expect(reqPayload.startsWith("[\"REQ\"")).toBe(true);
        expect(reqPayload).toContain(String(FRIEND_CODE_ALIAS_KIND));
        expect(reqPayload).toContain(inviteCode);
        expect(addedTransient).toEqual(expect.arrayContaining([...GLOBAL_DISCOVERY_RELAY_URLS]));
        expect(records.some((record) => record.pubkey === aliasPubkey && record.inviteCode === inviteCode)).toBe(true);
    });
});
