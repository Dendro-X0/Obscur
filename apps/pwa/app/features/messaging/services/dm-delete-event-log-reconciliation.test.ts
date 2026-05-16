import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const PROFILE_ID = "profile-reconcile";
const ACCOUNT = "ee".repeat(32) as PublicKeyHex;

const storeMocks = vi.hoisted(() => ({
  loadEvents: vi.fn(async () => [] as ReadonlyArray<{ sequence: number; event: unknown }>),
  redactDmTimelineEvents: vi.fn(async () => ({ redactedCount: 0 })),
  appendAccountEvents: vi.fn(async () => ({ appendedCount: 0, dedupeCount: 0, lastSequence: 0 })),
}));

const tombstoneMocks = vi.hoisted(() => ({
  hydrateMessageDeleteTombstonesFromSqlite: vi.fn(async () => undefined),
  loadSuppressedMessageDeleteIds: vi.fn(() => new Set(["gone-msg"])),
  isMessageDeleteSuppressed: vi.fn((messageId: string) => messageId === "gone-msg"),
}));

const projectionMocks = vi.hoisted(() => ({
  createDmRemovedEvent: vi.fn((params: Readonly<{ messageId: string; conversationId: string }>) => ({
    type: "DM_REMOVED_LOCALLY",
    messageId: params.messageId,
    conversationId: params.conversationId,
  })),
  replay: vi.fn(async () => ({})),
}));

vi.mock("@/app/features/account-sync/services/account-event-store", () => ({
  accountEventStore: storeMocks,
}));

vi.mock("./message-delete-tombstone-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./message-delete-tombstone-store")>();
  return {
    ...actual,
    hydrateMessageDeleteTombstonesFromSqlite: tombstoneMocks.hydrateMessageDeleteTombstonesFromSqlite,
    isMessageDeleteSuppressed: tombstoneMocks.isMessageDeleteSuppressed,
    loadSuppressedMessageDeleteIds: tombstoneMocks.loadSuppressedMessageDeleteIds,
  };
});

vi.mock("@/app/features/profiles/services/resolve-client-gateway", async () => {
  const { localDmVisibilityOwner } = await vi.importActual<typeof import("@/app/features/messaging/local-dm-visibility")>(
    "@/app/features/messaging/local-dm-visibility",
  );
  return {
    getResolvedClientGateway: () => ({
      localDmVisibility: localDmVisibilityOwner,
      messageDeleteTombstones: {
        loadSuppressedMessageDeleteIds: tombstoneMocks.loadSuppressedMessageDeleteIds,
        hydrateMessageDeleteTombstonesFromSqlite: tombstoneMocks.hydrateMessageDeleteTombstonesFromSqlite,
      },
    }),
  };
});

vi.mock("@/app/features/account-sync/services/account-projection-runtime", () => ({
  accountProjectionRuntime: projectionMocks,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { reconcileDmDeleteSuppressionWithEventLog } from "./dm-delete-event-log-reconciliation";

describe("reconcileDmDeleteSuppressionWithEventLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMocks.loadEvents.mockResolvedValue([
      {
        sequence: 1,
        event: {
          type: "DM_RECEIVED",
          messageId: "gone-msg",
          conversationId: `${ACCOUNT}:ff`.repeat(1).slice(0, 64),
        },
      },
    ]);
  });

  it("redacts suppressed timeline events and replays projection", async () => {
    storeMocks.redactDmTimelineEvents.mockResolvedValue({ redactedCount: 1 });

    await reconcileDmDeleteSuppressionWithEventLog({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT,
      replayProjection: true,
    });

    expect(storeMocks.redactDmTimelineEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        messageIds: expect.arrayContaining(["gone-msg"]),
      }),
    );
    expect(projectionMocks.replay).toHaveBeenCalled();
  });
});
