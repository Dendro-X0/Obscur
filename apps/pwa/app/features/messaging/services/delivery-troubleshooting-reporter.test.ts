import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));
vi.mock("@/app/shared/dev-runtime-issue-reporter", () => ({
  reportDevRuntimeIssue: vi.fn(),
}));

import { logAppEvent } from "@/app/shared/log-app-event";
import { reportDevRuntimeIssue } from "@/app/shared/dev-runtime-issue-reporter";
import {
  deliveryTroubleshootingReporterInternals,
  reportSenderDeliveryIssue,
} from "./delivery-troubleshooting-reporter";

describe("delivery-troubleshooting-reporter", () => {
  beforeEach(() => {
    deliveryTroubleshootingReporterInternals.clearSenderDeliveryIssues();
    vi.mocked(logAppEvent).mockClear();
    vi.mocked(reportDevRuntimeIssue).mockClear();
  });

  it("records failed sender delivery issues with relay failure summaries", () => {
    const report = reportSenderDeliveryIssue({
      senderPublicKeyHex: "a".repeat(64) as any,
      recipientPublicKeyHex: "b".repeat(64) as any,
      messageId: "event-id-123",
      deliveryStatus: "failed",
      failureReason: "quorum_not_met",
      reasonCode: "quorum_not_met",
      error: "Relay quorum not met",
      targetRelayUrls: ["wss://r1.example", "wss://r2.example"],
      relayResults: [
        { relayUrl: "wss://r1.example", success: false, error: "timeout" },
        { relayUrl: "wss://r2.example", success: true },
      ],
    });

    expect(report.deliveryStatus).toBe("failed");
    expect(report.attemptPhase).toBe("initial_send");
    expect(report.relayFailureCount).toBe(1);
    expect(report.relayFailureSummary).toEqual(["wss://r1.example: timeout"]);
    expect(deliveryTroubleshootingReporterInternals.getRecentSenderDeliveryIssues()).toHaveLength(1);
    expect(vi.mocked(logAppEvent)).toHaveBeenCalledWith(expect.objectContaining({
      name: "messaging.delivery.sender_delivery_failed",
      level: "error",
    }));
    expect(vi.mocked(reportDevRuntimeIssue)).toHaveBeenCalledWith(expect.objectContaining({
      domain: "messaging",
      operation: "send_delivery",
      severity: "error",
    }));
  });

  it("records queued sender delivery issues and logs warning event", () => {
    const report = reportSenderDeliveryIssue({
      senderPublicKeyHex: "c".repeat(64) as any,
      recipientPublicKeyHex: "d".repeat(64) as any,
      deliveryStatus: "queued_retrying",
      failureReason: "no_active_relays",
      reasonCode: "no_writable_relays",
      error: "Queued for retry",
      targetRelayUrls: ["wss://r3.example"],
    });

    expect(report.deliveryStatus).toBe("queued_retrying");
    expect(report.attemptPhase).toBe("initial_send");
    expect(report.relayFailureCount).toBe(0);
    expect(vi.mocked(logAppEvent)).toHaveBeenCalledWith(expect.objectContaining({
      name: "messaging.delivery.sender_delivery_queued",
      level: "warn",
    }));
    expect(vi.mocked(reportDevRuntimeIssue)).toHaveBeenCalledWith(expect.objectContaining({
      domain: "messaging",
      operation: "send_delivery",
      severity: "warn",
    }));
  });

  it("captures queue retry metadata for queued sender delivery issues", () => {
    const report = reportSenderDeliveryIssue({
      attemptPhase: "queue_retry",
      senderPublicKeyHex: "e".repeat(64) as any,
      recipientPublicKeyHex: "f".repeat(64) as any,
      messageId: "queued-event-id",
      deliveryStatus: "queued_retrying",
      failureReason: "quorum_not_met",
      reasonCode: "quorum_not_met",
      error: "Retry scheduled due to unmet durable evidence",
      queueRetryCount: 3,
      nextRetryAtUnixMs: 1_778_000_000_000,
      targetRelayUrls: ["wss://relay.example"],
    });

    expect(report.attemptPhase).toBe("queue_retry");
    expect(report.queueRetryCount).toBe(3);
    expect(report.nextRetryAtUnixMs).toBe(1_778_000_000_000);
    expect(vi.mocked(reportDevRuntimeIssue)).toHaveBeenCalledWith(expect.objectContaining({
      operation: "queue_delivery",
      severity: "warn",
    }));
  });

  it("announces delivery troubleshooting reports via console.warn in dev", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportSenderDeliveryIssue({
      senderPublicKeyHex: "a".repeat(64) as any,
      recipientPublicKeyHex: "b".repeat(64) as any,
      deliveryStatus: "failed",
      failureReason: "quorum_not_met",
      reasonCode: "relay_degraded",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[DeliveryTroubleshooting] Sender delivery issue",
      expect.objectContaining({
        deliveryStatus: "failed",
      })
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
