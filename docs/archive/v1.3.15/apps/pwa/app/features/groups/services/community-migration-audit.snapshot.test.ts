import { describe, expect, it } from "vitest";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { auditCommunityMigrationState } from "./community-migration-audit";
import { toGroupTombstoneKey } from "./group-tombstone-store";

const baseState = (): PersistedChatState => ({
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

const scenarios: ReadonlyArray<Readonly<{
    name: string;
    state: PersistedChatState;
    tombstones?: ReadonlySet<string>;
}>> = [
    {
        name: "clean canonical",
        state: {
            ...baseState(),
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
            }]
        }
    },
    {
        name: "duplicate + tombstone conflict",
        state: {
            ...baseState(),
            createdGroups: [
                {
                    id: "community:alpha:wss://relay.one",
                    groupId: "alpha",
                    relayUrl: "wss://relay.one",
                    displayName: "Alpha",
                    memberPubkeys: ["m1"],
                    lastMessage: "",
                    unreadCount: 0,
                    lastMessageTimeMs: 1
                },
                {
                    id: "community:alpha:wss://relay.one#legacy",
                    groupId: "alpha",
                    relayUrl: "wss://relay.one",
                    displayName: "Alpha Legacy",
                    memberPubkeys: ["m2"],
                    lastMessage: "",
                    unreadCount: 0,
                    lastMessageTimeMs: 2,
                    genesisEventId: "g-alpha",
                    creatorPubkey: "pk-alpha"
                }
            ]
        },
        tombstones: new Set<string>([
            toGroupTombstoneKey({ groupId: "alpha", relayUrl: "wss://relay.one" })
        ])
    },
    {
        name: "orphan + non canonical keys",
        state: {
            ...baseState(),
            createdGroups: [{
                id: "community:beta:wss://relay.two",
                groupId: "beta",
                relayUrl: "wss://relay.two",
                displayName: "Beta",
                memberPubkeys: ["m1"],
                lastMessage: "",
                unreadCount: 0,
                lastMessageTimeMs: 1,
                genesisEventId: "g-beta",
                creatorPubkey: "pk-beta"
            }],
            unreadByConversationId: {
                "beta@relay.two": 1,
                "group:ghost:wss://relay.ghost": 3
            },
            pinnedChatIds: ["beta@relay.two"],
            hiddenChatIds: ["group:ghost:wss://relay.ghost"]
        }
    }
];

describe("community-migration-audit snapshot fixtures", () => {
    it("matches expected report structure for fixture scenarios", () => {
        const output = scenarios.map((scenario) => ({
            name: scenario.name,
            report: auditCommunityMigrationState({
                state: scenario.state,
                tombstones: scenario.tombstones
            })
        }));

        expect(output).toMatchInlineSnapshot(`
          [
            {
              "name": "clean canonical",
              "report": {
                "duplicateActiveCommunityKeys": [],
                "missingGenesisIdentityKeys": [],
                "nonCanonicalKnownConversationIds": [],
                "ok": true,
                "orphanConversationIds": [],
                "tombstonedActiveCommunityKeys": [],
              },
            },
            {
              "name": "duplicate + tombstone conflict",
              "report": {
                "duplicateActiveCommunityKeys": [
                  "alpha@@wss://relay.one",
                ],
                "missingGenesisIdentityKeys": [
                  "alpha@@wss://relay.one",
                ],
                "nonCanonicalKnownConversationIds": [],
                "ok": false,
                "orphanConversationIds": [],
                "tombstonedActiveCommunityKeys": [
                  "alpha@@wss://relay.one",
                ],
              },
            },
            {
              "name": "orphan + non canonical keys",
              "report": {
                "duplicateActiveCommunityKeys": [],
                "missingGenesisIdentityKeys": [],
                "nonCanonicalKnownConversationIds": [
                  "beta@relay.two",
                ],
                "ok": false,
                "orphanConversationIds": [
                  "group:ghost:wss://relay.ghost",
                ],
                "tombstonedActiveCommunityKeys": [],
              },
            },
          ]
        `);
    });
});
