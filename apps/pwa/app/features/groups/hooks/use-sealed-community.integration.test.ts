import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

import { useLegacySealedCommunity } from "./sealed-community-port";

/**
 * Legacy stub hook integration — relay ingest subtracted (Path B B1-2).
 * Relay timeline ingress: useGroupThreadRelayIngest + ingestSealedCommunityRelayEvent.
 */
describe("use-sealed-community legacy stub integration", () => {
  const scopedRelay = "wss://relay.example";
  const groupId = "group-alpha";
  const actor = "actor-pubkey" as PublicKeyHex;
  const peer = "peer-pubkey" as PublicKeyHex;

  const createPool = () => ({
    sendToOpen: vi.fn(),
    subscribeToMessages: vi.fn(() => vi.fn()),
    subscribe: vi.fn(() => "sub-id"),
    unsubscribe: vi.fn(),
    publishToAll: vi.fn(async () => ({
      success: true,
      successCount: 1,
      totalRelays: 1,
      results: [{ success: true, relayUrl: scopedRelay }],
    })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds restored initialMembers on first mount", async () => {
    const pool = createPool();

    const { result } = renderHook(() => useLegacySealedCommunity({
      pool: pool as never,
      relayUrl: scopedRelay,
      groupId,
      myPublicKeyHex: actor,
      myPrivateKeyHex: "private-key" as never,
      enabled: true,
      initialMembers: [actor, peer],
    }));

    await waitFor(() => {
      expect([...result.current.members].sort()).toEqual([actor, peer].sort());
    });
  });

  it("backfills initialMembers when provider catch-up arrives after mount", async () => {
    const pool = createPool();

    const { result, rerender } = renderHook((hookParams: Readonly<{
      initialMembers: ReadonlyArray<PublicKeyHex>;
    }>) => useLegacySealedCommunity({
      pool: pool as never,
      relayUrl: scopedRelay,
      groupId,
      myPublicKeyHex: actor,
      myPrivateKeyHex: "private-key" as never,
      enabled: true,
      initialMembers: hookParams.initialMembers,
    }), {
      initialProps: {
        initialMembers: [actor] as ReadonlyArray<PublicKeyHex>,
      },
    });

    await waitFor(() => {
      expect([...result.current.members].sort()).toEqual([actor].sort());
    });

    rerender({
      initialMembers: [actor, peer] as ReadonlyArray<PublicKeyHex>,
    });

    await waitFor(() => {
      expect([...result.current.members].sort()).toEqual([actor, peer].sort());
    });
  });

  it("keeps subtracted sendMessage as a no-op", async () => {
    const pool = createPool();

    const { result } = renderHook(() => useLegacySealedCommunity({
      pool: pool as never,
      relayUrl: scopedRelay,
      groupId,
      myPublicKeyHex: actor,
      myPrivateKeyHex: "private-key" as never,
      enabled: true,
      initialMembers: [actor],
    }));

    await expect(result.current.sendMessage({ content: "hello" })).resolves.toBeUndefined();
    expect(pool.publishToAll).not.toHaveBeenCalled();
  });
});
