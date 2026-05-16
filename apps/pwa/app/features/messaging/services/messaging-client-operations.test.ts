import { beforeEach, describe, expect, it, vi } from "vitest";

const gatewayMocks = vi.hoisted(() => ({
  executeDeleteForMe: vi.fn(async () => ["msg-1"]),
  persistSuppressionStores: vi.fn(async () => ["msg-2"]),
  prepareThreadSuppressionIds: vi.fn(async () => new Set(["seed"])),
  hydrateThreadReadModel: vi.fn(async () => ({
    finalMessages: [],
    hasEarlier: false,
    projectionFallbackHydration: false,
    authorityDiagnosticKey: "test",
  })),
  buildProjectionEvidenceMessages: vi.fn(() => []),
  mergeProjectionWithLiveOverlay: vi.fn(() => ({
    retentionFilteredNextMessages: [],
    shouldCapToLiveWindow: false,
    mergedMessageCount: 0,
    cappedMessageCount: 0,
  })),
  applyRealtimeBufferedEvents: vi.fn((_params: Readonly<{ previous: ReadonlyArray<unknown> }>) => _params.previous),
  loadEarlierMessages: vi.fn(async () => ({ messages: [], hasEarlier: false, didExpandHistory: false })),
  filterVisibleMessages: vi.fn((messages: ReadonlyArray<unknown>) => messages),
  reconcileAccountEventLog: vi.fn(async () => ({ redactedCount: 0, removedEventsAppended: 0 })),
  loadSuppressedMessageDeleteIds: vi.fn(() => new Set<string>()),
  isMessageDeleteSuppressed: vi.fn(() => false),
}));

vi.mock("@/app/features/profiles/services/resolve-client-gateway", () => ({
  getResolvedClientGateway: () => ({
    localDmVisibility: {
      executeDeleteForMe: gatewayMocks.executeDeleteForMe,
      persistSuppressionStores: gatewayMocks.persistSuppressionStores,
      filterVisibleMessages: gatewayMocks.filterVisibleMessages,
    },
    dmConversationMaterialization: {
      prepareThreadSuppressionIds: gatewayMocks.prepareThreadSuppressionIds,
      hydrateThreadReadModel: gatewayMocks.hydrateThreadReadModel,
      buildProjectionEvidenceMessages: gatewayMocks.buildProjectionEvidenceMessages,
      mergeProjectionWithLiveOverlay: gatewayMocks.mergeProjectionWithLiveOverlay,
      applyRealtimeBufferedEvents: gatewayMocks.applyRealtimeBufferedEvents,
      loadEarlierMessages: gatewayMocks.loadEarlierMessages,
    },
    messageDeleteTombstones: {
      loadSuppressedMessageDeleteIds: gatewayMocks.loadSuppressedMessageDeleteIds,
      isMessageDeleteSuppressed: gatewayMocks.isMessageDeleteSuppressed,
    },
  }),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-ops",
}));

import { messagingClientOperations } from "./messaging-client-operations";

describe("messagingClientOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes delete-for-me through localDmVisibility", async () => {
    await messagingClientOperations.deleteDmForMe({
      conversationId: "conv",
      messageIdentityIds: ["msg-1"],
      accountPublicKeyHex: "aa".repeat(32),
      profileId: "profile-ops",
    });
    expect(gatewayMocks.executeDeleteForMe).toHaveBeenCalled();
  });

  it("routes message-bus suppression through persistSuppressionStores", async () => {
    await messagingClientOperations.recordMessageBusDeletedIdentities({
      conversationId: "conv",
      messageIdentityIds: ["msg-2"],
    });
    expect(gatewayMocks.persistSuppressionStores).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv", profileId: "profile-ops" }),
    );
  });
});
