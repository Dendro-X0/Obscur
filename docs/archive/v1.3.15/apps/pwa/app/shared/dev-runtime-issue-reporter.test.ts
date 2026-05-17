import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  devRuntimeIssueReporterInternals,
  reportDevRuntimeIssue,
} from "./dev-runtime-issue-reporter";

describe("dev-runtime-issue-reporter", () => {
  beforeEach(() => {
    devRuntimeIssueReporterInternals.clearIssues();
    vi.restoreAllMocks();
  });

  it("records a new runtime issue and exposes it through the window tool", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const issue = reportDevRuntimeIssue({
      domain: "relay",
      operation: "connect",
      severity: "error",
      reasonCode: "connection_failed",
      message: "Relay connection failed wss://relay.example: timeout",
      retryable: true,
      context: { relayUrl: "wss://relay.example", timeoutMs: 3000 },
    });

    expect(issue).not.toBeNull();
    const snapshot = devRuntimeIssueReporterInternals.getIssues();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].occurrenceCount).toBe(1);
    expect(snapshot[0].domain).toBe("relay");
    expect(snapshot[0].operation).toBe("connect");
    expect(window.obscurDevRuntimeIssues?.getRecentIssues()).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[DevRuntimeIssue:error] relay.connect",
      expect.objectContaining({
        severity: "error",
      })
    );
  });

  it("deduplicates repeated issues within the dedupe window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T00:00:00.000Z"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportDevRuntimeIssue({
      domain: "upload",
      operation: "upload_file",
      severity: "error",
      reasonCode: "upload_timeout",
      message: "Upload timed out",
      retryable: true,
      fingerprint: "upload|timeout|provider_a",
    });

    vi.advanceTimersByTime(1_000);
    reportDevRuntimeIssue({
      domain: "upload",
      operation: "upload_file",
      severity: "error",
      reasonCode: "upload_timeout",
      message: "Upload timed out",
      retryable: true,
      fingerprint: "upload|timeout|provider_a",
    });

    const snapshot = devRuntimeIssueReporterInternals.getIssues();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].occurrenceCount).toBe(2);

    vi.useRealTimers();
  });

  it("does not dedupe issues after the dedupe window expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T00:00:00.000Z"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportDevRuntimeIssue({
      domain: "messaging",
      operation: "send_delivery",
      severity: "warn",
      reasonCode: "quorum_not_met",
      message: "Sender delivery queued for retry.",
      retryable: true,
      fingerprint: "messaging|send_delivery|peer_a",
    });

    vi.advanceTimersByTime(8_500);
    reportDevRuntimeIssue({
      domain: "messaging",
      operation: "send_delivery",
      severity: "warn",
      reasonCode: "quorum_not_met",
      message: "Sender delivery queued for retry.",
      retryable: true,
      fingerprint: "messaging|send_delivery|peer_a",
    });

    const snapshot = devRuntimeIssueReporterInternals.getIssues();
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0].occurrenceCount).toBe(1);
    expect(snapshot[1].occurrenceCount).toBe(1);

    vi.useRealTimers();
  });
});
