import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./dev-runtime-issue-reporter", () => ({
  reportDevRuntimeIssue: vi.fn(),
}));

import { logAppEvent } from "./log-app-event";
import { reportDevRuntimeIssue } from "./dev-runtime-issue-reporter";

describe("logAppEvent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).__obscur_log_hygiene_registry__ = new Map();
    vi.mocked(reportDevRuntimeIssue).mockClear();
  });

  it("rate-limits repeated warn events with the same name", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (let index = 0; index < 20; index += 1) {
      logAppEvent({
        name: "messaging.native_session.identity_mismatch_receive",
        level: "warn",
        context: { index },
      });
    }

    expect(warnSpy.mock.calls.length).toBeLessThan(20);
    expect(warnSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it("rate-limits repeated info events with the same name", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    for (let index = 0; index < 100; index += 1) {
      logAppEvent({
        name: "messaging.transport.incoming_event_seen",
        level: "info",
        context: { index },
      });
    }

    expect(infoSpy.mock.calls.length).toBeLessThan(100);
    expect(infoSpy.mock.calls.length).toBeGreaterThan(0);
    expect(vi.mocked(reportDevRuntimeIssue)).not.toHaveBeenCalled();
  });

  it("escalates error events into the dev runtime issue feed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.transport.publish_failed",
      level: "error",
      scope: { feature: "messaging", action: "send_dm" },
      context: { reasonCode: "quorum_not_met", message: "Publish quorum failed" },
    });

    expect(vi.mocked(reportDevRuntimeIssue)).toHaveBeenCalledWith(expect.objectContaining({
      domain: "messaging",
      operation: "send_dm",
      severity: "error",
      reasonCode: "quorum_not_met",
    }));
  });

  it("does not duplicate delivery troubleshooting events already handled by dedicated reporter", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.delivery.sender_delivery_failed",
      level: "error",
      scope: { feature: "messaging", action: "send_dm" },
      context: { reasonCode: "quorum_not_met" },
    });

    expect(vi.mocked(reportDevRuntimeIssue)).not.toHaveBeenCalled();
  });

  it("downgrades delivery-failed console emission to warn in non-production", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.delivery.sender_delivery_failed",
      level: "error",
      scope: { feature: "messaging", action: "send_dm" },
      context: { reasonCode: "relay_degraded" },
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
