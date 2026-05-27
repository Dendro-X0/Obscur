import { describe, expect, it } from "vitest";
import {
  getRelayReadinessBannerCopy,
  getRelayReadinessDetailCopy,
  getRelayTransportQueueHint,
} from "./relay-readiness-copy";
import type { RelayRecoverySnapshot } from "./relay-recovery-policy";

const createSnapshot = (overrides: Partial<RelayRecoverySnapshot>): RelayRecoverySnapshot => ({
  readiness: "offline",
  writableRelayCount: 0,
  fallbackWritableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  lastInboundMessageAtUnixMs: undefined,
  lastInboundEventAtUnixMs: undefined,
  lastSuccessfulPublishAtUnixMs: undefined,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
  ...overrides,
});

describe("relay-readiness-copy", () => {
  it("returns a queue hint when no writable relays exist", () => {
    const message = getRelayTransportQueueHint(createSnapshot({ readiness: "recovering" }));
    expect(message).toMatch(/queue/i);
  });

  it("returns no hint when writable relays exist", () => {
    const message = getRelayTransportQueueHint(createSnapshot({ readiness: "degraded", writableRelayCount: 1 }));
    expect(message).toBeNull();
  });

  it("mentions queued sends in offline banner copy", () => {
    const banner = getRelayReadinessBannerCopy(createSnapshot({ readiness: "offline" }));
    expect(banner).toMatch(/queue/i);
  });

  it("returns banner copy for degraded states", () => {
    const banner = getRelayReadinessBannerCopy(createSnapshot({ readiness: "degraded", writableRelayCount: 1 }));
    expect(banner).toContain("degraded");
  });

  it("returns settings detail copy with writable counts", () => {
    const detail = getRelayReadinessDetailCopy(createSnapshot({
      readiness: "offline",
      writableRelayCount: 0,
      subscribableRelayCount: 1,
    }));
    expect(detail).toMatch(/offline/i);
    expect(detail).toMatch(/0 writable/);
  });
});
