import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { contactRequestOutboxInternals } from "./use-contact-request-outbox";
import type { ContactRequestRecord } from "@/app/features/search/types/discovery";

const BASE_RECORD: ContactRequestRecord = {
  id: "req-1",
  peerPubkey: "b".repeat(64),
  status: "queued",
  retries: 0,
  createdAtUnixMs: 1000,
  updatedAtUnixMs: 1000,
};

describe("use-contact-request-outbox internals", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("applies bounded retry delay with jitter", () => {
    const retry1 = contactRequestOutboxInternals.nextRetryDelayMs(1);
    const retry6 = contactRequestOutboxInternals.nextRetryDelayMs(6);
    expect(retry1).toBeGreaterThanOrEqual(3000);
    expect(retry1).toBeLessThanOrEqual(3449);
    expect(retry6).toBeLessThanOrEqual(60_000);
  });

  it("updates timestamps when patching records", () => {
    const updated = contactRequestOutboxInternals.toUpdatedRecord(BASE_RECORD, {
      status: "publishing",
    });
    expect(updated.status).toBe("publishing");
    expect(updated.updatedAtUnixMs).toBeGreaterThanOrEqual(BASE_RECORD.updatedAtUnixMs);
  });

  it("maps accepted and declined inbox statuses to terminal states", () => {
    const records: ReadonlyArray<ContactRequestRecord> = [
      BASE_RECORD,
      { ...BASE_RECORD, id: "req-2", peerPubkey: "c".repeat(64), status: "queued" },
    ];

    const mapped = contactRequestOutboxInternals.syncResolvedStatuses(
      records,
      ({ peerPublicKeyHex }) => {
        if (peerPublicKeyHex === ("b".repeat(64) as PublicKeyHex)) {
          return { status: "accepted", isOutgoing: false };
        }
        return { status: "declined", isOutgoing: false };
      }
    );

    expect(mapped[0]?.status).toBe("accepted");
    expect(mapped[1]?.status).toBe("rejected");
  });

  it("does not schedule retry for block reasons", () => {
    const shouldRetry = contactRequestOutboxInternals.shouldScheduleRetry(
      {
        success: false,
        relayResults: [],
        error: "identity locked",
        blockReason: "identity_locked",
      },
      0
    );
    expect(shouldRetry).toBe(false);
  });

  it("schedules retry for transient relay failure with zero successes", () => {
    const shouldRetry = contactRequestOutboxInternals.shouldScheduleRetry(
      {
        success: false,
        relayResults: [],
        error: "No active relays",
        failureReason: "no_active_relays",
      },
      0
    );
    expect(shouldRetry).toBe(true);
  });

  it("schedules retry when delivery status is queued_retrying", () => {
    const shouldRetry = contactRequestOutboxInternals.shouldScheduleRetry(
      {
        success: false,
        deliveryStatus: "queued_retrying",
        relayResults: [],
        error: "Queued for retry",
      },
      0
    );
    expect(shouldRetry).toBe(true);
  });

  it("schedules retry when success is true but there is no relay evidence", () => {
    const shouldRetry = contactRequestOutboxInternals.shouldScheduleRetry(
      {
        success: true,
        relayResults: [],
      },
      0
    );
    expect(shouldRetry).toBe(true);
  });

  it("enforces max retry budget", () => {
    expect(contactRequestOutboxInternals.hasExceededRetryBudget(4)).toBe(false);
    expect(contactRequestOutboxInternals.hasExceededRetryBudget(5)).toBe(true);
    expect(contactRequestOutboxInternals.MAX_REQUEST_RETRY_ATTEMPTS).toBe(5);
  });

  it("releases outgoing pending guard when outbox is terminal failed", () => {
    const shouldRelease = contactRequestOutboxInternals.shouldReleaseOutgoingPendingAfterOutboxFailure(
      {
        ...BASE_RECORD,
        status: "failed",
        nextRetryAtUnixMs: undefined,
      },
      { status: "pending", isOutgoing: true },
      Date.now()
    );
    expect(shouldRelease).toBe(true);
  });

  it("does not release outgoing pending guard while retry is still scheduled", () => {
    const now = Date.now();
    const shouldRelease = contactRequestOutboxInternals.shouldReleaseOutgoingPendingAfterOutboxFailure(
      {
        ...BASE_RECORD,
        status: "failed",
        nextRetryAtUnixMs: now + 20_000,
      },
      { status: "pending", isOutgoing: true },
      now
    );
    expect(shouldRelease).toBe(false);
  });
});
