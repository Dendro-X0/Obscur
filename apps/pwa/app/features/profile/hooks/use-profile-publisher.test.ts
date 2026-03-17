import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { profilePublisherInternals, useProfilePublisher } from "./use-profile-publisher";

const mocks = vi.hoisted(() => {
  const relayPool = {
    waitForConnection: vi.fn(async () => true),
    publishToAll: vi.fn(),
    sendToOpen: vi.fn(),
  };

  return {
    relayPool,
    enabledRelayUrls: ["wss://relay-1.example", "wss://relay-2.example"],
    toastWarning: vi.fn(),
    toastSuccess: vi.fn(),
    protocolPublishWithQuorum: vi.fn(),
    relayCorePublish: vi.fn(),
    mineEvent: vi.fn(async (event: unknown) => event),
    signEvent: vi.fn(async (event: any) => ({
      ...event,
      id: "signed-profile-event",
      sig: "sig",
    })),
    discoveryCacheUpsertProfile: vi.fn(),
    seedProfileMetadataCache: vi.fn(),
  };
});

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: "a".repeat(64),
      privateKeyHex: "b".repeat(64),
    },
    getIdentitySnapshot: () => ({
      publicKeyHex: "a".repeat(64),
      privateKeyHex: "b".repeat(64),
    }),
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: mocks.relayPool,
    enabledRelayUrls: mocks.enabledRelayUrls,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@dweb/ui-kit", () => ({
  toast: {
    warning: mocks.toastWarning,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: vi.fn(() => ({})),
  },
}));

vi.mock("@/app/features/settings/services/v090-rollout-policy", () => ({
  getV090RolloutPolicy: vi.fn(() => ({
    stabilityModeEnabled: false,
    deterministicDiscoveryEnabled: false,
    protocolCoreEnabled: false,
    x3dhRatchetEnabled: false,
  })),
}));

vi.mock("@/app/features/runtime/protocol-core-adapter", () => ({
  protocolCoreAdapter: {
    publishWithQuorum: mocks.protocolPublishWithQuorum,
  },
}));

vi.mock("@/app/features/relays/lib/nostr-core-relay", () => ({
  publishViaRelayCore: mocks.relayCorePublish,
}));

vi.mock("@/app/features/search/services/discovery-cache", () => ({
  discoveryCache: {
    upsertProfile: mocks.discoveryCacheUpsertProfile,
  },
}));

vi.mock("./use-profile-metadata", () => ({
  seedProfileMetadataCache: mocks.seedProfileMetadataCache,
}));

vi.mock("@/app/features/crypto/pow-service", () => ({
  powService: {
    mineEvent: mocks.mineEvent,
  },
}));

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    signEvent: mocks.signEvent,
  },
}));

describe("profilePublisherInternals.withTimeout", () => {
  it("resolves when operation completes before timeout", async () => {
    const result = await profilePublisherInternals.withTimeout(
      Promise.resolve("ok"),
      100,
      "timed out"
    );
    expect(result).toBe("ok");
  });

  it("rejects when operation exceeds timeout", async () => {
    const pending = new Promise<string>(() => {});
    await expect(
      profilePublisherInternals.withTimeout(pending, 25, "Timed out while publishing profile to relays")
    ).rejects.toThrow("Timed out while publishing profile to relays");
  });
});

describe("profilePublisherInternals relay degradation classification", () => {
  it("detects degraded relay failures", () => {
    expect(profilePublisherInternals.isDegradedFailure("No relays are currently connected")).toBe(true);
    expect(profilePublisherInternals.isDegradedFailure("Timed out while publishing profile to relays")).toBe(true);
    expect(profilePublisherInternals.isDegradedFailure("Unexpected signature error")).toBe(false);
  });

  it("detects partial relay success", () => {
    expect(profilePublisherInternals.isPartialRelaySuccess(1, 3)).toBe(true);
    expect(profilePublisherInternals.isPartialRelaySuccess(3, 3)).toBe(false);
    expect(profilePublisherInternals.isPartialRelaySuccess(0, 3)).toBe(false);
  });

  it("maps transport statuses to profile delivery categories", () => {
    expect(profilePublisherInternals.toDeliveryStatus("ok")).toBe("sent_quorum");
    expect(profilePublisherInternals.toDeliveryStatus("partial")).toBe("sent_partial");
    expect(profilePublisherInternals.toDeliveryStatus("queued")).toBe("queued");
    expect(profilePublisherInternals.toDeliveryStatus("failed")).toBe("failed");
  });
});

describe("useProfilePublisher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabledRelayUrls = ["wss://relay-1.example", "wss://relay-2.example"];
    mocks.relayPool.waitForConnection.mockResolvedValue(true);
    mocks.relayPool.publishToAll = vi.fn();
    mocks.relayPool.publishToAll.mockResolvedValue({
      success: true,
      successCount: 2,
      totalRelays: 2,
      results: [
        { relayUrl: "wss://relay-1.example", success: true },
        { relayUrl: "wss://relay-2.example", success: true },
      ],
    });
    mocks.protocolPublishWithQuorum.mockResolvedValue({
      ok: false,
      reason: "unsupported",
      message: "protocol disabled",
    });
    mocks.relayCorePublish.mockResolvedValue({
      status: "ok",
      value: {
        successCount: 2,
        totalRelays: 2,
        quorumRequired: 1,
        metQuorum: true,
        failures: [],
      },
      message: "Delivered to quorum relays.",
    });
  });

  it("records partial success with deterministic delivery status", async () => {
    mocks.relayCorePublish.mockResolvedValue({
      status: "partial",
      value: {
        successCount: 1,
        totalRelays: 2,
        quorumRequired: 2,
        metQuorum: false,
        failures: [{ relayUrl: "wss://relay-2.example", error: "503" }],
      },
      reasonCode: "quorum_not_met",
      message: "Partially delivered (1/2).",
    });

    const { result } = renderHook(() => useProfilePublisher());

    await act(async () => {
      const success = await result.current.publishProfile({
        username: "alice",
        about: "builder",
      });
      expect(success).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("success");
    });
    expect(result.current.lastReport?.deliveryStatus).toBe("sent_partial");
    expect(result.current.lastReport?.successCount).toBe(1);
    expect(mocks.toastWarning).toHaveBeenCalled();
    expect(mocks.discoveryCacheUpsertProfile).toHaveBeenCalledWith(expect.objectContaining({
      pubkey: "a".repeat(64),
      displayName: "alice",
      about: "builder",
    }));
    expect(mocks.seedProfileMetadataCache).toHaveBeenCalledWith(expect.objectContaining({
      pubkey: "a".repeat(64),
      displayName: "alice",
      about: "builder",
    }));
  });

  it("surfaces queued status when no writable relays are available", async () => {
    vi.useFakeTimers();
    mocks.relayCorePublish.mockResolvedValue({
      status: "queued",
      reasonCode: "no_writable_relays",
      message: "No writable relays available.",
    });

    const { result } = renderHook(() => useProfilePublisher());

    let publishResult = false;
    await act(async () => {
      const promise = result.current.publishProfile({
        username: "alice",
      });
      await vi.runAllTimersAsync();
      publishResult = await promise;
    });

    expect(publishResult).toBe(false);
    expect(result.current.phase).toBe("error");
    expect(result.current.lastReport?.deliveryStatus).toBe("queued");
    expect(result.current.getLastReportSnapshot()?.deliveryStatus).toBe("queued");
    expect(result.current.error).toContain("No writable relays available");
    vi.useRealTimers();
  });

  it("captures retryable relay timeout as queued degraded state", async () => {
    mocks.relayCorePublish.mockResolvedValue({
      status: "queued",
      reasonCode: "relay_degraded",
      message: "Timeout waiting for OK response",
      value: {
        successCount: 0,
        totalRelays: 1,
        quorumRequired: 1,
        metQuorum: false,
        failures: [{ relayUrl: "wss://relay-1.example", error: "Timeout waiting for OK response" }],
      },
    });

    const { result } = renderHook(() => useProfilePublisher());

    await act(async () => {
      const success = await result.current.publishProfile({
        username: "alice",
      });
      expect(success).toBe(false);
    });

    expect(result.current.lastReport?.deliveryStatus).toBe("queued");
    expect(result.current.getLastReportSnapshot()?.message).toContain("Timeout waiting for OK response");
  });

  it("fails when runtime has no evidence-backed publish transport", async () => {
    mocks.relayCorePublish.mockResolvedValue({
      status: "unsupported",
      reasonCode: "unsupported_runtime",
      message: "unsupported",
    });
    mocks.relayPool.publishToAll = undefined as any;

    const { result } = renderHook(() => useProfilePublisher());

    await act(async () => {
      const success = await result.current.publishProfile({
        username: "alice",
      });
      expect(success).toBe(false);
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.lastReport?.deliveryStatus).toBe("failed");
    expect(result.current.error).toContain("evidence-backed profile publish APIs");
  });

  it("syncs profile caches after evidence-backed quorum publish success", async () => {
    const { result } = renderHook(() => useProfilePublisher());

    await act(async () => {
      const success = await result.current.publishProfile({
        username: "alice",
        avatarUrl: "https://cdn.example.com/avatar.png",
        about: "builder",
        nip05: "alice@example.com",
        inviteCode: "hello-123",
      });
      expect(success).toBe(true);
    });

    expect(mocks.discoveryCacheUpsertProfile).toHaveBeenCalledWith({
      pubkey: "a".repeat(64),
      name: "alice",
      displayName: "alice",
      about: "builder",
      picture: "https://cdn.example.com/avatar.png",
      nip05: "alice@example.com",
      inviteCode: "HELLO-123",
    });
    expect(mocks.seedProfileMetadataCache).toHaveBeenCalledWith({
      pubkey: "a".repeat(64),
      displayName: "alice",
      avatarUrl: "https://cdn.example.com/avatar.png",
      about: "builder",
      nip05: "alice@example.com",
    });
  });

  it("normalizes invite code before publishing profile metadata", async () => {
    const { result } = renderHook(() => useProfilePublisher());

    await act(async () => {
      const success = await result.current.publishProfile({
        username: "alice",
        about: "builder",
        inviteCode: " obscur-a1b2c ",
      });
      expect(success).toBe(true);
    });

    const unsignedEvent = mocks.mineEvent.mock.calls[0]?.[0] as {
      tags: string[][];
      content: string;
    };
    expect(unsignedEvent.tags).toContainEqual(["code", "OBSCUR-A1B2C"]);
    expect(unsignedEvent.tags).toContainEqual(["i", "OBSCUR-A1B2C"]);
    expect(JSON.parse(unsignedEvent.content).about).toContain("OBSCUR-A1B2C");
    expect(mocks.discoveryCacheUpsertProfile).toHaveBeenCalledWith(expect.objectContaining({
      inviteCode: "OBSCUR-A1B2C",
    }));
  });
});
