import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { replayAccountEvents } from "@/app/features/account-sync/services/account-event-reducer";
import type { AccountEvent } from "@/app/features/account-sync/account-event-contracts";

const PROFILE_ID = "profile-reload-test";
const ACCOUNT = "cc".repeat(32) as PublicKeyHex;
const PEER = "dd".repeat(32) as PublicKeyHex;
const CONVERSATION_ID = `${ACCOUNT}:${PEER}`;

const partitionEvents = vi.hoisted(() => new Map<string, AccountEvent[]>());

const partitionKey = (profileId: string, accountPublicKeyHex: PublicKeyHex): string => (
  `${profileId}::${accountPublicKeyHex}`
);

const suppressedMessageIds = vi.hoisted(() => new Set<string>());

const tombstoneMocks = vi.hoisted(() => ({
  suppressMessageDeleteTombstone: vi.fn((deleteId: string) => {
    suppressedMessageIds.add(deleteId);
  }),
  hydrateMessageDeleteTombstonesFromSqlite: vi.fn(async () => undefined),
  loadSuppressedMessageDeleteIds: vi.fn(() => new Set(suppressedMessageIds)),
}));

vi.mock("@/app/features/account-sync/services/account-event-store", () => ({
  accountEventStore: {
    appendAccountEvents: async (params: Readonly<{
      profileId: string;
      accountPublicKeyHex: PublicKeyHex;
      events: ReadonlyArray<AccountEvent>;
    }>) => {
      const key = partitionKey(params.profileId, params.accountPublicKeyHex);
      const list = partitionEvents.get(key) ?? [];
      let appendedCount = 0;
      let dedupeCount = 0;
      params.events.forEach((event) => {
        if (list.some((entry) => entry.idempotencyKey === event.idempotencyKey)) {
          dedupeCount += 1;
          return;
        }
        list.push(event);
        appendedCount += 1;
      });
      partitionEvents.set(key, list);
      return {
        appendedCount,
        dedupeCount,
        lastSequence: list.length,
      };
    },
    loadEvents: async (params: Readonly<{
      profileId: string;
      accountPublicKeyHex: PublicKeyHex;
    }>) => {
      const list = partitionEvents.get(partitionKey(params.profileId, params.accountPublicKeyHex)) ?? [];
      return list.map((event, index) => ({
        sequence: index + 1,
        event,
      }));
    },
    redactDmTimelineEvents: async (params: Readonly<{
      profileId: string;
      accountPublicKeyHex: PublicKeyHex;
      messageIds: ReadonlyArray<string>;
    }>) => {
      const messageIds = new Set(
        params.messageIds.map((id) => id.trim()).filter((id) => id.length > 0),
      );
      const key = partitionKey(params.profileId, params.accountPublicKeyHex);
      const list = partitionEvents.get(key) ?? [];
      const next = list.filter((event) => {
        if (event.type !== "DM_RECEIVED" && event.type !== "DM_SENT_CONFIRMED") {
          return true;
        }
        return !messageIds.has(event.messageId);
      });
      const redactedCount = list.length - next.length;
      partitionEvents.set(key, next);
      return { redactedCount };
    },
  },
}));

vi.mock("@dweb/db", () => ({
  isTauri: () => false,
  dbDeleteMessages: vi.fn(),
  dbDeleteMessage: vi.fn(),
  dbInsertTombstone: vi.fn(),
}));

vi.mock("./message-delete-tombstone-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./message-delete-tombstone-store")>();
  return {
    ...actual,
    hydrateMessageDeleteTombstonesFromSqlite: tombstoneMocks.hydrateMessageDeleteTombstonesFromSqlite,
    flushMessageDeleteTombstonesToNativeStore: vi.fn(async () => undefined),
    suppressMessageDeleteTombstone: tombstoneMocks.suppressMessageDeleteTombstone,
    isMessageDeleteSuppressed: (messageId: string) => suppressedMessageIds.has(messageId),
  };
});

vi.mock("@/app/features/profiles/services/default-storage-ports", () => ({
  getResolvedStoragePorts: () => ({
    messageDeleteTombstones: {
      suppressMessageDeleteTombstone: tombstoneMocks.suppressMessageDeleteTombstone,
      hydrateMessageDeleteTombstonesFromSqlite: tombstoneMocks.hydrateMessageDeleteTombstonesFromSqlite,
      loadSuppressedMessageDeleteIds: tombstoneMocks.loadSuppressedMessageDeleteIds,
    },
  }),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => PROFILE_ID,
}));

vi.mock("./chat-state-store", () => ({
  chatStateStoreService: {
    removeMessageIdentitiesFromAllActiveScopes: vi.fn(),
  },
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: { delete: vi.fn(async () => undefined) },
}));

const reconcileMocks = vi.hoisted(() => ({
  reconcileDmDeleteSuppressionWithEventLog: vi.fn(async () => {
    const key = `${PROFILE_ID}::${ACCOUNT}`;
    const list = partitionEvents.get(key) ?? [];
    partitionEvents.set(key, list.filter((event) => (
      event.type !== "DM_RECEIVED" && event.type !== "DM_SENT_CONFIRMED"
    )));
    return { redactedCount: 2, removedEventsAppended: 0 };
  }),
}));

vi.mock("./dm-delete-event-log-reconciliation", () => ({
  reconcileDmDeleteSuppressionWithEventLog: reconcileMocks.reconcileDmDeleteSuppressionWithEventLog,
}));

vi.mock("@/app/features/account-sync/services/account-projection-runtime", () => ({
  accountProjectionRuntime: {
    createDmRemovedEvent: vi.fn((params: Readonly<{
      messageId: string;
      conversationId: string;
    }>) => ({
      type: "DM_REMOVED_LOCALLY",
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
      eventId: `removed-${params.messageId}`,
      idempotencyKey: `removed-${params.messageId}`,
      observedAtUnixMs: 2_000,
      source: "legacy_bridge",
      messageId: params.messageId,
      conversationId: params.conversationId,
    })),
    replay: vi.fn(async () => ({})),
  },
}));

vi.mock("@/app/features/profiles/services/resolve-client-gateway", async () => {
  const { localDmVisibilityOwner } = await import("../local-dm-visibility/local-dm-visibility-owner");
  return {
    getResolvedClientGateway: () => ({
      localDmVisibility: localDmVisibilityOwner,
      messageDeleteTombstones: {
        suppressMessageDeleteTombstone: tombstoneMocks.suppressMessageDeleteTombstone,
        hydrateMessageDeleteTombstonesFromSqlite: tombstoneMocks.hydrateMessageDeleteTombstonesFromSqlite,
        loadSuppressedMessageDeleteIds: tombstoneMocks.loadSuppressedMessageDeleteIds,
        isMessageDeleteSuppressed: (messageId: string) => suppressedMessageIds.has(messageId),
      },
    }),
  };
});

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { accountEventStore } from "@/app/features/account-sync/services/account-event-store";
import { applyDmDeleteForMePersistence } from "./dm-local-delete-persistence";

const createDmReceived = (messageId: string): AccountEvent => ({
  type: "DM_RECEIVED",
  profileId: PROFILE_ID,
  accountPublicKeyHex: ACCOUNT,
  eventId: `dm-${messageId}`,
  idempotencyKey: `dm-${messageId}`,
  observedAtUnixMs: 1_000,
  source: "legacy_bridge",
  peerPublicKeyHex: PEER,
  conversationId: CONVERSATION_ID,
  messageId,
  eventCreatedAtUnixSeconds: 10,
  plaintextPreview: "spam",
});

describe("dm delete reload projection contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    partitionEvents.clear();
    suppressedMessageIds.clear();
  });

  it("after delete-for-me, simulated reload replay shows zero messages in conversation", async () => {
    await accountEventStore.appendAccountEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
      events: [createDmReceived("spam-1"), createDmReceived("spam-2")],
    });

    await applyDmDeleteForMePersistence({
      conversationId: CONVERSATION_ID,
      messageIdentityIds: ["spam-1", "spam-2"],
      accountPublicKeyHex: ACCOUNT,
      profileId: PROFILE_ID,
    });

    const events = await accountEventStore.loadEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
    });
    const projection = replayAccountEvents(events);
    expect(projection?.messagesByConversationId[CONVERSATION_ID] ?? []).toEqual([]);
    // Timeline may retain DM_RECEIVED when show-again is enabled; materialization must still hide them.
    expect(events.some((entry) => entry.event.type === "DM_REMOVED_LOCALLY")).toBe(true);
  });
});
