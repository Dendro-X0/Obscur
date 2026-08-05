import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { NostrEvent } from "@dweb/nostr/nostr-event";

const mocks = vi.hoisted(() => {
  const subscribe = vi.fn();
  const unsubscribe = vi.fn();
  return {
    useRelay: vi.fn(),
    getConnectionByPublicKey: vi.fn(),
    getProfile: vi.fn(),
    upsertProfile: vi.fn(),
    fetchLatestEventFromRelayUrls: vi.fn(),
    subscribe,
    unsubscribe,
  };
});

vi.mock("../../relays/providers/relay-provider", () => ({
  useRelay: mocks.useRelay,
}));

vi.mock("../../invites/utils/connection-store", () => ({
  connectionStore: {
    getConnectionByPublicKey: mocks.getConnectionByPublicKey,
  },
}));

vi.mock("@/app/features/search/services/discovery-cache", () => ({
  discoveryCache: {
    getProfile: mocks.getProfile,
    upsertProfile: mocks.upsertProfile,
  },
}));

vi.mock("@/app/features/account-sync/services/direct-relay-query", () => ({
  fetchLatestEventFromRelayUrls: mocks.fetchLatestEventFromRelayUrls,
}));

import { seedProfileMetadataCache, clearProfileMetadataCache, useProfileMetadata } from "./use-profile-metadata";

describe("useProfileMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProfileMetadataCache();
    mocks.useRelay.mockReturnValue({
      relayPool: {
        subscribe: mocks.subscribe.mockImplementation(() => "sub-1"),
        unsubscribe: mocks.unsubscribe,
        connections: [{ url: "wss://relay.example", status: "open" }],
      },
      enabledRelayUrls: ["wss://relay.example"],
    });
    mocks.getConnectionByPublicKey.mockResolvedValue(null);
    mocks.getProfile.mockReturnValue(null);
    mocks.fetchLatestEventFromRelayUrls.mockResolvedValue(null);
  });

  it("upgrades incomplete cached discovery data with direct relay metadata", async () => {
    const pubkey = "f".repeat(64);
    mocks.getProfile.mockReturnValue({
      pubkey,
      displayName: "TestUser",
      updatedAtUnixMs: Date.now(),
    });
    const event: NostrEvent = {
      id: "event-id",
      pubkey,
      created_at: 10,
      kind: 0,
      tags: [],
      content: JSON.stringify({
        name: "TestUser",
        about: "A Test Account",
        picture: "https://cdn.example.com/avatar.png",
      }),
      sig: "sig",
    };
    mocks.fetchLatestEventFromRelayUrls.mockResolvedValue(event);

    const { result } = renderHook(() => useProfileMetadata(pubkey));

    await waitFor(() => {
      expect(result.current).toEqual({
        pubkey,
        displayName: "TestUser",
        about: "A Test Account",
        avatarUrl: "https://cdn.example.com/avatar.png",
        nip05: undefined,
      });
    });

    expect(mocks.fetchLatestEventFromRelayUrls).toHaveBeenCalledWith({
      relayUrls: ["wss://relay.example"],
      filters: [{ kinds: [0], authors: [pubkey], limit: 1 }],
      matcher: expect.any(Function),
    });
    expect(mocks.upsertProfile).toHaveBeenCalledWith(expect.objectContaining({
      pubkey,
      displayName: "TestUser",
      about: "A Test Account",
      picture: "https://cdn.example.com/avatar.png",
    }));
  });

  it("seeds both in-memory and discovery caches", () => {
    const pubkey = "a".repeat(64);
    seedProfileMetadataCache({
      pubkey,
      displayName: "Seeded User",
      about: "Seeded profile",
      avatarUrl: "/uploads/avatar.png",
      nip05: "seeded@example.com",
    });

    expect(mocks.upsertProfile).toHaveBeenCalledWith({
      pubkey,
      displayName: "Seeded User",
      about: "Seeded profile",
      picture: `${window.location.origin}/uploads/avatar.png`,
      nip05: "seeded@example.com",
    });
  });

  it("skips relay subscription and direct fetch in cache-only mode", async () => {
    const pubkey = "b".repeat(64);
    mocks.getProfile.mockReturnValue({
      pubkey,
      displayName: "Cached User",
      updatedAtUnixMs: Date.now(),
    });

    const { result } = renderHook(() => useProfileMetadata(pubkey, { live: false }));

    await waitFor(() => {
      expect(result.current?.displayName).toBe("Cached User");
    });

    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.fetchLatestEventFromRelayUrls).not.toHaveBeenCalled();
    expect(mocks.getConnectionByPublicKey).not.toHaveBeenCalled();
  });

  it("does not rewrite discovery cache when metadata is unchanged on rerender", async () => {
    const pubkey = "c".repeat(64);
    mocks.getProfile.mockReturnValue({
      pubkey,
      displayName: "Stable User",
      picture: "https://cdn.example.com/a.png",
      updatedAtUnixMs: Date.now(),
    });
    seedProfileMetadataCache({
      pubkey,
      displayName: "Stable User",
      avatarUrl: "https://cdn.example.com/a.png",
    });
    mocks.upsertProfile.mockClear();

    const { rerender } = renderHook(() => useProfileMetadata(pubkey, { live: false }));

    await waitFor(() => {
      expect(mocks.getProfile).toHaveBeenCalled();
    });

    rerender();
    rerender();

    expect(mocks.upsertProfile).not.toHaveBeenCalled();
  });

  it("M1: retries kind-0 hydrate after empty fetch (backoff)", async () => {
    vi.useFakeTimers();
    try {
      const pubkey = "d".repeat(64);
      const event: NostrEvent = {
        id: "retry-event",
        pubkey,
        created_at: 20,
        kind: 0,
        tags: [],
        content: JSON.stringify({ name: "Retried User" }),
        sig: "sig",
      };
      mocks.fetchLatestEventFromRelayUrls
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(event);

      const { result } = renderHook(() => useProfileMetadata(pubkey));

      await vi.waitFor(() => {
        expect(mocks.fetchLatestEventFromRelayUrls).toHaveBeenCalledTimes(1);
      });

      await vi.advanceTimersByTimeAsync(2_000);

      await vi.waitFor(() => {
        expect(mocks.fetchLatestEventFromRelayUrls).toHaveBeenCalledTimes(2);
        expect(result.current?.displayName).toBe("Retried User");
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("M1: retries immediately when open relay count recovers", async () => {
    const pubkey = "e".repeat(64);
    const event: NostrEvent = {
      id: "recovery-event",
      pubkey,
      created_at: 30,
      kind: 0,
      tags: [],
      content: JSON.stringify({ name: "Recovered User" }),
      sig: "sig",
    };
    mocks.fetchLatestEventFromRelayUrls
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(event);

    mocks.useRelay.mockReturnValue({
      relayPool: {
        subscribe: mocks.subscribe.mockImplementation(() => "sub-1"),
        unsubscribe: mocks.unsubscribe,
        connections: [{ url: "wss://relay.example", status: "connecting" }],
      },
      enabledRelayUrls: ["wss://relay.example"],
    });

    const { result, rerender } = renderHook(() => useProfileMetadata(pubkey));

    await waitFor(() => {
      expect(mocks.fetchLatestEventFromRelayUrls).toHaveBeenCalledTimes(1);
    });

    mocks.useRelay.mockReturnValue({
      relayPool: {
        subscribe: mocks.subscribe.mockImplementation(() => "sub-1"),
        unsubscribe: mocks.unsubscribe,
        connections: [{ url: "wss://relay.example", status: "open" }],
      },
      enabledRelayUrls: ["wss://relay.example"],
    });
    rerender();

    await waitFor(() => {
      expect(mocks.fetchLatestEventFromRelayUrls).toHaveBeenCalledTimes(2);
      expect(result.current?.displayName).toBe("Recovered User");
    });
  });
});
