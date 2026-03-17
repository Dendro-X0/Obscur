import { describe, expect, it } from "vitest";

import { requestsInboxInternals } from "./use-requests-inbox";

describe("useRequestsInbox internals", () => {
  it("maps accepted status to ACCEPT instead of synthesizing pending", () => {
    expect(requestsInboxInternals.toHandshakeEvent("accepted", false)).toEqual({ type: "ACCEPT" });
  });

  it("maps outgoing pending status to SEND_REQUEST", () => {
    expect(requestsInboxInternals.toHandshakeEvent("pending", true)).toEqual({ type: "SEND_REQUEST" });
  });

  it("promotes none -> accepted when trust evidence arrives without a pending request", () => {
    expect(requestsInboxInternals.resolveNextHandshakeState({
      currentState: { status: "none", isOutgoing: false },
      status: "accepted",
      isOutgoing: false,
    })).toEqual({ status: "accepted", isOutgoing: false });
  });

  it("detects idempotent status updates and avoids redundant writes", () => {
    const item = {
      peerPublicKeyHex: "1".repeat(64),
      status: "accepted",
      isOutgoing: false,
      lastMessagePreview: "",
      lastReceivedAtUnixSeconds: 10,
      unreadCount: 0,
    } as const;
    expect(requestsInboxInternals.shouldApplyStatusUpdate({
      item,
      nextState: { status: "accepted", isOutgoing: false },
    })).toBe(false);
    expect(requestsInboxInternals.shouldApplyStatusUpdate({
      item,
      nextState: { status: "pending", isOutgoing: false },
    })).toBe(true);
  });

  it("releases stale outgoing pending requests without receipt evidence", () => {
    const staleItem = {
      peerPublicKeyHex: "a".repeat(64),
      status: "pending",
      isOutgoing: true,
      lastMessagePreview: "",
      lastReceivedAtUnixSeconds: Math.floor((Date.now() - requestsInboxInternals.REQUEST_PENDING_STALE_MS - 1000) / 1000),
      unreadCount: 0,
    } as const;

    expect(requestsInboxInternals.shouldReleaseOutgoingPendingRequest(staleItem)).toBe(true);
  });

  it("keeps fresh outgoing pending requests even before request-event evidence is restored", () => {
    const freshItem = {
      peerPublicKeyHex: "d".repeat(64),
      status: "pending",
      isOutgoing: true,
      lastMessagePreview: "",
      lastReceivedAtUnixSeconds: Math.floor((Date.now() - 15_000) / 1000),
      unreadCount: 0,
    } as const;

    expect(requestsInboxInternals.shouldReleaseOutgoingPendingRequest(freshItem)).toBe(false);
  });

  it("treats stale outgoing pending requests as removable when a real incoming request arrives", () => {
    const staleItem = {
      peerPublicKeyHex: "b".repeat(64),
      status: "pending",
      isOutgoing: true,
      lastMessagePreview: "",
      lastReceivedAtUnixSeconds: Math.floor((Date.now() - requestsInboxInternals.REQUEST_PENDING_STALE_MS - 1000) / 1000),
      unreadCount: 0,
    } as const;

    expect(requestsInboxInternals.resolveExistingRequestForIncoming(staleItem)).toBeUndefined();
  });

  it("allows refreshing an existing pending request when new wire evidence arrives", () => {
    const existingPending = {
      peerPublicKeyHex: "e".repeat(64),
      status: "pending",
      isOutgoing: false,
      lastMessagePreview: "old",
      lastReceivedAtUnixSeconds: 100,
      unreadCount: 1,
      eventId: "old-event",
    } as const;

    expect(
      requestsInboxInternals.shouldIgnoreIncomingForExistingRequest(
        existingPending,
        99,
        "new-event"
      )
    ).toBe(false);
  });

  it("ignores stale duplicate incoming evidence for an existing pending request", () => {
    const existingPending = {
      peerPublicKeyHex: "f".repeat(64),
      status: "pending",
      isOutgoing: false,
      lastMessagePreview: "old",
      lastReceivedAtUnixSeconds: 100,
      unreadCount: 1,
      eventId: "same-event",
    } as const;

    expect(
      requestsInboxInternals.shouldIgnoreIncomingForExistingRequest(
        existingPending,
        99,
        "same-event"
      )
    ).toBe(true);
  });

  it("normalizes refreshed pending-request timestamps to observed time when wire timestamp is stale", () => {
    const existingPending = {
      peerPublicKeyHex: "f".repeat(64),
      status: "pending",
      isOutgoing: false,
      lastMessagePreview: "old",
      lastReceivedAtUnixSeconds: 1_000,
      unreadCount: 1,
      eventId: "same-event",
      isRequest: true,
    } as const;

    const normalized = requestsInboxInternals.resolveIncomingTimestampForExistingRequest(
      existingPending,
      900,
      "new-event",
      true,
      2_000
    );
    const unchanged = requestsInboxInternals.resolveIncomingTimestampForExistingRequest(
      existingPending,
      900,
      "new-event",
      false,
      2_000
    );

    expect(normalized).toBe(2_000);
    expect(unchanged).toBe(900);
  });

  it("uses observed local time for new request inbox timeline entries", () => {
    expect(
      requestsInboxInternals.resolveIncomingInboxTimelineTimestamp({
        createdAtUnixSeconds: 100,
        observedAtUnixSeconds: 2_000,
        isRequest: true,
      })
    ).toBe(2_000);
    expect(
      requestsInboxInternals.resolveIncomingInboxTimelineTimestamp({
        createdAtUnixSeconds: 100,
        observedAtUnixSeconds: 2_000,
        isRequest: false,
      })
    ).toBe(100);
  });

  it("suppresses unread bumps for historical relay_sync request events", () => {
    expect(requestsInboxInternals.shouldSuppressUnreadForHistoricalSync({
      ingestSource: "relay_sync",
      createdAtUnixSeconds: 100,
      observedAtUnixSeconds: 100 + requestsInboxInternals.HISTORICAL_SYNC_UNREAD_THRESHOLD_SECONDS + 1,
    })).toBe(true);
    expect(requestsInboxInternals.shouldSuppressUnreadForHistoricalSync({
      ingestSource: "relay_sync",
      createdAtUnixSeconds: 100,
      observedAtUnixSeconds: 100 + requestsInboxInternals.HISTORICAL_SYNC_UNREAD_THRESHOLD_SECONDS,
    })).toBe(false);
    expect(requestsInboxInternals.shouldSuppressUnreadForHistoricalSync({
      ingestSource: "relay_live",
      createdAtUnixSeconds: 100,
      observedAtUnixSeconds: 10_000,
    })).toBe(false);
  });

  it("merges hydrated request state without dropping newer live incoming items", () => {
    const merged = requestsInboxInternals.mergeHydratedRequestsInboxItems(
      [
        {
          peerPublicKeyHex: "c".repeat(64),
          status: "pending",
          isOutgoing: false,
          lastMessagePreview: "live incoming",
          lastReceivedAtUnixSeconds: 200,
          unreadCount: 1,
          eventId: "live-event",
        },
      ],
      [
        {
          peerPublicKeyHex: "c".repeat(64),
          status: "pending",
          isOutgoing: false,
          lastMessagePreview: "persisted older",
          lastReceivedAtUnixSeconds: 100,
          unreadCount: 0,
          eventId: "persisted-event",
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.lastMessagePreview).toBe("live incoming");
    expect(merged[0]?.lastReceivedAtUnixSeconds).toBe(200);
    expect(merged[0]?.eventId).toBe("live-event");
  });
});
