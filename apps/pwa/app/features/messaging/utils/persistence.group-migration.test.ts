import { beforeEach, describe, expect, it } from "vitest";
import { loadPersistedChatState } from "./persistence";

const PK = "pk_test_group_migration";
const STORAGE_KEY = `dweb.nostr.pwa.chatState.v2.${PK}`;
const LEGACY_STORAGE_KEY = "dweb.nostr.pwa.chatState";

const createBaseState = () => ({
    version: 2,
    createdConnections: [],
    unreadByConversationId: {},
    connectionOverridesByConnectionId: {},
    messagesByConversationId: {},
    groupMessages: {},
    pinnedChatIds: [],
    hiddenChatIds: []
});

describe("persistence group migration", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("normalizes legacy group ids, dedupes groups, and remaps conversation-keyed state", () => {
        const legacyId = "alpha@relay.one";
        const canonicalId = "community:alpha:wss://relay.one";

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...createBaseState(),
            createdGroups: [
                {
                    id: legacyId,
                    groupId: "alpha",
                    relayUrl: "",
                    displayName: "",
                    memberPubkeys: ["member_a"],
                    lastMessage: "legacy",
                    unreadCount: 1,
                    lastMessageTimeMs: 100
                },
                {
                    id: canonicalId,
                    groupId: "alpha",
                    relayUrl: "wss://relay.one",
                    displayName: "Alpha",
                    memberPubkeys: ["member_b"],
                    lastMessage: "canonical",
                    unreadCount: 2,
                    lastMessageTimeMs: 200
                }
            ],
            unreadByConversationId: {
                [legacyId]: 2,
                [canonicalId]: 7
            },
            messagesByConversationId: {
                [legacyId]: [{
                    id: "m1",
                    content: "old",
                    timestampMs: 1,
                    isOutgoing: true,
                    status: "delivered"
                }],
                [canonicalId]: [{
                    id: "m2",
                    content: "new",
                    timestampMs: 2,
                    isOutgoing: false,
                    status: "delivered"
                }]
            },
            groupMessages: {
                [legacyId]: [{ id: "g1", pubkey: "pk1", created_at: 1, content: "a" }],
                [canonicalId]: [{ id: "g2", pubkey: "pk2", created_at: 2, content: "b" }]
            },
            pinnedChatIds: [legacyId, canonicalId, "dm:1"],
            hiddenChatIds: [legacyId, canonicalId]
        }));

        const parsed = loadPersistedChatState(PK);
        expect(parsed).not.toBeNull();
        expect(parsed?.createdGroups).toHaveLength(1);
        expect(parsed?.createdGroups[0]?.id).toBe(canonicalId);
        expect(parsed?.createdGroups[0]?.communityId).toBe("alpha:wss://relay.one");
        expect(parsed?.createdGroups[0]?.memberPubkeys).toEqual(["member_a", "member_b"]);
        expect(parsed?.createdGroups[0]?.displayName).toBe("Alpha");

        expect(parsed?.unreadByConversationId[canonicalId]).toBe(7);
        expect(Object.keys(parsed?.unreadByConversationId ?? {})).toEqual([canonicalId]);
        expect(parsed?.messagesByConversationId[canonicalId]).toHaveLength(2);
        expect(parsed?.groupMessages?.[canonicalId]).toHaveLength(2);
        expect(parsed?.pinnedChatIds).toEqual([canonicalId, "dm:1"]);
        expect(parsed?.hiddenChatIds).toEqual([canonicalId]);
    });

    it("remaps legacy conversation keys when group record is already canonical", () => {
        const legacyId = "beta@relay.two";
        const canonicalId = "community:beta:wss://relay.two";

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...createBaseState(),
            createdGroups: [{
                id: canonicalId,
                groupId: "beta",
                relayUrl: "wss://relay.two",
                displayName: "Beta",
                memberPubkeys: ["member"],
                lastMessage: "",
                unreadCount: 0,
                lastMessageTimeMs: 10
            }],
            unreadByConversationId: {
                [legacyId]: 3
            }
        }));

        const parsed = loadPersistedChatState(PK);
        expect(parsed?.unreadByConversationId[canonicalId]).toBe(3);
        expect(Object.keys(parsed?.unreadByConversationId ?? {})).toEqual([canonicalId]);
    });

    it("remaps legacy conversation keys to explicit communityId when present", () => {
        const legacyId = "delta@relay.four";
        const canonicalCommunityId = "v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const canonicalId = `community:${canonicalCommunityId}`;

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...createBaseState(),
            createdGroups: [{
                id: canonicalId,
                communityId: canonicalCommunityId,
                genesisEventId: "genesis-123",
                creatorPubkey: "creator-456",
                groupId: "delta",
                relayUrl: "wss://relay.four",
                displayName: "Delta",
                memberPubkeys: ["member"],
                lastMessage: "",
                unreadCount: 0,
                lastMessageTimeMs: 10
            }],
            unreadByConversationId: {
                [legacyId]: 4
            },
            messagesByConversationId: {
                [legacyId]: [{
                    id: "m-delta",
                    content: "legacy",
                    timestampMs: 10,
                    isOutgoing: true,
                    status: "delivered"
                }]
            }
        }));

        const parsed = loadPersistedChatState(PK);
        expect(parsed?.unreadByConversationId[canonicalId]).toBe(4);
        expect(Object.keys(parsed?.unreadByConversationId ?? {})).toEqual([canonicalId]);
        expect(parsed?.messagesByConversationId[canonicalId]).toHaveLength(1);
        expect(parsed?.createdGroups[0]?.genesisEventId).toBe("genesis-123");
        expect(parsed?.createdGroups[0]?.creatorPubkey).toBe("creator-456");
    });

    it("does not remap unknown legacy-like keys that are not known groups", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...createBaseState(),
            createdGroups: [],
            unreadByConversationId: {
                "ghost@relay.unknown": 1
            }
        }));

        const parsed = loadPersistedChatState(PK);
        expect(parsed?.unreadByConversationId["ghost@relay.unknown"]).toBe(1);
    });

    it("migrates from legacy storage key and persists normalized canonical state", () => {
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
            ...createBaseState(),
            createdGroups: [
                {
                    id: "gamma@relay.legacy",
                    groupId: "gamma",
                    relayUrl: "",
                    displayName: "",
                    memberPubkeys: ["legacy_member"],
                    lastMessage: "legacy",
                    unreadCount: 0,
                    lastMessageTimeMs: 5
                }
            ],
            unreadByConversationId: {
                "gamma@relay.legacy": 2
            }
        }));

        const parsed = loadPersistedChatState(PK);
        expect(parsed?.createdGroups).toHaveLength(1);
        expect(parsed?.createdGroups[0]?.id).toBe("community:gamma:wss://relay.legacy");
        expect(parsed?.createdGroups[0]?.communityId).toBe("gamma:wss://relay.legacy");
        expect(parsed?.unreadByConversationId["community:gamma:wss://relay.legacy"]).toBe(2);

        const migratedRaw = localStorage.getItem(STORAGE_KEY);
        expect(migratedRaw).toBeTruthy();
        const migratedParsed = migratedRaw ? JSON.parse(migratedRaw) : null;
        expect(migratedParsed?.createdGroups?.[0]?.id).toBe("community:gamma:wss://relay.legacy");
        expect(migratedParsed?.createdGroups?.[0]?.communityId).toBe("gamma:wss://relay.legacy");
    });

    it("promotes non-hash communityId to hashed id when genesis identity is present", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...createBaseState(),
            createdGroups: [{
                id: "community:epsilon:wss://relay.epsilon",
                communityId: "epsilon:wss://relay.epsilon",
                groupId: "epsilon",
                relayUrl: "wss://relay.epsilon",
                displayName: "Epsilon",
                memberPubkeys: ["member"],
                lastMessage: "",
                unreadCount: 0,
                lastMessageTimeMs: 10,
                genesisEventId: "genesis-epsilon",
                creatorPubkey: "creator-epsilon"
            }]
        }));

        const parsed = loadPersistedChatState(PK);
        const migratedCommunityId = parsed?.createdGroups[0]?.communityId ?? "";
        expect(migratedCommunityId).toMatch(/^v2_[0-9a-f]{64}$/);
        expect(parsed?.createdGroups[0]?.id).toBe(`community:${migratedCommunityId}`);
    });
});
