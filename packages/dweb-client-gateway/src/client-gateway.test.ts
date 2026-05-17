import { describe, expect, it, vi } from "vitest";
import { buildClientGateway } from "./client-gateway";
import { DESKTOP_TAURI_CAPABILITIES } from "@dweb/storage-contracts/runtime-capabilities";

describe("client-gateway", () => {
  it("builds a gateway with explicit scope and ports", () => {
    const tombstones = {
      suppressMessageDeleteTombstone: vi.fn(),
      loadMessageDeleteTombstoneEntries: vi.fn(() => []),
      loadSuppressedMessageDeleteIds: vi.fn(() => new Set<string>()),
      replaceMessageDeleteTombstones: vi.fn(async () => {}),
      isMessageDeleteSuppressed: vi.fn(() => false),
      clearMessageDeleteTombstones: vi.fn(),
      liftMessageDeleteSuppression: vi.fn(),
      mergeMessageDeleteTombstonesFromIndexedDb: vi.fn(async () => {}),
      hydrateMessageDeleteTombstonesFromSqlite: vi.fn(async () => {}),
    };
    const visibility = {
      ensureReady: vi.fn(async () => {}),
      getSuppressedIdentityIds: vi.fn(() => new Set<string>()),
      filterVisibleMessages: vi.fn((messages) => messages),
      persistSuppressionStores: vi.fn(async () => []),
      reconcileAccountEventLog: vi.fn(async () => ({ redactedCount: 0, removedEventsAppended: 0 })),
      executeDeleteForMe: vi.fn(async () => []),
      executeShowAgainOnDevice: vi.fn(async () => []),
    };

    const gateway = buildClientGateway({
      profileId: "profile-a",
      publicKeyHex: "a".repeat(64),
      platform: "desktop",
      capabilities: DESKTOP_TAURI_CAPABILITIES,
      messageDeleteTombstones: tombstones,
      localDmVisibility: visibility,
    });

    expect(gateway.profileId).toBe("profile-a");
    expect(gateway.platform).toBe("desktop");
    expect(gateway.messageDeleteTombstones).toBe(tombstones);
    expect(gateway.localDmVisibility).toBe(visibility);
  });
});
