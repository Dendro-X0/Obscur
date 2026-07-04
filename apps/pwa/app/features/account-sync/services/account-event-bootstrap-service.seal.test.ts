import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const tombstoneMocks = vi.hoisted(() => ({
  hydrateMessageDeleteTombstonesFromSqlite: vi.fn(async () => undefined),
  loadSuppressedMessageDeleteIds: vi.fn(() => new Set(["deleted-msg-1"])),
}));

vi.mock("@/app/features/profiles/services/default-storage-ports", () => ({
  getResolvedStoragePorts: () => ({
    messageDeleteTombstones: {
      hydrateMessageDeleteTombstonesFromSqlite: tombstoneMocks.hydrateMessageDeleteTombstonesFromSqlite,
      loadSuppressedMessageDeleteIds: tombstoneMocks.loadSuppressedMessageDeleteIds,
    },
  }),
}));

vi.mock("@/app/features/messaging/services/chat-state-store-legacy", () => ({
  chatStateStoreService: {
    hydrateMessages: vi.fn(async () => undefined),
    load: vi.fn(() => null),
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

import { buildBootstrapSealEvents } from "./account-event-bootstrap-service";

const PROFILE_ID = "profile-seal";
const ACCOUNT_PUBKEY = "c".repeat(64) as PublicKeyHex;

describe("buildBootstrapSealEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates tombstones and emits DM_REMOVED plus bootstrap marker without chat-state import", async () => {
    const result = await buildBootstrapSealEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
    });

    expect(tombstoneMocks.hydrateMessageDeleteTombstonesFromSqlite).toHaveBeenCalledWith(PROFILE_ID);
    const removed = result.events.filter((event) => event.type === "DM_REMOVED_LOCALLY");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.messageId).toBe("deleted-msg-1");
    expect(result.events.some((event) => event.type === "BOOTSTRAP_IMPORT_APPLIED")).toBe(true);
    expect(result.events.some((event) => event.type === "DM_RECEIVED")).toBe(false);
  });
});
