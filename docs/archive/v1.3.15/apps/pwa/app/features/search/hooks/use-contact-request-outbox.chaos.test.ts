import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ContactRequestRecord } from "@/app/features/search/types/discovery";
import { requestFlowEvidenceStore } from "@/app/features/messaging/services/request-flow-evidence-store";
import { contactRequestOutboxInternals } from "./use-contact-request-outbox";

const PEER = "c".repeat(64) as PublicKeyHex;

const BASE_RECORD: ContactRequestRecord = {
  id: "req-chaos-1",
  peerPubkey: PEER,
  status: "queued",
  retries: 0,
  createdAtUnixMs: 1_000,
  updatedAtUnixMs: 1_000,
};

describe("contact request outbox chaos reliability", () => {
  beforeEach(() => {
    localStorage.clear();
    requestFlowEvidenceStore.clear(PEER);
  });

  it("keeps retry schedule forward-only under transient relay flap and stops at retry budget", () => {
    let record: ContactRequestRecord = {
      ...BASE_RECORD,
      status: "failed",
      retries: 0,
      nextRetryAtUnixMs: undefined,
    };
    let nowUnixMs = 10_000;
    let previousNextRetryAt = 0;
    const maxAttempts = contactRequestOutboxInternals.MAX_REQUEST_RETRY_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const updated = contactRequestOutboxInternals.applySendResultToOutboxRecord(
        record,
        {
          success: false,
          relayResults: [{ relayUrl: "wss://relay.flap", success: false, error: "timeout" }],
          error: "relay timeout",
          failureReason: "no_active_relays",
        },
        nowUnixMs
      );

      if (attempt < maxAttempts) {
        expect(updated.status).toBe("failed");
        expect(updated.retries).toBe(attempt);
        expect(updated.failureReason).toBe("no_active_relays");
        expect(updated.nextRetryAtUnixMs).toBeTypeOf("number");
        expect(updated.nextRetryAtUnixMs!).toBeGreaterThan(nowUnixMs);
        expect(updated.nextRetryAtUnixMs!).toBeGreaterThan(previousNextRetryAt);
        previousNextRetryAt = updated.nextRetryAtUnixMs!;
        nowUnixMs = updated.nextRetryAtUnixMs! + 1;
      } else {
        expect(updated.status).toBe("failed");
        expect(updated.retries).toBe(maxAttempts);
        expect(updated.failureReason).toBe("max_retries_exceeded");
        expect(updated.nextRetryAtUnixMs).toBeUndefined();
      }

      record = updated;
    }
  });

  it("maps queued/partial/quorum/blocked outcomes deterministically", () => {
    const queued = contactRequestOutboxInternals.applySendResultToOutboxRecord(
      BASE_RECORD,
      {
        success: false,
        deliveryStatus: "queued_retrying",
        retryAtUnixMs: 77_777,
        relayResults: [{ relayUrl: "wss://relay.one", success: false, error: "cooldown" }],
        error: "queued for retry",
        failureReason: "quorum_not_met",
      },
      10_000
    );
    expect(queued.status).toBe("failed");
    expect(queued.nextRetryAtUnixMs).toBe(77_777);
    expect(queued.failureReason).toBe("quorum_not_met");

    const partial = contactRequestOutboxInternals.applySendResultToOutboxRecord(
      BASE_RECORD,
      {
        success: true,
        deliveryStatus: "sent_partial",
        relayResults: [
          { relayUrl: "wss://relay.one", success: true },
          { relayUrl: "wss://relay.two", success: false, error: "503" },
        ],
      },
      10_000
    );
    expect(partial.status).toBe("sent_partial");
    expect(partial.publishReport?.successCount).toBe(1);
    expect(partial.publishReport?.metQuorum).toBe(false);

    const quorum = contactRequestOutboxInternals.applySendResultToOutboxRecord(
      BASE_RECORD,
      {
        success: true,
        deliveryStatus: "sent_quorum",
        relayResults: [{ relayUrl: "wss://relay.one", success: true }],
      },
      10_000
    );
    expect(quorum.status).toBe("sent_quorum");
    expect(quorum.publishReport?.metQuorum).toBe(true);

    const blocked = contactRequestOutboxInternals.applySendResultToOutboxRecord(
      BASE_RECORD,
      {
        success: false,
        relayResults: [],
        error: "identity locked",
        blockReason: "identity_locked",
      },
      10_000
    );
    expect(blocked.status).toBe("failed");
    expect(blocked.nextRetryAtUnixMs).toBeUndefined();
    expect(blocked.blockReason).toBe("identity_locked");
  });

  it("releases stale pending lock exactly once after terminal outbox failure", () => {
    let requestStatus: { status?: "pending" | "accepted" | "declined" | "canceled"; isOutgoing: boolean } = {
      status: "pending",
      isOutgoing: true,
    };
    const setStatusCalls: Array<{ status: string; isOutgoing?: boolean }> = [];
    const record: ContactRequestRecord = {
      ...BASE_RECORD,
      status: "failed",
      nextRetryAtUnixMs: undefined,
      retries: contactRequestOutboxInternals.MAX_REQUEST_RETRY_ATTEMPTS,
      failureReason: "max_retries_exceeded",
    };

    const getRequestStatus = () => requestStatus;
    const setRequestStatus = (params: Readonly<{
      peerPublicKeyHex: PublicKeyHex;
      status: "pending" | "accepted" | "declined" | "canceled";
      isOutgoing?: boolean;
    }>) => {
      setStatusCalls.push({ status: params.status, isOutgoing: params.isOutgoing });
      requestStatus = { status: params.status, isOutgoing: params.isOutgoing ?? true };
    };

    contactRequestOutboxInternals.reconcileRequestStatusFromOutbox(record, getRequestStatus as any, setRequestStatus);
    contactRequestOutboxInternals.reconcileRequestStatusFromOutbox(record, getRequestStatus as any, setRequestStatus);

    expect(setStatusCalls).toHaveLength(1);
    expect(setStatusCalls[0]).toEqual({ status: "canceled", isOutgoing: true });
    expect(requestFlowEvidenceStore.get(PEER).lastEvidenceUnixMs).toBeTypeOf("number");
  });
});
