import { describe, expect, it } from "vitest";

import {
  deriveRequestProjection,
  isRetryEligiblePendingOutgoingRequest,
  REQUEST_RESEND_GRACE_MS,
} from "./request-status-projection";

describe("request-status-projection", () => {
  it("keeps sender in sent_waiting before resend grace expires but still allows manual resend", () => {
    const nowUnixMs = 200_000;
    const projection = deriveRequestProjection({
      requestStatus: {
        status: "pending",
        isOutgoing: true,
        lastReceivedAtUnixSeconds: Math.floor((nowUnixMs - 15_000) / 1000),
      },
      evidence: {
        requestEventId: "req-1",
        receiptAckSeen: false,
        acceptSeen: false,
        lastEvidenceUnixMs: nowUnixMs - 15_000,
      },
      nowUnixMs,
    });

    expect(projection.state).toBe("sent_waiting");
    expect(projection.canSend).toBe(true);
  });

  it("makes sender retry-eligible after resend grace without recipient evidence", () => {
    const nowUnixMs = 300_000;
    expect(isRetryEligiblePendingOutgoingRequest({
      requestStatus: {
        status: "pending",
        isOutgoing: true,
        lastReceivedAtUnixSeconds: Math.floor((nowUnixMs - REQUEST_RESEND_GRACE_MS - 5_000) / 1000),
      },
      evidence: {
        requestEventId: "req-2",
        receiptAckSeen: false,
        acceptSeen: false,
        lastEvidenceUnixMs: nowUnixMs - REQUEST_RESEND_GRACE_MS - 5_000,
      },
      nowUnixMs,
    })).toBe(true);
  });

  it("treats receipt ack as recipient_seen but still allows explicit resend", () => {
    const projection = deriveRequestProjection({
      requestStatus: {
        status: "pending",
        isOutgoing: true,
        lastReceivedAtUnixSeconds: Math.floor(Date.now() / 1000),
      },
      evidence: {
        requestEventId: "req-3",
        receiptAckSeen: true,
        acceptSeen: false,
        lastEvidenceUnixMs: Date.now(),
      },
    });

    expect(projection.state).toBe("recipient_seen");
    expect(projection.canSend).toBe(true);
    expect(projection.shouldDisablePrimaryAction).toBe(false);
  });
});
