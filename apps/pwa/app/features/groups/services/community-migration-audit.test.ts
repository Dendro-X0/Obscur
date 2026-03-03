import { describe, expect, it } from "vitest";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { auditCommunityMigrationState } from "./community-migration-audit";
import { toGroupTombstoneKey } from "./group-tombstone-store";

const createState = (): PersistedChatState => ({
    version: 2,
    createdConnections: [],
    createdGroups: [],
    unreadByConversationId: {},
    connectionOverridesByConnectionId: {},
    messagesByConversationId: {},
    groupMessages: {},
    pinnedChatIds: [],
    hiddenChatIds: []
});

describe("community-migration-audit", () => {
    it("returns ok for clean canonical state", () => {
        const state: PersistedChatState = {
            ...createState(),
            createdGroups: [{
                id: "community:alpha:wss://relay.one",
                groupId: "alpha",
                relayUrl: "wss://relay.one",
                displayName: "Alpha",
                memberPubkeys: ["m1"],
                lastMessage: "",
                unreadCount: 0,
                lastMessageTimeMs: 1,
                genesisEventId: "g-alpha",
                creatorPubkey: "pk-alpha"
            }],
            unreadByConversationId: { "community:alpha:wss://relay.one": 1 }
        };

        const report = auditCommunityMigrationState({ state });
        expect(report.ok).toBe(true);
        expect(report.duplicateActiveCommunityKeys).toEqual([]);
        expect(report.tombstonedActiveCommunityKeys).toEqual([]);
        expect(report.missingGenesisIdentityKeys).toEqual([]);
        expect(report.orphanConversationIds).toEqual([]);
        expect(report.nonCanonicalKnownConversationIds).toEqual([]);
    });

    it("detects duplicate active communities and tombstone conflicts", () => {
        const state: PersistedChatState = {
            ...createState(),
            createdGroups: [
                {
                    id: "community:alpha:wss://relay.one",
                    groupId: "alpha",
                    relayUrl: "wss://relay.one",
                    displayName: "Alpha 1",
                    memberPubkeys: ["m1"],
                    lastMessage: "",
                    unreadCount: 0,
                    lastMessageTimeMs: 1
                },
                {
                    id: "legacy-alpha",
                    groupId: "alpha",
                    relayUrl: "wss://relay.one",
                    displayName: "Alpha 2",
                    memberPubkeys: ["m2"],
                    lastMessage: "",
                    unreadCount: 0,
                    lastMessageTimeMs: 2
                }
            ]
        };

        const tombstones = new Set<string>([
            toGroupTombstoneKey({ groupId: "alpha", relayUrl: "wss://relay.one" })
        ]);
        const report = auditCommunityMigrationState({ state, tombstones });

        expect(report.ok).toBe(false);
        expect(report.duplicateActiveCommunityKeys).toEqual([
            "alpha@@wss://relay.one"
        ]);
        expect(report.tombstonedActiveCommunityKeys).toEqual([
            "alpha@@wss://relay.one"
        ]);
        expect(report.missingGenesisIdentityKeys).toEqual([
            "alpha@@wss://relay.one"
        ]);
    });

    it("detects orphan and non-canonical known conversation ids", () => {
        const state: PersistedChatState = {
            ...createState(),
            createdGroups: [{
                id: "community:alpha:wss://relay.one",
                groupId: "alpha",
                relayUrl: "wss://relay.one",
                displayName: "Alpha",
                memberPubkeys: ["m1"],
                lastMessage: "",
                unreadCount: 0,
                lastMessageTimeMs: 1
            }],
            unreadByConversationId: {
                "alpha@relay.one": 2,
                "group:ghost:wss://relay.ghost": 1
            },
            pinnedChatIds: ["alpha@relay.one"]
        };

        const report = auditCommunityMigrationState({ state });
        expect(report.ok).toBe(false);
        expect(report.nonCanonicalKnownConversationIds).toEqual([
            "alpha@relay.one"
        ]);
        expect(report.orphanConversationIds).toEqual([
            "group:ghost:wss://relay.ghost"
        ]);
        expect(report.missingGenesisIdentityKeys).toEqual([
            "alpha@@wss://relay.one"
        ]);
    });

    it("supports hashed community ids and flags missing genesis identity", () => {
        const state: PersistedChatState = {
            ...createState(),
            createdGroups: [{
                id: "community:v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                communityId: "v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                groupId: "alpha",
                relayUrl: "wss://relay.one",
                displayName: "Alpha",
                memberPubkeys: ["m1"],
                lastMessage: "",
                unreadCount: 0,
                lastMessageTimeMs: 1,
                genesisEventId: "genesis-1",
                creatorPubkey: "creator-1"
            }],
            unreadByConversationId: {
                "community:v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 1
            }
        };

        const report = auditCommunityMigrationState({ state });
        expect(report.ok).toBe(true);
        expect(report.orphanConversationIds).toEqual([]);
        expect(report.missingGenesisIdentityKeys).toEqual([]);
    });
});
