import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  dbGetConversations: vi.fn(async () => [
    {
      id: "dm:aa:bb",
      profile_id: "p1",
      peer_pubkey: "b".repeat(64),
      last_event_id: null,
      last_message_at: 1000,
      last_plaintext_preview: null,
      unread_count: 0,
    },
  ]),
  dbGetMessages: vi.fn(async () => [
    {
      event_id: "evt-alive",
      profile_id: "p1",
      conversation_id: "dm:aa:bb",
      sender_pubkey: "b".repeat(64),
      recipient_pubkey: "a".repeat(64),
      plaintext: "hello sqlite",
      kind: 0,
      created_at: 1000,
      received_at: 1000,
      is_outgoing: false,
      reply_to_event_id: null,
      has_attachment: false,
    },
    {
      event_id: "evt-deleted",
      profile_id: "p1",
      conversation_id: "dm:aa:bb",
      sender_pubkey: "b".repeat(64),
      recipient_pubkey: "a".repeat(64),
      plaintext: "gone",
      kind: 0,
      created_at: 900,
      received_at: 900,
      is_outgoing: false,
      reply_to_event_id: null,
      has_attachment: false,
    },
  ]),
}));

vi.mock("@/app/features/messaging/services/chat-state-store-legacy", () => ({
  chatStateStoreService: {
    hydrateMessages: vi.fn(async () => undefined),
    load: vi.fn(() => ({ messagesByConversationId: { x: [{ id: "idb-resurrect" }] } })),
  },
}));

vi.mock("@/app/features/network/hooks/use-peer-trust", () => ({
  peerTrustInternals: { loadFromStorage: vi.fn(() => ({ acceptedPeers: [] })) },
}));

vi.mock("@/app/features/messaging/lib/sync-checkpoints", () => ({
  syncCheckpointInternals: { loadPersistedCheckpointState: vi.fn(() => new Map()) },
}));

vi.mock("./history-reset-cutoff-store", () => ({
  readHistoryResetCutoffUnixMs: vi.fn(() => null),
}));

const tombstoneMocks = vi.hoisted(() => ({
  hydrateDmTombstonesFromSqlite: vi.fn(async () => undefined),
  loadDmSuppressedIdentityIds: vi.fn(() => new Set(["evt-deleted"])),
}));

vi.mock("@/app/features/messaging/services/messaging-client-operations", () => ({
  messagingClientOperations: {
    hydrateDmTombstonesFromSqlite: tombstoneMocks.hydrateDmTombstonesFromSqlite,
    loadDmSuppressedIdentityIds: tombstoneMocks.loadDmSuppressedIdentityIds,
  },
}));

import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store-legacy";
import { buildBootstrapAccountEvents } from "./account-event-bootstrap-service";

const PROFILE_ID = "profile-native";
const ACCOUNT = "a".repeat(64) as PublicKeyHex;

describe("buildBootstrapAccountEvents native (P3c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips DM timeline import and chat-state hydrate on native (seal-only bootstrap)", async () => {
    const result = await buildBootstrapAccountEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
    });

    expect(chatStateStoreService.hydrateMessages).not.toHaveBeenCalled();
    expect(result.events.filter((e) => e.type === "DM_RECEIVED")).toHaveLength(0);
    expect(result.events.some((e) => e.type === "DM_REMOVED_LOCALLY")).toBe(true);
    expect(result.events.some((e) => e.type === "BOOTSTRAP_IMPORT_APPLIED")).toBe(true);
  });
});
