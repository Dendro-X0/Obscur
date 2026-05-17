import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { enhancedDmControllerInternals } from "./enhanced-dm-controller";

describe("enhanced-dm-controller pending request guard", () => {
  it("treats old outgoing pending status as stale", () => {
    const now = Date.now();
    const stale = enhancedDmControllerInternals.isStaleOutgoingPendingRequestState(
      {
        status: "pending",
        isOutgoing: true,
        lastReceivedAtUnixSeconds: Math.floor((now - enhancedDmControllerInternals.PENDING_REQUEST_STALE_MS - 1_000) / 1000),
      },
      undefined,
      now
    );
    expect(stale).toBe(true);
  });

  it("does not treat fresh outgoing pending as stale", () => {
    const now = Date.now();
    const stale = enhancedDmControllerInternals.isStaleOutgoingPendingRequestState(
      {
        status: "pending",
        isOutgoing: true,
        lastReceivedAtUnixSeconds: Math.floor((now - 30_000) / 1000),
      },
      undefined,
      now
    );
    expect(stale).toBe(false);
  });

  it("never treats incoming pending as stale for resend bypass", () => {
    const now = Date.now();
    const stale = enhancedDmControllerInternals.isStaleOutgoingPendingRequestState(
      {
        status: "pending",
        isOutgoing: false,
        lastReceivedAtUnixSeconds: Math.floor((now - enhancedDmControllerInternals.PENDING_REQUEST_STALE_MS - 60_000) / 1000),
      },
      undefined,
      now
    );
    expect(stale).toBe(false);
  });

  it("treats outgoing pending with missing timestamp as stale", () => {
    const stale = enhancedDmControllerInternals.isStaleOutgoingPendingRequestState(
      {
        status: "pending",
        isOutgoing: true,
      },
      undefined,
      Date.now()
    );
    expect(stale).toBe(true);
  });

  it("requires explicit delivery evidence before marking request pending", () => {
    const noEvidence = enhancedDmControllerInternals.hasRequestDeliveryEvidence({
      success: true,
      messageId: "m1",
      relayResults: [],
    });
    expect(noEvidence).toBe(false);

    const withPartialEvidence = enhancedDmControllerInternals.hasRequestDeliveryEvidence({
      success: false,
      deliveryStatus: "sent_partial",
      messageId: "m2",
      relayResults: [],
    });
    expect(withPartialEvidence).toBe(true);
  });

  it("runs transport safety sync only when transport is active, visible, and connected", () => {
    const myPublicKeyHex = "a".repeat(64) as PublicKeyHex;
    expect(enhancedDmControllerInternals.shouldRunTransportSafetySync({
      incomingTransportEnabled: true,
      myPublicKeyHex,
      poolConnections: [{ status: "open" }],
      isSyncing: false,
      visibilityState: "visible",
    })).toBe(true);

    expect(enhancedDmControllerInternals.shouldRunTransportSafetySync({
      incomingTransportEnabled: true,
      myPublicKeyHex,
      poolConnections: [{ status: "open" }],
      isSyncing: true,
      visibilityState: "visible",
    })).toBe(false);

    expect(enhancedDmControllerInternals.shouldRunTransportSafetySync({
      incomingTransportEnabled: true,
      myPublicKeyHex,
      poolConnections: [{ status: "closed" }],
      isSyncing: false,
      visibilityState: "visible",
    })).toBe(false);

    expect(enhancedDmControllerInternals.shouldRunTransportSafetySync({
      incomingTransportEnabled: true,
      myPublicKeyHex,
      poolConnections: [{ status: "open" }],
      isSyncing: false,
      visibilityState: "hidden",
    })).toBe(false);
  });

  it("forces full relay-coverage backfill when open relay count expands after partial cold-start", () => {
    expect(enhancedDmControllerInternals.shouldForceFullRelayCoverageBackfill({
      coldStartPartialCoverageDetected: true,
      coldStartHistoricalBackfillRelayCount: 1,
      openRelayCount: 2,
    })).toBe(true);

    expect(enhancedDmControllerInternals.shouldForceFullRelayCoverageBackfill({
      coldStartPartialCoverageDetected: true,
      coldStartHistoricalBackfillRelayCount: 2,
      openRelayCount: 2,
    })).toBe(false);

    expect(enhancedDmControllerInternals.shouldForceFullRelayCoverageBackfill({
      coldStartPartialCoverageDetected: false,
      coldStartHistoricalBackfillRelayCount: 1,
      openRelayCount: 3,
    })).toBe(false);
  });
});
