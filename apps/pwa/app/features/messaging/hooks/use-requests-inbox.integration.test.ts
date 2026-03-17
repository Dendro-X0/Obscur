import { act, renderHook, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { requestsInboxInternals, useRequestsInbox } from "./use-requests-inbox";

const SELF = "a".repeat(64) as PublicKeyHex;
const PEER_B = "b".repeat(64) as PublicKeyHex;
const PEER_C = "c".repeat(64) as PublicKeyHex;

const inboxMocks = vi.hoisted(() => ({
  chatStateStore: {
    load: vi.fn(() => null),
    updateConnectionRequests: vi.fn(),
  },
}));

vi.mock("@/app/features/messaging/services/chat-state-store", () => ({
  chatStateStoreService: inboxMocks.chatStateStore,
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
  useAccountProjectionSnapshot: () => ({
    profileId: "default",
    accountPublicKeyHex: "a".repeat(64),
    projection: null,
    phase: "ready",
    status: "ready",
    accountProjectionReady: true,
    driftStatus: "clean",
    updatedAtUnixMs: Date.now(),
  }),
}));

vi.mock("@/app/features/account-sync/services/account-projection-read-authority", () => ({
  resolveProjectionReadAuthority: () => ({
    useProjectionReads: false,
    reason: "shadow_mode",
    policy: {
      phase: "shadow",
      rollbackEnabled: true,
      updatedAtUnixMs: Date.now(),
    },
    criticalDriftCount: 0,
  }),
}));

describe("useRequestsInbox integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps accepted status records for multiple peers without collapsing to one handled entry", async () => {
    const { result } = renderHook(() => useRequestsInbox({ publicKeyHex: SELF }));
    await waitFor(() => expect(result.current.hasHydrated).toBe(true));

    act(() => {
      result.current.setStatus({
        peerPublicKeyHex: PEER_B,
        status: "accepted",
        isOutgoing: false,
      });
    });

    act(() => {
      result.current.setStatus({
        peerPublicKeyHex: PEER_C,
        status: "accepted",
        isOutgoing: false,
      });
    });

    act(() => {
      result.current.setStatus({
        peerPublicKeyHex: PEER_B,
        status: "accepted",
      });
    });

    const acceptedPeers = result.current.state.items
      .filter((entry) => entry.status === "accepted")
      .map((entry) => entry.peerPublicKeyHex)
      .sort();

    expect(acceptedPeers).toEqual([PEER_B, PEER_C].sort());
  });

  it("stabilizes when an effect repeatedly mirrors accepted statuses from inbox state", async () => {
    const { result } = renderHook(() => {
      const inbox = useRequestsInbox({ publicKeyHex: SELF });

      useEffect(() => {
        if (!inbox.hasHydrated) {
          return;
        }
        inbox.state.items
          .filter((entry) => entry.status === "accepted")
          .forEach((entry) => {
            inbox.setStatus({
              peerPublicKeyHex: entry.peerPublicKeyHex,
              status: "accepted",
              isOutgoing: entry.isOutgoing,
            });
          });
      }, [inbox.hasHydrated, inbox.setStatus, inbox.state.items]);

      return inbox;
    });

    await waitFor(() => expect(result.current.hasHydrated).toBe(true));

    act(() => {
      result.current.setStatus({
        peerPublicKeyHex: PEER_B,
        status: "accepted",
        isOutgoing: false,
      });
      result.current.setStatus({
        peerPublicKeyHex: PEER_C,
        status: "accepted",
        isOutgoing: false,
      });
    });

    await waitFor(() => {
      const accepted = result.current.state.items.filter((entry) => entry.status === "accepted");
      expect(accepted).toHaveLength(2);
    });
  });

  it("does not inflate unread count for repeated non-request pending-peer messages", async () => {
    const { result } = renderHook(() => useRequestsInbox({ publicKeyHex: SELF }));
    await waitFor(() => expect(result.current.hasHydrated).toBe(true));

    act(() => {
      result.current.upsertIncoming({
        peerPublicKeyHex: PEER_B,
        plaintext: "hello",
        createdAtUnixSeconds: 100,
        isRequest: false,
        status: "pending",
        eventId: "evt-1",
      });
      result.current.upsertIncoming({
        peerPublicKeyHex: PEER_B,
        plaintext: "hello again",
        createdAtUnixSeconds: 101,
        isRequest: false,
        status: "pending",
        eventId: "evt-2",
      });
      result.current.upsertIncoming({
        peerPublicKeyHex: PEER_B,
        plaintext: "hello third",
        createdAtUnixSeconds: 102,
        isRequest: false,
        status: "pending",
        eventId: "evt-3",
      });
    });

    const pendingItem = result.current.state.items.find((item) => item.peerPublicKeyHex === PEER_B);
    expect(pendingItem).toBeDefined();
    expect(pendingItem?.status).toBe("pending");
    expect(pendingItem?.unreadCount).toBe(1);
  });

  it("keeps repeated request retries from stacking unread count for one peer", async () => {
    const { result } = renderHook(() => useRequestsInbox({ publicKeyHex: SELF }));
    await waitFor(() => expect(result.current.hasHydrated).toBe(true));

    act(() => {
      result.current.upsertIncoming({
        peerPublicKeyHex: PEER_B,
        plaintext: "request 1",
        createdAtUnixSeconds: 200,
        isRequest: true,
        status: "pending",
        eventId: "evt-request-1",
        ingestSource: "relay_live",
      });
      result.current.upsertIncoming({
        peerPublicKeyHex: PEER_B,
        plaintext: "request 2",
        createdAtUnixSeconds: 201,
        isRequest: true,
        status: "pending",
        eventId: "evt-request-2",
        ingestSource: "relay_live",
      });
      result.current.upsertIncoming({
        peerPublicKeyHex: PEER_B,
        plaintext: "request 3",
        createdAtUnixSeconds: 202,
        isRequest: true,
        status: "pending",
        eventId: "evt-request-3",
        ingestSource: "relay_live",
      });
    });

    const pendingItem = result.current.state.items.find((item) => item.peerPublicKeyHex === PEER_B);
    expect(pendingItem).toBeDefined();
    expect(pendingItem?.status).toBe("pending");
    expect(pendingItem?.unreadCount).toBe(1);
  });

  it("does not mark historical relay_sync request backlog as unread", async () => {
    const { result } = renderHook(() => useRequestsInbox({ publicKeyHex: SELF }));
    await waitFor(() => expect(result.current.hasHydrated).toBe(true));

    act(() => {
      result.current.upsertIncoming({
        peerPublicKeyHex: PEER_B,
        plaintext: "old request",
        createdAtUnixSeconds: 100,
        observedAtUnixSeconds: 100 + requestsInboxInternals.HISTORICAL_SYNC_UNREAD_THRESHOLD_SECONDS + 1,
        isRequest: true,
        status: "pending",
        eventId: "evt-old-sync",
        ingestSource: "relay_sync",
      });
    });

    const pendingItem = result.current.state.items.find((item) => item.peerPublicKeyHex === PEER_B);
    expect(pendingItem).toBeDefined();
    expect(pendingItem?.status).toBe("pending");
    expect(pendingItem?.unreadCount).toBe(0);
  });
});
